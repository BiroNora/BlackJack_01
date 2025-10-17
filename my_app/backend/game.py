import math
import random

from collections import Counter
from typing import Any, Dict

from hand_state import HandState
from winner_state import WinnerState

NONE = 0


class Game:
    def __init__(self):
        self.player: Dict[str, Any] = {
            "id": NONE,
            "hand": [],
            "sum": 0,
            "hand_state": HandState.NONE,
            "can_split": False,
            "stated": False,
            "bet": 0,
            "aces": False,
        }
        self.dealer_masked: Dict[str, Any] = {
            "hand": [],
            "sum": 0,
            "can_insure": False,
            "nat_21": WinnerState.NONE,  # Only 1/2/0
        }
        self.dealer_unmasked: Dict[str, Any] = {
            "hand": [],
            "sum": 0,
            "hand_state": HandState.NONE,
            "natural_21": WinnerState.NONE,
        }
        self.natural_21 = WinnerState.NONE
        self.winner = WinnerState.NONE
        self.hand_counter: int = 0  # helper for the players dict
        self.players_index = {}  # helper for the players dict
        self.players: Dict[str, Dict[str, Any]] = {}
        self.stated = False
        self.split_req: int = 0
        self.suits = ["♥", "♦", "♣", "♠"]
        # self.ranks = ["A", "K", "Q", "J", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
        self.ranks = ["A", "K", "Q", "J", "9"]
        self.deck = []
        self.deck_len = 104
        self.bet: int = 0
        self.bet_list = []
        self.is_round_active = False

    def initialize_new_round(self):
        self.clear_up()
        # card1 = self.deck.pop(0)
        card2 = self.deck.pop(0)
        # card3 = self.deck.pop(0)
        card4 = self.deck.pop(0)
        # card2 = "♦10"
        # card4 = "♠A"
        card1 = "♦A"
        card3 = "♠A"
        player_hand = [card1, card3]
        dealer_hand = [card2, card4]
        dealer_masked = [" ✪ ", card4]
        # dealer_masked = [" ✪ ", card4]
        # dealer_hand = [card2, card4]
        # dealer_masked = [" ✪ ", card4]

        player_sum = self.sum(player_hand, True)
        dealer_masked_sum = self.sum([card4], False)
        dealer_unmasked_sum = self.sum(dealer_hand, False)

        self.natural_21 = self.init_natural_21_state(player_hand, dealer_hand)
        nat_21 = WinnerState.NONE
        if (
            self.natural_21 == WinnerState.BLACKJACK_PLAYER_WON
            or self.natural_21 == WinnerState.BLACKJACK_PUSH
        ):
            nat_21 = self.natural_21

        can_split = self.can_split(player_hand)
        can_insure = card4[-1] == "A"

        dealer_unmasked_state = self.hand_state(dealer_unmasked_sum, False)

        bet = self.get_bet()
        self.is_round_active = True

        aces = True if card1[-1] == "A" and card3[-1] == "A" else False

        self.player = {
            "id": self._generate_sequential_id(),
            "hand": player_hand,
            "sum": player_sum,
            "hand_state": HandState.NONE,
            "can_split": can_split,
            "stated": self.stated,
            "bet": bet,
            "aces": aces,
        }
        self.dealer_masked: Dict[str, Any] = {
            "hand": dealer_masked,
            "sum": dealer_masked_sum,
            "can_insure": can_insure,
            "nat_21": nat_21,  # Only 1/2/0
        }
        self.dealer_unmasked: Dict[str, Any] = {
            "hand": dealer_hand,
            "sum": dealer_unmasked_sum,
            "hand_state": dealer_unmasked_state,
            "natural_21": self.natural_21,
        }

    def sum(self, hand, is_player):
        ranks = self.hand_to_ranks(hand)
        counts = Counter(ranks)
        nums_of_ace = counts["A"]
        res = 0
        BLACKJACK_LIMIT = 21
        for rank in ranks:
            if rank in ["K", "Q", "J", "0"]:
                res += 10
            elif rank.isdigit():
                res += int(rank)
        if nums_of_ace > 0:
            for _ in range(nums_of_ace):
                if res + 11 <= BLACKJACK_LIMIT:
                    res += 11
                else:
                    res += 1
        if is_player:
            self.set_player_sum(res)
        else:
            self.set_dealer_sum(res)

        return res

    def init_natural_21_state(self, player_hand, dealer_hand):
        player_natural = self.sum(player_hand, True) == 21 and len(player_hand) == 2
        dealer_natural = self.sum(dealer_hand, False) == 21 and len(dealer_hand) == 2

        if player_natural and dealer_natural:
            self.natural_21 = WinnerState.BLACKJACK_PUSH
        elif player_natural:
            self.natural_21 = WinnerState.BLACKJACK_PLAYER_WON
        elif dealer_natural:
            self.natural_21 = WinnerState.BLACKJACK_DEALER_WON
        else:
            self.natural_21 = WinnerState.NONE

        return self.natural_21

    def hand_state(self, count, is_player):
        if count > 21:
            state = HandState.BUST
        elif count == 21:
            state = HandState.TWENTY_ONE
        else:
            state = HandState.UNDER_21

        if is_player and (
            self.natural_21 == WinnerState.BLACKJACK_PLAYER_WON
            or self.natural_21 == WinnerState.BLACKJACK_PUSH
        ):
            state = HandState.BLACKJACK

        if not is_player and (
            self.natural_21 == WinnerState.BLACKJACK_DEALER_WON
            or self.natural_21 == WinnerState.BLACKJACK_PUSH
        ):
            state = HandState.BLACKJACK

        return state

    def winner_state(self):
        player = self.player["sum"]
        dealer = self.dealer_unmasked["sum"]

        if player > 21:
            self.winner = WinnerState.PLAYER_LOST

        elif dealer > 21:
            self.winner = WinnerState.PLAYER_WON

        elif player == dealer:
            self.winner = WinnerState.PUSH

        elif player > dealer:
            self.winner = WinnerState.PLAYER_WON

        else:
            self.winner = WinnerState.DEALER_WON

        return self.winner

    def hit(self):
        if not self.is_round_active:
            return
        new_card = self.deck.pop(0)
        self.set_player_hand(new_card)

        self.player["sum"] = self.sum(self.player["hand"], True)

    def stand(self):
        count = self.sum(self.dealer_unmasked["hand"], False)
        if self.sum(self.player["hand"], True) <= 21:
            while count < 17:
                card = self.deck.pop(0)
                self.dealer_unmasked["hand"].append(card)
                count = self.sum(self.dealer_unmasked["hand"], False)
                self.dealer_unmasked["sum"] = count

        self.dealer_unmasked["hand_state"] = self.hand_state(count, False)
        self.player["hand_state"] = self.hand_state(self.player["sum"], True)
        self.winner = NONE
        self.winner = self.winner_state()

    def rewards(self) -> int:
        bet = self.player["bet"]
        natural_21_scenario = self.dealer_unmasked["natural_21"]
        reward_amount = 0  # Alapértelmezett érték: 0 (veszteség)

        if self.natural_21 == 1:
            reward_amount = math.floor(bet * 2.5)  # Eredeti tét + 1.5x nyeremény
        elif self.winner == 6 and natural_21_scenario != 3:
            reward_amount = bet * 2  # Eredeti tét + 1x nyeremény
        elif (
            self.winner == 4 and natural_21_scenario != 3
        ) or natural_21_scenario == 2:
            reward_amount = bet

        self.set_bet_to_null()
        self.is_round_active = False

        return reward_amount

    def retake_bet_from_bet_list(self):
        if len(self.bet_list) != 0:
            bet = self.bet_list.pop()
            self.set_bet(-bet)
            return bet
        else:
            return 0

    def insurance_request(self):
        bet = self.bet
        ins_cost = math.ceil(self.bet / 2)

        if self.dealer_unmasked["natural_21"] == 3:
            self.set_bet_to_null()
            self.is_round_active = False
            self.player["hand_state"] = self.hand_state(self.player["sum"], True)

        return bet if self.natural_21 == 3 else -ins_cost

    def double_request(self):
        self.player["bet"] += self.bet

        return self.bet

    def split_hand(self):
        if not self.can_split(self.player["hand"]) or len(self.players) > 3:
            return

        old_id = self.player["id"]
        card_to_split = self.player["hand"].pop(0)
        new_hand1 = [card_to_split]
        new_hand2 = [self.player["hand"].pop()]
        aces = self.player["aces"]

        new_id_B = self._generate_sequential_id()
        new_hand = self.deal_card(new_hand1, True, hand_id=old_id, aces=aces)
        hand_to_list = self.deal_card(new_hand2, False, hand_id=new_id_B, aces=aces)

        self.player = new_hand
        self.players[hand_to_list["id"]] = hand_to_list

        self.set_split_req(1)

    def deal_card(self, hand, is_first, hand_id, aces):
        if self.deck and is_first:
            hand.append(self.deck.pop(0))

        player_sum = self.sum(hand, True)
        can_split = self.can_split(hand)
        player_state = self.hand_state(player_sum, True) if is_first else 10
        player = {
            "id": hand_id,
            "hand": hand,
            "sum": player_sum,
            "hand_state": player_state,
            "can_split": can_split,
            "stated": self.stated,
            "bet": self.bet,
            "aces": aces,
        }

        return player

    def add_to_players_list_by_stand(self):
        is_active = any(
            hand_data.get("stated") is False for hand_data in self.players.values()
        )

        if is_active:
            self.player["stated"] = True
            self.players[self.player["id"]] = self.player

    def find_smallest_true_stated_id(self):
        if not self.players:
            return None

        try:
            true_stated_ids = (
                hand_id
                for hand_id, hand_data in self.players.items()
                if hand_data.get("stated") == False
            )

            smallest_true_id = min(true_stated_ids)

            return smallest_true_id

        except ValueError:
            return None

    def add_split_player_to_game(self):
        if not self.players:
            return None

        if self.players:
            hand_id = self.find_smallest_true_stated_id()
            self.player = self.players.pop(hand_id)

            if self.deck:
                card = self.deck.pop(0)
                self.set_player_hand(card)
                hand = self.player["hand"]
                player_sum = self.sum(hand, True)
                can_split = self.can_split(hand)
                self.player["sum"] = player_sum
                self.player["hand_state"] = self.hand_state(player_sum, True)
                self.player["can_split"] = can_split
            self.set_split_req(-1)

        return self.player

    def add_player_from_players(self):
        if not self.players:
            return

        first_id = list(self.players.keys())[0]
        self.player = self.players.pop(first_id)

        return self.player

    def create_deck(self):
        single_deck = [f"{suit}{rank}" for suit in self.suits for rank in self.ranks]
        self.deck = single_deck * 2
        random.shuffle(self.deck)

        return self.deck

    # helpers
    def _generate_sequential_id(self) -> str:
        self.hand_counter += 1
        formatted_count = f"{self.hand_counter:03d}"

        return f"H-{formatted_count}"

    def sort_key_combined(self, hand):
        # False (asc) < True (asc)
        stated_status = hand.get("stated", True)
        hand_id = hand.get("id", "")

        return (stated_status, hand_id)

    def clear_up(self):
        self.player = {
            "id": NONE,
            "hand": [],
            "sum": 0,
            "hand_state": HandState.NONE,
            "can_split": False,
            "stated": False,
            "bet": 0,
            "aces": False,
        }
        self.dealer_masked: Dict[str, Any] = {
            "hand": [],
            "sum": 0,
            "can_insure": False,
            "nat_21": WinnerState.NONE,
        }
        self.dealer_unmasked: Dict[str, Any] = {
            "hand": [],
            "sum": 0,
            "hand_state": HandState.NONE,
            "natural_21": WinnerState.NONE,
        }
        self.natural_21 = WinnerState.NONE
        self.winner = WinnerState.NONE
        self.hand_counter = 0
        self.players = {}
        self.split_req = 0
        self.set_bet_list_to_null()
        self.is_round_active = False

    def restart_game(self):
        self.__init__()

    def hand_to_ranks(self, hand):
        return "".join(c[-1] for c in hand)

    def can_split(self, hand):
        ranks = self.hand_to_ranks(hand)
        tens = ["K", "Q", "J", "0"]
        return len(ranks) == 2 and (
            (ranks[0] == ranks[1]) or (ranks[0] in tens and ranks[1] in tens)
        )

    def load_state_from_data(self, data):
        self.is_round_active = data.get("is_round_active", False)

    # getters, setters
    def set_player_hand(self, card):
        self.player["hand"].append(card)

    def set_player_sum(self, sum):
        self.player["sum"] = sum

    def set_dealer_sum(self, sum):
        self.dealer_masked["sum"] = sum

    def get_player_state(self):
        return self.player["hand_state"]

    def set_player_state(self, state):
        self.player["hand_state"] = state

    def get_dealer_state(self):
        return self.dealer_unmasked["hand_state"]

    def set_dealer_state(self, state):
        self.dealer_unmasked["hand_state"] = state

    def get_players(self):
        return self.players

    def set_bet(self, amount):
        self.bet += amount
        self.player["bet"] = self.player["bet"] + amount

    def set_bet_to_null(self):
        self.bet = 0
        self.player["bet"] = 0

    def get_bet(self):
        return self.bet

    def get_bet_list(self):
        return self.bet_list

    def set_bet_list(self, bet):
        self.bet_list.append(bet)

    def set_bet_list_to_null(self):
        self.bet_list = []

    def get_split_req(self):
        return self.split_req

    def set_split_req(self, count):
        self.split_req += count

    def get_deck_len(self):
        if len(self.deck) > 0:
            return len(self.deck)
        else:
            return self.deck_len

    def get_is_round_active(self):
        return self.is_round_active

    def serialize(self):
        all_hands = list(self.players.values())

        def sort_key_combined(hand):
            return (hand.get("hand_stated", True), hand.get("id", ""))

        sorted_players_list = sorted(all_hands, key=sort_key_combined)

        return {
            "deck": self.deck,
            "player": self.player,
            "dealer_masked": self.dealer_masked,
            "dealer_unmasked": self.dealer_unmasked,
            "natural_21": self.natural_21,
            "winner": self.winner,
            "hand_counter": self.hand_counter,
            "players": sorted_players_list,
            "splitReq": self.split_req,
            "deckLen": self.get_deck_len(),
            "bet": self.bet,
            "bet_list": self.bet_list,
            "is_round_active": self.is_round_active,
        }

    @classmethod
    def deserialize(cls, data):
        game = cls()
        game.deck = data["deck"]
        game.player = data["player"]
        game.dealer_masked = data["dealer_masked"]
        game.dealer_unmasked = data["dealer_unmasked"]
        game.natural_21 = data["natural_21"]
        game.winner = data["winner"]
        game.hand_counter = data["hand_counter"]
        game.players = {hand["id"]: hand for hand in data["players"]}
        game.split_req = data["splitReq"]
        game.deck_len = data["deckLen"]
        game.bet = data["bet"]
        game.bet_list = data["bet_list"]
        game.is_round_active = data.get("is_round_active", False)
        return game
