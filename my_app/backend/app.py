from functools import wraps
import math
import os
from urllib.parse import urlparse
from dotenv import load_dotenv
from sqlalchemy import select
from flask import Flask, json, jsonify, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import uuid
import logging
from flask_session import Session

from upstash_redis import Redis as UpstashRedisClient  # Upstash kliens átnevezve
from redis import Redis as FlaskSessionRedisClient  # Hivatalos kliens importálva

# from my_app.backend.game import Game
from game import Game

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
app.config["SESSION_TYPE"] = "filesystem"
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
        # REDIS PING TESZT ÉS KONFIGURÁCIÓ
        # =========================================================================
        if flask_session_client.ping():
            # Csak sikeres ping esetén állítjuk be a Redis session-t
            app.config["SESSION_TYPE"] = "filesystem"
            app.config["SESSION_REDIS"] = flask_session_client
            app.config["REDIS_CLIENT"] = (
                upstash_redis_client  # Mentjük a Game State klienst
            )

            print(f"!!! Redis ping sikeres: {flask_session_client.ping()} !!!")
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
    "DATABASE_URL", "postgresql://player:pass@localhost:5433/blackjack_game"
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


# === Játék session ellenőrző dekorátor ===
def load_game_state(f):
    """
    Betölti a Game State-et a Redis kliensből a user_id alapján.
    A Game objektumot átadja a végpont függvénynek.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")

        # 1. Autentikáció előzetes ellenőrzése
        if not user_id:
            return (
                jsonify({"error": "Unauthorized", "game_state_hint": "NO_SESSION"}),
                401,
            )

        # 2. Redis Kliens beszerzése
        redis_client = app.config.get("REDIS_CLIENT")
        if not redis_client:
            # Ezt a hibát már a konfigurációban kezelted, de jó, ha itt is ellenőrizzük
            return (
                jsonify({"error": "Server configuration error: Redis client missing."}),
                500,
            )

        # 3. Játékállapot lekérése a Redisből
        redis_key = f"game:{user_id}"
        redis_data = redis_client.get(redis_key)

        if not redis_data:
            # Nincs aktív játékállás a Redisben
            return (
                jsonify(
                    {
                        "error": "ERROR: No game active for user.",
                        "game_state_hint": "NO_GAME_ACTIVE",
                    }
                ),
                400,
            )

        # 4. Deszerializálás és továbbadás
        try:
            game = Game.deserialize(redis_data)
        except Exception:
            # Szerveroldali hiba, ha az adat korrupt
            return (
                jsonify(
                    {"error": "Corrupted game data.", "game_state_hint": "CORRUPT_DATA"}
                ),
                500,
            )

        # Továbbadjuk a "game" objektumot
        return f(game=game, *args, **kwargs)

    return decorated_function


def api_error_handler(f):
    """
    Dekorátor a Flask API végpontok hibakezelésének központosítására.
    Elkapja a ValueError-t (400 Bad Request) és az általános Exception-t (500 Internal Server Error).
    """

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

    # 1. DB: Felhasználó ellenőrzése, azonosítása vagy új létrehozása
    if user_id_in_session:
        user = db.session.get(User, user_id_in_session)
        if not user:
            session.pop("user_id", None)

    if not user and client_id_from_request:
        stmt = select(User).filter_by(client_id=client_id_from_request)
        user = db.session.execute(stmt).scalar_one_or_none()

    if not user:
        user = User(client_id=client_id_from_request)
        db.session.add(user)
        db.session.commit()

    # 2. DB & Session: Frissítés és beállítás
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
    redis_data = redis_client.get(redis_key)
    game_instance = None

    if redis_data:
        # Próba betöltésre
        try:
            game_instance = Game.deserialize(redis_data)
        except Exception as e:
            # Hiba esetén új játék indítása
            print(
                f"Hiba a Game deszerializálásakor ({user.id}): {e}. Új játék indítása."
            )
            game_instance = Game(player_tokens=user.tokens, user_id=user.id)
    else:
        # Nincs játékállás a Redisben: új játék indítása
        game_instance = Game(player_tokens=user.tokens, user_id=user.id)

    # Elmentjük a Game objektumot a Redisbe
    redis_client.set(redis_key, game_instance.serialize())

    # Szerializáljuk a Kliens számára szükséges publikus adatokat
    game_state_for_client = game_instance.serialize_for_client()

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
@app.route("/api/get_init_tokens_from_db", methods=["GET"])
@login_required
@api_error_handler
def get_init_tokens_from_db(user):

    initial_user_tokens = user.tokens
    game = Game()

    session["game"] = game.serialize()

    return (
        jsonify(
            {"user_tokens": initial_user_tokens, "message": "Tokens initialization."}
        ),
        200,
    )


# 2
@app.route("/api/get_deck_len", methods=["GET"])
@login_required  # Ellenőrzi, hogy a felhasználó be van-e jelentkezve
@load_game_state  # Ellenőrzi, hogy van-e aktív játék session
@api_error_handler
def get_deck_len(user, game):
    deck_len = game.get_deck_len()
    session["game"] = game.serialize()

    return jsonify({"deckLen": deck_len, "message": "message"}), 200


# 3
@app.route("/api/bet", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def bet(user, game):
    data = request.get_json()
    bet_amount = data.get("bet", 0)

    if not isinstance(bet_amount, (int, float)) or bet_amount <= 0:
        return (
            jsonify(
                {
                    "user_tokens": user.tokens,
                    "bet": game.bet,
                    "betList": game.bet_list,
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
                    "user_tokens": user.tokens,
                    "bet": game.bet,
                    "betList": game.bet_list,
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
                    "user_tokens": user.tokens,
                    "bet": game.bet,
                    "betList": game.bet_list,
                    "error": "Not enough tokens.",
                    "game_state_hint": "NOT_ENOUGH_TOKENS_FOR_BET",
                }
            ),
            400,
        )

    user.tokens -= bet_amount
    game.set_bet(bet_amount)
    game.set_bet_list(bet_amount)
    db.session.commit()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "bet_placed": bet_amount,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "BET_SUCCESSFULLY_PLACED",
            }
        ),
        200,
    )


# 4
@app.route("/api/retake_bet", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def retake_bet(user, game):
    current_betList = game.get_bet_list()
    if len(current_betList) == 0:
        return (
            jsonify(
                {
                    "user_tokens": user.tokens,
                    "bet": game.get_bet(),
                    "betList": game.get_bet_list(),
                    "error": "No bet to retake.",
                    "game_state_hint": "BET_LIST_EMPTY",
                }
            ),
            400,
        )

    amount_to_return = game.retake_bet_from_bet_list()

    user.tokens += amount_to_return

    session["game"] = game.serialize()
    user.game_state_json = json.dumps(session["game"])

    db.session.commit()

    return (
        jsonify(
            {
                "status": "success",
                "bet_retaken": amount_to_return,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "BET_SUCCESSFULLY_RETRAKEN",
            }
        ),
        200,
    )


# 5
@app.route("/api/get_tokens_from_db", methods=["GET"])
@login_required
@load_game_state
@api_error_handler
def get_tokens_from_db(user, game):
    user_tokens = user.tokens

    return (
        jsonify(
            {
                "status": "success",
                "message": "Tokens retrieved.",
                "current_tokens": user_tokens,
                "game_state": game.serialize(),
                "game_state_hint": "TOKENS_RETRIEVED",
            }
        ),
        200,
    )


# 6
@app.route("/api/get_game_data", methods=["GET"])
@login_required
@load_game_state
@api_error_handler
def get_game_data(user, game):

    return (
        jsonify(
            {
                "status": "success",
                "message": "Game data retrieved.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "GAME_DATA_RETRIEVED",
            }
        ),
        200,
    )


# 7
@app.route("/api/start_game", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def start_game(user, game):
    game.initialize_new_round()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "New round initialized.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "NEW_ROUND_INITIALIZED",
            }
        ),
        200,
    )


# 8
@app.route("/api/create_deck", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def create_deck(user, game):
    game.create_deck()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Deck created.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "DECK_CREATED",
            }
        ),
        200,
    )


# 9
@app.route("/api/ins_request", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def ins_request(user, game):
    bet = game.get_bet()
    insurance_amount = math.ceil(bet / 2)

    if user.tokens < insurance_amount:
        # Error válasz, ha nincs elég token.
        # A 402-es státuszkód (Payment Required) is használható ilyen esetekben.
        return (
            jsonify(
                {
                    "status": "error",
                    "error": "Insufficient tokens.",
                    "game_state_hint": "INSUFFICIENT_FUNDS",
                    "required": insurance_amount,
                    "available": user.tokens,
                    "game_state": game.serialize(),
                }
            ),
            402,
        )
    ins = game.insurance_request()
    user.tokens += ins
    db.session.commit()  # Elmentjük a módosítást az adatbázisba!

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Insurance placed successfully.",
                "insurance_amount": insurance_amount,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "INSURANCE_PROCESSED",
            }
        ),
        200,
    )


# 10
@app.route("/api/rewards", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def rewards(user, game):
    token_change = game.rewards()

    user.tokens += token_change
    db.session.commit()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Rewards processed and tokens updated.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "REWARDS_PROCESSED",
            }
        ),
        200,
    )


# 11
@app.route("/api/hit", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def hit(user, game):
    game.hit()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "tokens": user.tokens,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "HIT_RECIEVED",
            }
        ),
        200,
    )


# 12
@app.route("/api/stand", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def stand(user, game):
    game.stand()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "STAND_RECIEVED",
                "tokens": user.tokens,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "PLAYER_STAND_ROUND_ENDED",
            }
        ),
        200,
    )


# 13
@app.route("/api/round_end", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def round_end(user, game):
    game.round_end()

    message_for_client = "Round ended and game state reset, ready for a new round."
    status_hint_for_client = "ROUND_ENDED_GAME_RESET"

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": message_for_client,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": status_hint_for_client,
            }
        ),
        200,
    )


# 14
@app.route("/api/double_request", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def double_request(user, game):
    user.last_activity = datetime.now(timezone.utc)

    bet_amount_to_double = game.get_bet()

    if user.tokens < bet_amount_to_double:
        # Error válasz, ha nincs elég token.
        # A 402-es státuszkód (Payment Required) is használható ilyen esetekben.
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

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Double placed successfully.",
                "double_amount": amount_deducted,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
            }
        ),
        200,
    )


# 15
@app.route("/api/split_request", methods=["POST"])
@login_required
@load_game_state
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

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "split_amount": bet_amount,
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "SPLIT_SUCCESS",
            }
        ),
        200,
    )


# 16
@app.route("/api/add_to_players_list_by_stand", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def add_to_players_list_by_stand(user, game):
    user.last_activity = datetime.now(timezone.utc)

    game.add_to_players_list_by_stand()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 17
@app.route("/api/add_split_player_to_game", methods=["POST"])
@login_required
@load_game_state
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

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 18
@app.route("/api/add_player_from_players", methods=["POST"])
@login_required
@load_game_state
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

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 19
@app.route("/api/set_restart", methods=["POST"])
@login_required
@load_game_state
@api_error_handler
def set_restart(user, game):
    game.restart_game()

    user.tokens = 1000
    db.session.commit()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
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

    # A játék egy új, alapértelmezett állapotból indul,
    # mivel a régi játékállapot (pl. a bet) elveszett a sessionnel együtt.
    game = Game()
    game.restart_game()

    # A frissített játékállapot mentése a sessionbe.
    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "current_tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "HIT_RESTART",
            }
        ),
        200,
    )


# 21
@app.route("/error_page", methods=["GET"])
def error_page():
    return render_template("error.html")


if __name__ == "__main__":
    # Győződjön meg róla, hogy az adatbázis táblái létrejönnek.
    # EZ FONTOS FEJLESZTÉSI CÉLRA, HOGY A SÉMA SZINKRONBAN LEGYEN A MODELLJEKKEL.
    # A 'db.create_all()' létrehozza a táblákat, ha még nem léteznek.
    # Ha a táblák már léteznek, nem történik semmi (nem módosítja, nem törli).
    # Éles környezetben (produkcióban) erre adatbázis migráló eszközöket (pl. Alembic) használnak!
    with app.app_context():  # <<-- Ez a Flask alkalmazás környezetét állítja be
        db.create_all()  # <<-- Ez hozza létre az adatbázis tábláit (ha még nincsenek)
        #       a User osztályod definíciója alapján, beleértve a client_id-t is.
        # print("Adatbázis táblák ellenőrizve/létrehozva (fejlesztési mód).")

        # Opcionális: Ellenőrizzük, hogy van-e már legalább egy felhasználó az adatbázisban.
        # Ha nincs, létrehozunk egy alapértelmezett tesztfelhasználót 1000 tokennel.
        # Ez segít a legelső indításkor, hogy legyen egy kiinduló felhasználó a játékhoz.
        if not User.query.first():  # Lekérdezi az első felhasználót a DB-ből
            test_user = (
                User()
            )  # Létrehoz egy új User példányt (ez generálja az ID-t és a client_id-t is)
            db.session.add(test_user)  # Hozzáadja a felhasználót a sessionhöz
            db.session.commit()  # Elmenti a felhasználót az adatbázisba
            # print(
            #    f"Létrehozva egy inicializált felhasználó ezzel az azonosítóval: {test_user.id}"
            # )

    # A Flask alkalmazás futtatása debug módban.
    # 'debug=True' automatikusan újraindítja a szervert a kódváltozásokra, és részletes hibaüzeneteket ad.
    # 'port=5000' explicit módon beállítja a portot.
    app.run(debug=True, port=5000)
