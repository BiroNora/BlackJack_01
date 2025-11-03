import os
import uuid
import logging
import math
from functools import wraps
from urllib.parse import urlparse
from dotenv import load_dotenv
from sqlalchemy import select
from flask import Flask, current_app, json, jsonify, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
from flask_session import Session
from sqlalchemy.exc import IntegrityError
from psycopg2.errors import UniqueViolation

from upstash_redis import Redis as UpstashRedisClient  # Upstash kliens átnevezve
from redis import Redis as FlaskSessionRedisClient  # Hivatalos kliens importálva

from my_app.backend.game import Game

load_dotenv()

MINIMUM_BET = 1

# =========================================================================
# FLASK APPLICATION BASICS
# =========================================================================
app = Flask(__name__, static_folder="../react/dist", template_folder="../react/dist")
app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY", "default-dev-secret-key-NEVER-USE-IN-PROD"
)
# Session permanencia beállítása
# app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=31)  # Például 31 nap
# app.config["SESSION_COOKIE_SECURE"] = False

app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=31)
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("VERCEL", "False") == "True"

# =========================================================================
# VERCEL REDIS SESSION SETUP
# =========================================================================
UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL")
UPSTASH_REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_TOKEN")

# A Flask-Session csomag nem szereti a None-t, ezért alapértelmezettként
# a "filesystem"-et használjuk. Ez a biztonságos fallback.
# app.config["SESSION_TYPE"] = "filesystem"
app.config["SESSION_TYPE"] = "redis"
app.config["SESSION_REDIS"] = None

# Helyi kliens a Redis-ben tárolt játékállapot számára (ha a Redis működik)
upstash_redis_client = None

if not UPSTASH_REDIS_URL or not UPSTASH_REDIS_TOKEN:
    print(
        "!!! Hiba: UPSTASH_REDIS_URL vagy UPSTASH_REDIS_TOKEN nincs beállítva. Marad a Flask-Session alapértelmezett session (filesystem). !!!"
    )
else:
    try:
        # 1. Létrehozzuk az Upstash Redis klienst (Game State-hez)
        upstash_redis_client = UpstashRedisClient(
            url=UPSTASH_REDIS_URL, token=UPSTASH_REDIS_TOKEN
        )

        # 2. A HOST és PORT kinyerése a szabványos urllib.parse használatával (ez a legbiztosabb)
        parsed_url = urlparse(UPSTASH_REDIS_URL)

        host = parsed_url.hostname
        port = parsed_url.port if parsed_url.port is not None else 6379

        # Ellenőrzés, hogy a host és a port sikerült-e kinyerni
        if not host or not port:
            raise ValueError(
                f"Redis URL formátumhiba: Nem sikerült kinyerni a hostot ({host}) vagy a portot ({port}) a megadott URL-ből."
            )

        # FlaskSessionRedisClient (standard redis-py) direkt inicializálása
        flask_session_client = FlaskSessionRedisClient(
            host=host,
            port=port,
            password=UPSTASH_REDIS_TOKEN,
            ssl=True,  # Kötelező az Upstash-hoz (TLS)
            ssl_cert_reqs="required",
        )

        # =========================================================================
        # REDIS PING TEST AND CONFIG
        # =========================================================================
        if flask_session_client.ping():
            # Csak sikeres ping esetén állítjuk be a Redis session-t
            app.config["SESSION_TYPE"] = "redis"
            app.config["SESSION_REDIS"] = flask_session_client
            app.config["REDIS_CLIENT"] = (
                upstash_redis_client  # Mentjük a Game State klienst
            )

            # print(f"!!! Redis ping sikeres: {flask_session_client.ping()} !!!")
        else:
            print(
                "!!! Redis ping nem sikeres. Marad a Flask-Session alapértelmezett session. !!!"
            )

    except Exception as e:
        # Ha bármelyik inicializálási kísérlet során hiba történik:
        print(f"!!! Kritikus hiba a Redis konfigurálásakor: {e} !!!")
        print(
            "!!! Visszaállás Flask-Session alapértelmezett session-re a Redis kapcsolat hiba miatt. !!!"
        )


# 5. Inicializáljuk a Flask-Session-t
sess = Session(app)
# Ezzel a lépéssel a Flask "session" objektum minden használatakor a Redishez fordul.
# =========================================================================
# DATABASE SETUP (NEON POSTGRES)
# =========================================================================
# DATABASE_URL = os.environ.get('DATABASE_URL_SIMPLE', 'postgresql://player:pass@localhost:5433/blackjack_game')
DATABASE_URL = os.environ.get(
    "DATABASE_URL_SIMPLE", "postgresql://player:pass@localhost:5433/blackjack_game"
)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# Deploykor ez is környezeti változó legyen!
# Cookie élettartama (opcionális, alapértelmezett a böngésző bezárásáig)
# app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=31) # Pl. 31 napig tart a session

db = SQLAlchemy(app)

log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(
        db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    tokens = db.Column(db.Integer, default=1000)
    last_activity = db.Column(
        db.TIMESTAMP(timezone=True),
        default=datetime.now(timezone.utc),
        onupdate=datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<User {self.id[:8]} (Client: {self.client_id[:8]})>"


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return (
                jsonify(
                    {
                        "error": "ERROR: Invalid user session.",
                        "game_state_hint": "INVALID_USER_SESSION",
                    }
                ),
                401,
            )

        user = db.session.get(User, user_id)
        if not user:
            session.pop("user_id", None)
            return (
                jsonify(
                    {
                        "error": "ERROR: Invalid user session.",
                        "game_state_hint": "INVALID_USER_SESSION",
                    }
                ),
                401,
            )

        user.last_activity = datetime.now(timezone.utc)
        db.session.commit()

        return f(user=user, *args, **kwargs)

    return decorated_function


def with_game_state(f):
    """
    Betölti a 'game' állapotát a Redisből, átadja a függvénynek, majd menti.
    FIGYELEM: Feltételezi, hogy a Game.deserialize() Python szótárat vár.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # user lekérése a @login_required-től
        user = kwargs.get("user")

        if not user:
            # Ez a hiba akkor fut le, ha a @login_required hiányzik vagy nem futott le.
            raise Exception(
                "A @with_game_state dekorátort a @login_required után kell használni."
            )

        redis_client = current_app.config.get("REDIS_CLIENT")
        if not redis_client:
            raise Exception("Server configuration error: Redis client missing.")

        redis_key = f"game:{user.id}"
        redis_data_raw = redis_client.get(redis_key)

        game = Game()  # Új játék alapértelmezettként

        # --- Játékállapot BETÖLTÉSE (LOAD) ---
        if redis_data_raw:
            try:
                # EZ AZ A LOGIKA, AMI AZ ÖN FÜGGVÉNYEIBEN IS MŰKÖDÖTT:
                # 1. Byte/string dekódolása és JSON betöltése Python szótárrá
                if isinstance(redis_data_raw, bytes):
                    redis_data_str = redis_data_raw.decode("utf-8")
                else:
                    redis_data_str = redis_data_raw

                redis_data = json.loads(redis_data_str)

                # 2. Szótár átadása a Game.deserialize-nek
                game = Game.deserialize(redis_data)

            except Exception as e:
                # Deszerializációs hiba esetén új játék indítása
                print(
                    f"Hiba a Game deszerializálásakor ({user.id}): {e}. Új játék indítása."
                )
                game = Game()

        # 1. Eredeti függvény futtatása, átadva a betöltött 'game' objektumot
        result = f(*args, game=game, **kwargs)

        # 2. Játékállapot MENTÉSE (SAVE) a Redisbe
        # Feltételezzük, hogy a game.serialize() JSON stringet ad vissza.
        # A set() automatikusan kezeli a string/bytes konverziót.
        redis_client.set(redis_key, game.serialize())

        return result

    return decorated_function


def api_error_handler(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)  # Meghívjuk az eredeti végpont függvényt
        except ValueError as e:
            # Specifikus hiba (pl. pakli üres, érvénytelen adat)
            print(f"Specifikus hiba az API végponton: {e}")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": str(e),  # A ValueError üzenetét küldjük vissza
                        "game_state_hint": "CLIENT_ERROR_SPECIFIC",  # Vagy egy specifikusabb hint
                    }
                ),
                400,
            )
        except Exception as e:
            print(f"Váratlan szerver hiba az API végponton: {e}")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "CRITICAL SERVER ERROR",
                        "game_state_hint": "SERVER_ERROR_GENERIC",
                    }
                ),
                500,
            )

    return decorated_function


@app.route("/api/ping_redis", methods=["GET"])
@api_error_handler
def ping_redis():
    """
    Ellenőrzi a Redis adatbázis kapcsolatát a 'PING' paranccsal.
    Diagnosztikai végpont.
    """
    # Lekérjük a Redis klienst a Flask app konfigurációjából
    redis_client = app.config.get("REDIS_CLIENT")

    if not redis_client:
        # Ez a hiba akkor merül fel, ha a Redis inicializálása nem sikerült
        # az alkalmazás indításakor, ami konfigurációs hiba.
        raise Exception("A Redis kliens nem érhető el az alkalmazás konfigurációjában.")

    # A ping() metódus True-t ad vissza sikeres kapcsolat esetén
    if redis_client.ping():
        # Teszt adat mentése és lekérése a teljes körű olvasási/írási ellenőrzéshez
        test_key = "redis_connection_test_key"
        test_value = "connection_success"

        # Beállítunk egy kulcsot, ami 60 másodperc után lejár
        redis_client.set(test_key, test_value, ex=60)
        retrieved_value = redis_client.get(test_key)

        if retrieved_value and retrieved_value.decode() == test_value:
            return (
                jsonify(
                    {
                        "status": "success",
                        "message": "A Redis adatbázis elérhető és az olvasási/írási teszt sikeres.",
                        "test_passed": True,
                    }
                ),
                200,
            )
        else:
            # Ezt elvileg nem szabadna elérni, de ha a ping megy, de az I/O nem, az komoly
            raise Exception(
                "A Redis ping sikeres, de az olvasási/írási teszt sikertelen."
            )

    # Ha a ping sikertelen, a ping() exceptiont dob, amit az api_error_handler kezel.
    # Ha mégis idáig jut, valami ismeretlen hiba történt.
    raise Exception("Ismeretlen hiba történt a Redis kapcsolódás során.")


@app.route("/")
def index():
    return render_template("index.html")


# 0
@app.route("/api/initialize_session", methods=["POST"])
@api_error_handler
def initialize_session():
    """
    Inicializálja a felhasználói sessiont (DB autentikáció, tokenek lekérése)
    és betölti vagy létrehozza a felhasználó Game állapotát a Redisben.
    """
    data = request.get_json()
    client_id_from_request = data.get("client_id")

    user_id_in_session = session.get("user_id")
    user = None

    # ----------------------------------------------------------------------
    # 1. DB: Felhasználó ellenőrzése, azonosítása vagy új létrehozása
    # ----------------------------------------------------------------------
    if user_id_in_session:
        user = db.session.get(User, user_id_in_session)
        if not user:
            session.pop("user_id", None)

    if not user and client_id_from_request:
        stmt = select(User).filter_by(client_id=client_id_from_request)
        user = db.session.execute(stmt).scalar_one_or_none()

    if not user:
        try:
            user = User(client_id=client_id_from_request)
            db.session.add(user)
            db.session.commit()
        except IntegrityError as e:
            # Csak a UniqueViolation-t (ami IntegrityError-on keresztül érkezik) kezeljük
            if isinstance(e.orig, UniqueViolation):
                # Versenyhelyzet: A felhasználót épp most hozta létre egy másik kérés.
                db.session.rollback()  # Visszaállítjuk a tranzakciót
                print(
                    f"Versenyhelyzet (UniqueViolation) a client_id={client_id_from_request} miatt. Újra megpróbáljuk lekérdezni."
                )

                # Visszakeressük a már létező felhasználót
                stmt = select(User).filter_by(client_id=client_id_from_request)
                user = db.session.execute(stmt).scalar_one_or_none()

                if not user:
                    # Ha még így sem találjuk, akkor kritikus hiba
                    raise Exception(
                        f"Kritikus hiba: Létrehozási hiba után sem találtuk a felhasználót: {client_id_from_request}"
                    )
            else:
                raise e  # Egyéb integritási hiba továbbdobása
    # ----------------------------------------------------------------------
    # 2. DB & Session: Frissítés és beállítás
    # ----------------------------------------------------------------------
    user.last_activity = datetime.now(timezone.utc)
    db.session.commit()
    session["user_id"] = user.id
    session.permanent = True

    # ----------------------------------------------------------------------
    # 3. REDIS: Játékállapot (Game State) inicializálása vagy betöltése
    # ----------------------------------------------------------------------
    redis_client = app.config.get("REDIS_CLIENT")
    game_state_for_client = {}

    if not redis_client:
        raise Exception("Server configuration error: Redis client missing.")

    redis_key = f"game:{user.id}"
    redis_data_raw = redis_client.get(redis_key)
    game_instance = Game()

    if redis_data_raw:
        redis_client.delete(redis_key)
        print(f"Régi Redis kulcs ({redis_key}) törölve az új session indításakor.")
        try:
            game_instance.clear_up()
            game_instance.deck_len = game_instance.deck_len_init
        except Exception as e:
            # Hiba esetén új játék indítása
            print(
                f"Hiba a Game deszerializálásakor ({user.id}): {e}. Új játék indítása."
            )
    else:
        # Nincs játékállás a Redisben: új játék indítása
        game_instance = Game()

    # Elmentjük a Game objektumot a Redisbe
    redis_client.set(redis_key, game_instance.serialize())

    # Szerializáljuk a Kliens számára szükséges publikus adatokat
    game_state_for_client = game_instance.serialize_for_client_init()

    # ----------------------------------------------------------------------
    # 4. Visszatérési érték (Összes adat egy válaszban)
    # ----------------------------------------------------------------------
    return (
        jsonify(
            {
                "status": "success",
                "message": "User and game session initialized.",
                "user_id": user.id,
                "client_id": user.client_id,
                "tokens": user.tokens,
                # EBBEN VAN BENNE MINDEN, pl. a deckLen is!
                "game_state": game_state_for_client,
                "game_state_hint": "USER_SESSION_INITIALIZED",
            }
        ),
        200,
    )


# 1
@app.route("/api/bet", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def bet(user, game):
    data = request.get_json()
    bet_amount = data.get("bet", 0)

    if not isinstance(bet_amount, (int, float)) or bet_amount <= 0:
        return (
            jsonify(
                {
                    "error": "Invalid bet amount.",
                    "game_state_hint": "INVALID_BET_AMOUNT_TYPE",
                }
            ),
            400,
        )

    if bet_amount < MINIMUM_BET:
        return (
            jsonify(
                {
                    "error": f"Bet must be at least {MINIMUM_BET} minimum.",
                    "game_state_hint": "BET_BELOW_MINIMUM",
                }
            ),
            400,
        )

    if user.tokens < bet_amount:
        return (
            jsonify(
                {
                    "error": "Not enough tokens.",
                    "game_state_hint": "NOT_ENOUGH_TOKENS_FOR_BET",
                }
            ),
            400,
        )

    user.tokens -= bet_amount
    db.session.commit()

    game.set_bet(bet_amount)
    game.set_bet_list(bet_amount)
    # A game state-et a VÉGÉN a @with_game_state automatikusan menti a Redisbe!
    # Nincs szükség: db.session.commit() és redis_client.set(redis_key, game.serialize())

    game_state_for_client = game.serialize_for_client_bets()

    return (
        jsonify(
            {
                "status": "success",
                "bet_placed": bet_amount,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "BET_SUCCESSFULLY_PLACED",
            }
        ),
        200,
    )


# 2
@app.route("/api/retake_bet", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def retake_bet(user, game):
    current_bet_list = game.get_bet_list()
    if not current_bet_list:
        return (
            jsonify(
                {"error": "No bet to retake.", "game_state_hint": "BET_LIST_EMPTY"}
            ),
            400,
        )

    amount_to_return = game.retake_bet_from_bet_list()

    user.tokens += amount_to_return
    db.session.commit()

    game_state_for_client = game.serialize_for_client_bets()

    return (
        jsonify(
            {
                "status": "success",
                "bet_retaken": amount_to_return,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "BET_SUCCESSFULLY_RETRAKEN",
            }
        ),
        200,
    )


# 3
@app.route("/api/create_deck", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def create_deck(user, game):
    game.create_deck()

    game_state_for_client = game.serialize_for_client_bets()

    return (
        jsonify(
            {
                "status": "success",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "DECK_CREATED",
            }
        ),
        200,
    )


# 4
@app.route("/api/start_game", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def start_game(user, game):
    game.initialize_new_round()

    game_state_for_client = game.serialize_initial_and_hit_state()

    return (
        jsonify(
            {
                "status": "success",
                "message": "New round initialized.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "NEW_ROUND_INITIALIZED",
            }
        ),
        200,
    )


# 5
@app.route("/api/ins_request", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def ins_request(user, game):
    bet = game.get_bet()
    insurance_amount = math.ceil(bet / 2)

    if user.tokens < insurance_amount:
        game_state_for_client = game.serialize_for_insurance()
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Insufficient tokens.",
                    "game_state_hint": "INSUFFICIENT_FUNDS",
                    "required": insurance_amount,
                    "available": user.tokens,
                    "game_state": game_state_for_client,
                }
            ),
            402,
        )
    ins = game.insurance_request()
    user.tokens += ins
    db.session.commit()

    game_state_for_client = game.serialize_for_insurance()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Insurance placed successfully.",
                "insurance_amount": insurance_amount,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "INSURANCE_PROCESSED",
            }
        ),
        200,
    )


# 6
@app.route("/api/hit", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def hit(user, game):
    game.hit()

    game_state_for_client = game.serialize_initial_and_hit_state()

    return (
        jsonify(
            {
                "status": "success",
                "tokens": user.tokens,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "HIT_RECIEVED",
            }
        ),
        200,
    )


# 7
@app.route("/api/double_request", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def double_request(user, game):
    user.last_activity = datetime.now(timezone.utc)

    bet_amount_to_double = game.get_bet()

    if user.tokens < bet_amount_to_double:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Insufficient tokens.",
                    "game_state_hint": "INSUFFICIENT_FUNDS_FOR_DOUBLE",
                    "required": bet_amount_to_double,
                    "available": user.tokens,
                }
            ),
            402,
        )

    amount_deducted = game.double_request()
    user.tokens -= amount_deducted
    db.session.commit()
    game.hit()

    game_state_for_client = game.serialize_double_state()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Double placed successfully.",
                "double_amount": amount_deducted,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
            }
        ),
        200,
    )


# 8
@app.route("/api/rewards", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def rewards(user, game):
    token_change = game.rewards()

    user.tokens += token_change
    db.session.commit()

    game_state_for_client = game.serialize_reward_state()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Rewards processed and tokens updated.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "REWARDS_PROCESSED",
            }
        ),
        200,
    )


# 9
@app.route("/api/stand_and_rewards", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def stand_and_rewards(user, game):
    game.stand()
    token_change = game.rewards()

    user.tokens += token_change
    db.session.commit()

    game_state_for_client = game.serialize_reward_state()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Rewards processed and tokens updated.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "REWARDS_PROCESSED",
            }
        ),
        200,
    )


# SPLIT part
# 10
@app.route("/api/split_request", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def split_request(user, game):
    user.last_activity = datetime.now(timezone.utc)

    bet_amount = game.get_bet()

    if user.tokens < bet_amount:
        # Error válasz, ha nincs elég token.
        # A 402-es státuszkód (Payment Required) is használható ilyen esetekben.
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Insufficient tokens.",
                    "game_state_hint": "INSUFFICIENT_FUNDS",
                    "required": bet_amount,
                    "available": user.tokens,
                }
            ),
            402,
        )
    if not game.can_split(game.player["hand"]):
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Split not possible.",
                    "game_state_hint": "SPLIT_NOT_POSSIBLE_RULES",
                }
            ),
            400,
        )
    if len(game.players) > 3:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Split not possible.",
                    "game_state_hint": "MAX_SPLIT_HANDS_REACHED",
                }
            ),
            400,
        )

    game.split_hand()
    user.tokens -= bet_amount
    db.session.commit()  # Elmentjük a módosítást az adatbázisba!

    game_state_for_client = game.serialize_split_hand()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "split_amount": bet_amount,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "SPLIT_SUCCESS",
            }
        ),
        200,
    )


# 11
@app.route("/api/add_to_players_list_by_stand", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def add_to_players_list_by_stand(user, game):
    user.last_activity = datetime.now(timezone.utc)

    game.add_to_players_list_by_stand()

    game_state_for_client = game.serialize_add_to_players_list_by_stand()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 14
@app.route("/api/add_split_player_to_game", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def add_split_player_to_game(user, game):
    user.last_activity = datetime.now(timezone.utc)

    if not game.players:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Nincs több splitelt kéz, amit aktiválni lehetne.",
                    "game_state_hint": "NO_MORE_SPLIT_HANDS",
                }
            ),
            400,
        )

    game.add_split_player_to_game()

    game_state_for_client = game.serialize_split_hand()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 15
@app.route("/api/add_player_from_players", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def add_player_from_players(user, game):
    user.last_activity = datetime.now(timezone.utc)

    if not game.players:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "No more split hands.",
                    "game_state_hint": "NO_MORE_SPLIT_HANDS",
                }
            ),
            400,
        )

    game.add_player_from_players()

    game_state_for_client = game.serialize_add_player_from_players()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 16
@app.route("/api/split_hit", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def split_hit(user, game):
    game.hit()

    game_state_for_client = game.serialize_split_hand()

    return (
        jsonify(
            {
                "status": "success",
                "tokens": user.tokens,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "HIT_RECIEVED",
            }
        ),
        200,
    )


# 17
@app.route("/api/split_double_request", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def split_double_request(user, game):
    user.last_activity = datetime.now(timezone.utc)

    bet_amount_to_double = game.get_bet()

    if user.tokens < bet_amount_to_double:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Insufficient tokens.",
                    "game_state_hint": "INSUFFICIENT_FUNDS_FOR_DOUBLE",
                    "required": bet_amount_to_double,
                    "available": user.tokens,
                }
            ),
            402,
        )

    amount_deducted = game.double_request()
    user.tokens -= amount_deducted
    db.session.commit()
    game.hit()

    game_state_for_client = game.serialize_split_hand()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Double placed successfully.",
                "double_amount": amount_deducted,
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
            }
        ),
        200,
    )


# 18
@app.route("/api/split_stand_and_rewards", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def double_stand_and_rewards(user, game):
    game.stand()
    token_change = game.rewards()

    user.tokens += token_change
    db.session.commit()

    game_state_for_client = game.serialize_split_stand_and_rewards()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Rewards processed and tokens updated.",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "REWARDS_PROCESSED",
            }
        ),
        200,
    )


# 19
@app.route("/api/set_restart", methods=["POST"])
@login_required
@with_game_state
@api_error_handler
def set_restart(user, game):
    game.restart_game()

    user.tokens = 1000
    db.session.commit()

    game_state_for_client = game.serialize_for_client_bets()

    return (
        jsonify(
            {
                "status": "success",
                "current_tokens": user.tokens,
                "game_state": game_state_for_client,
                "game_state_hint": "HIT_RESTART",
            }
        ),
        200,
    )


# 20
@app.route("/api/force_restart", methods=["POST"])
@api_error_handler
def force_restart_by_client_id():
    """
    Ez az útvonal kezeli a játék újraindítását a kliensoldali hibák esetén.
    A client_id alapján azonosítja a felhasználót, és visszaállítja a játékállapotot
    a tokenek elvesztése nélkül.
    """
    data = request.get_json()
    client_id = data.get("client_id")

    if not client_id:
        return jsonify({"error": "client_id is required"}), 400

    # Megkeressük a felhasználót a client_id alapján
    stmt = select(User).filter_by(client_id=client_id)
    user = db.session.execute(stmt).scalar_one_or_none()

    if not user:
        return jsonify({"error": "User not found"}), 404

    # === Új session létrehozása a felhasználó számára ===
    # Ez a lépés pótolja a hiányzó vagy törölt session cookie-t.
    session.pop("game", None)  # Töröljük a régi, potenciálisan hibás játék sessiont
    session["user_id"] = user.id
    session.permanent = True

    redis_client = current_app.config.get("REDIS_CLIENT")
    redis_key = f"game:{user.id}"

    # A játék egy új, alapértelmezett állapotból indul,
    # mivel a régi játékállapot (pl. a bet) elveszett a sessionnel együtt.
    game = Game()
    game.restart_game()

    # Mentés a Redisbe, felülírva az esetlegesen hibás előző állapotot
    redis_client.set(redis_key, game.serialize())

    return (
        jsonify(
            {
                "status": "success",
                "current_tokens": user.tokens,
                "game_state": game.serialize_for_client_bets(),
                "game_state_hint": "HIT_RESTART",
            }
        ),
        200,
    )


# 21
@app.route("/error_page", methods=["GET"])
def error_page():
    return render_template("error.html")
