from functools import wraps
import math
import os
from sqlalchemy import select
from flask import Flask, json, jsonify, render_template, request, session
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import uuid
import logging

from game import Game

MINIMUM_BET = 1

TWENTY_ONE = 8
BUST = 9
UNDER_21 = 10


app = Flask(__name__,
    static_folder='../react/dist',
    template_folder='../react/dist'
)
app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY", "default-dev-secret-key-NEVER-USE-IN-PROD"
)
# Session permanencia beállítása
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=31)  # Például 31 nap
app.config["SESSION_COOKIE_SECURE"] = False


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
            session.pop("game", None)
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
            session.pop("game", None)
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
def game_session_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        game_data = session.get("game")
        if not game_data:
            return (
                jsonify(
                    {
                        "error": "ERROR: No game active.",
                        "game_state_hint": "NO_GAME_ACTIVE",
                    }
                ),
                400,
            )

        game = Game.deserialize(game_data)
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


@app.route("/")
def index():
    return render_template("index.html")


# 0
@app.route("/api/initialize_session", methods=["POST"])
@api_error_handler
def initialize_session():
    """
    Ez az útvonal biztosítja, hogy a felhasználói session inicializálva legyen.
    Ha van már 'user_id' a sessionben, azt használja.
    Ha nincs, akkor a kliens által küldött egyedi 'client_id' alapján keres egy létező felhasználót az adatbázisban.
    Ha a 'client_id' alapján sem talál felhasználót, akkor létrehoz egy újat,
    és elmenti az új felhasználó vagy az azonosított felhasználó ID-ját a sessionbe.
    """
    data = request.get_json()  # Lekérjük a JSON adatot a kérés testéből
    client_id_from_request = data.get("client_id")  # Lekérjük a client_id-t a kérésből

    user_id_in_session = session.get(
        "user_id"
    )  # Lekérjük a user_id-t a Flask sessionből
    user = None

    # 1. Ellenőrizzük, hogy a Flask session már aktív-e és érvényes-e
    if user_id_in_session:
        user = db.session.get(User, user_id_in_session)
        if user:
            pass
        else:
            session.pop("user_id", None)

    # 2. Ha még nincs felhasználó (az előző lépés alapján), és kaptunk client_id-t a kérésből,
    # próbáljuk azonosítani a client_id alapján a DB-ben
    if not user and client_id_from_request:
        stmt = select(User).filter_by(client_id=client_id_from_request)
        user = db.session.execute(stmt).scalar_one_or_none()

        if not user:
            user = User(client_id=client_id_from_request)
            db.session.add(user)
            db.session.commit()

    # 3. Ha még mindig nincs felhasználó (se sessionből, se client_id-ból),
    # akkor ez egy teljesen új kliens, létrehozunk egy teljesen új felhasználót
    if not user:
        user = (
            User()
        )  # Létrehozunk egy teljesen új felhasználót (az ID-ja és client_id-ja ekkor generálódik)
        db.session.add(user)
        db.session.commit()

    user.last_activity = datetime.now(timezone.utc)
    db.session.commit()

    # KULCSFONTOSSÁGÚ: Beállítjuk a felhasználó ID-ját a Flask sessionbe!
    # Ez a Flask-nek szól, hogy az aktuális és jövőbeli kérések ehhez a felhasználóhoz tartoznak.
    session["user_id"] = user.id
    session.permanent = True

    return (
        jsonify(
            {
                "status": "success",  # Hozzáadva a konzisztencia érdekében
                "message": "User session inicialized.",  # Általánosabb üzenet
                "user_id": user.id,
                "client_id": user.client_id,
                "tokens": user.tokens,  # === HOZZÁADVA: A felhasználó aktuális tokenjei ===
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
@game_session_required  # Ellenőrzi, hogy van-e aktív játék session
@api_error_handler
def get_deck_len(user, game):
    deck_len = game.get_deck_len()
    session["game"] = game.serialize()

    return jsonify({"deckLen": deck_len, "message": "message"}), 200


# 3
@app.route("/api/bet", methods=["POST"])
@login_required
@game_session_required
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
@game_session_required
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

    response_data_for_client = {
        "bet": game.bet,
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "bet_retaken": amount_to_return,
                "data": response_data_for_client,
                "game_state_hint": "BET_SUCCESSFULLY_RETRAKEN",
            }
        ),
        200,
    )


# 5
@app.route("/api/get_tokens_from_db", methods=["GET"])
@login_required
@game_session_required
@api_error_handler
def get_tokens_from_db(user, game):
    user_tokens = user.tokens

    return (
        jsonify(
            {
                "status": "success",
                "message": "Tokens retrieved.",
                "user_tokens": user_tokens,
                "game_state": game.serialize(),
                "game_state_hint": "TOKENS_RETRIEVED",
            }
        ),
        200,
    )


# 6
@app.route("/api/get_game_data", methods=["GET"])
@login_required
@game_session_required
@api_error_handler
def get_game_data(user, game):
    response_data_for_client = {
        "bet": game.bet,
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Game data retrieved.",
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "GAME_DATA_RETRIEVED",
            }
        ),
        200,
    )


# 7
@app.route("/api/start_game", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def start_game(user, game):
    game.initialize_new_round()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "New round initialized.",
                "game_state": game.serialize(),
                "game_state_hint": "NEW_ROUND_INITIALIZED",
            }
        ),
        200,
    )


# 8
@app.route("/api/create_deck", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def create_deck(user, game):
    game.create_deck()

    session["game"] = game.serialize()

    return (
        jsonify(
            {
                "status": "success",
                "message": "Deck created.",
                "game_state": game.serialize(),
                "game_state_hint": "DECK_CREATED",
            }
        ),
        200,
    )


# 9
@app.route("/api/ins_request", methods=["POST"])
@login_required
@game_session_required
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

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    # Visszaadjuk a frissített adatokat
    return (
        jsonify(
            {
                "status": "success",
                "message": "Insurance placed successfully.",
                "insurance_amount": insurance_amount,
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "INSURANCE_PROCESSED",
            }
        ),
        200,
    )


# 10
@app.route("/api/rewards", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def rewards(user, game):
    data = request.get_json()
    is_splitted = data.get("is_splitted", False)

    token_change = game.rewards(is_splitted)

    user.tokens += token_change
    db.session.commit()

    session["game"] = game.serialize()

    response_data_for_client = {
        "bet": game.bet,  # A tét, ami valószínűleg már 0 (nullázódott) a rewards() után
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Rewards processed and tokens updated.",
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "REWARDS_PROCESSED",
            }
        ),
        200,
    )


# 11
@app.route("/api/hit", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def hit(user, game):
    game.hit()

    session["game"] = game.serialize()

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "HIT_RECIEVED",
            }
        ),
        200,
    )


# 12
@app.route("/api/stand", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def stand(user, game):
    game.stand()

    session["game"] = game.serialize()

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "STAND_RECIEVED",
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "PLAYER_STAND_ROUND_ENDED",
            }
        ),
        200,
    )


# 13
@app.route("/api/round_end", methods=["POST"])
@login_required
@game_session_required
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
                "tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": status_hint_for_client,
            }
        ),
        200,
    )


# 14
@app.route("/api/double_request", methods=["POST"])
@login_required
@game_session_required
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

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Double placed successfully.",
                "double_amount": amount_deducted,
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
            }
        ),
        200,
    )


# 15
@app.route("/api/split_request", methods=["POST"])
@login_required
@game_session_required
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

    if not game.can_split(game.player[0]):
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

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "split_amount": bet_amount,
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "SPLIT_SUCCESS",
            }
        ),
        200,
    )


# 16
@app.route("/api/add_to_list_by_stand", methods=["POST"])
@login_required
@game_session_required
@api_error_handler
def add_to_players_list_by_stand(user, game):
    user.last_activity = datetime.now(timezone.utc)

    game.add_to_players_list_by_stand()

    session["game"] = game.serialize()

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 17
@app.route("/api/add_split_player_to_game", methods=["POST"])
@login_required
@game_session_required
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

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 18
@app.route("/api/add_player_from_players", methods=["POST"])
@login_required
@game_session_required
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

    response_data_for_client = {
        "bet": game.get_bet(),
        "betList": game.bet_list,
        "deckLen": game.get_deck_len(),
        "tokens": user.tokens,
        "player": game.player,
        "dealer": game.dealer,
    }

    return (
        jsonify(
            {
                "status": "success",
                "message": "Split hand placed successfully.",
                "tokens": user.tokens,
                "data": response_data_for_client,
                "game_state": game.serialize(),
                "game_state_hint": "NEXT_SPLIT_HAND_ACTIVATED",
            }
        ),
        200,
    )


# 19
@app.route("/api/set_restart", methods=["POST"])
@login_required
@game_session_required
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
                "tokens": user.tokens,
                "game_state": game.serialize(),
                "game_state_hint": "HIT_RESTART",
            }
        ),
        200,
    )


# 20
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
