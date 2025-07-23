import math
import random

from collections import Counter

BLACKJACK_PLAYER_WON = 1
BLACKJACK_PUSH = 2
BLACKJACK_DEALER_WON = 3
PUSH = 4
PLAYER_LOST = 5
PLAYER_WON = 6
DEALER_WON = 7
TWENTY_ONE = 8
BUST = 9
UNDER_21 = 10
NONE = 0


class Game:
    def __init__(self):
        self.deck = []
        self.deck_len = 104
        self.player = [[], 0, NONE, False, False, 0, NONE]
        # 0 player, 1 sum, 2 state, 3 can_split, 4 self.stated, 5 bet, 6 natural_21 in split
        self.players = []
        self.stated = False
        self.player_state = NONE
        self.dealer = [[], [], 0, NONE, False, NONE]
        # 0 dealer_masked, 1 dealer, 2 sum, 3 state, 4 can_insure, 5 natural_21
        self.dealer_hand = []
        self.dealer_state = NONE
        self.player_sum = 0
        self.dealer_sum = 0
        self.natural_21 = NONE
        self.split_natural_21 = NONE
        self.winner = NONE
        self.split_req = 0
        self.suits = ["♥", "♦", "♣", "♠"]
        self.ranks = ["A", "K", "Q", "J", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
        # self.ranks = ["A", "K", "Q", "J", "10"]
        self.bet = 0
        self.bet_list = []
        self.is_round_active = False

    def create_deck(self):
        single_deck = [f"{suit}{rank}" for suit in self.suits for rank in self.ranks]
        self.deck = single_deck * 2
        random.shuffle(self.deck)

        return self.deck

    def initialize_new_round(self):
        self.dealer_hand = []
        self.dealer = [[], [], 0, NONE, False, NONE]
        self.player = [[], 0, NONE, False, False, 0, NONE]
        self.split_req = 0
        self.players = []
        self.bet_list = []
        # card1 = self.deck.pop(0)
        # card2 = self.deck.pop(0)
        # card3 = self.deck.pop(0)
        # card4 = self.deck.pop(0)
        player_hand = ["♥10", "♣K"]
        dealer_hand = ["♥2", "♥A"]
        # PLAYER
        # [[], 0, NONE, False, False, 0, 0]
        # 0 player, 1 sum, 2 state, 3 can_split, 4 checked, 5 bet, 6 tokens
        # player_hand = [card1, card3]
        # DEALER
        # [[], [], 0, NONE, False]
        # 0 dealer_masked, 1 dealer, 2 sum, 3 state, 4 can_insure, 5 natural_21
        # dealer_hand = [card2, card4]
        self.dealer_hand = dealer_hand
        dealer_masked = ["✪ ", "♥A"]

        player_sum = self.sum(player_hand, True)
        dealer_sum = self.sum(dealer_hand, False)

        player_state = self.state(player_sum)
        dealer_state = self.state(dealer_sum)

        can_split = self.can_split(player_hand)
        can_insure = self.can_insure(dealer_hand)

        natural_21 = self.natural_21_state(player_hand, dealer_hand)
        bet = self.get_bet()

        self.player = [
            player_hand,
            player_sum,
            player_state,
            can_split,
            self.stated,
            bet,
            self.natural_21,
        ]
        self.dealer = [
            dealer_masked,
            dealer_hand,
            dealer_sum,
            dealer_state,
            can_insure,
            natural_21,
        ]
        self.is_round_active = True

    def load_state_from_data(self, data):
        self.is_round_active = data.get("is_round_active", False)

    def set_player_to_null(self):
        self.player = []

    def set_player_hand(self, card):
        self.player[0].append(card)

    def set_player_sum(self, sum):
        self.player[1] = sum

    def set_dealer_sum(self, sum):
        self.dealer[2] = sum

    def get_player_state(self):
        return self.player[2]

    def set_player_state(self, state):
        self.player[2] = state

    def get_dealer_state(self):
        return self.dealer[3]

    def set_dealer_state(self, state):
        self.dealer[3] = state

    def get_players(self):
        return self.players

    def set_bet(self, amount):
        self.bet += amount
        self.player[5] = self.player[5] + amount

    def set_bet_to_null(self):
        self.bet = 0
        self.player[5] = 0

    def get_bet(self):
        return self.bet

    def get_tokens(self):
        return self.user_tokens

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
        return len(self.deck)

    def get_is_round_active(self):
        return self.is_round_active

    def round_end(self):
        self.set_bet_list_to_null()
        self.set_bet_to_null()
        self.player = [[], 0, NONE, False, False, 0, NONE]
        self.dealer = [[], [], 0, NONE, False, NONE]
        self.players = []
        self.split_req = 0
        self.winner = NONE
        self.stated = False
        self.player_state = NONE
        self.is_round_active = False

    def restart_game(self):
        self.__init__()

    def hand_to_ranks(self, hand):
        return "".join(c[-1] for c in hand)

    def can_insure(self, hand):
        ranks = self.hand_to_ranks(hand)
        return ranks[1] == "A"

    def can_split(self, hand):
        ranks = self.hand_to_ranks(hand)
        tens = ["K", "Q", "J", "0"]
        return len(ranks) == 2 and (
            (ranks[0] == ranks[1]) or (ranks[0] in tens and ranks[1] in tens)
        )

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
            self.set_player_state(self.state(res))
        else:
            self.set_dealer_sum(res)
            self.set_dealer_state(self.state(res))

        return res

    def natural_21_state(self, player_hand, dealer_hand):
        player_natural = self.sum(player_hand, True) == 21 and len(player_hand) == 2
        dealer_natural = self.sum(dealer_hand, False) == 21 and len(dealer_hand) == 2

        if player_natural and dealer_natural:
            self.natural_21 = BLACKJACK_PUSH
        elif player_natural:
            self.natural_21 = BLACKJACK_PLAYER_WON
        elif dealer_natural:
            self.natural_21 = BLACKJACK_DEALER_WON
        else:
            self.natural_21 = NONE

        return self.natural_21

    def state(self, count):
        state = TWENTY_ONE if count == 21 else BUST if count > 21 else UNDER_21

        return state

    def winner_state(self):
        player = self.player[1]
        dealer = self.dealer[2]

        if player > 21:
            self.winner = PLAYER_LOST
        elif player == dealer:
            self.winner = PUSH
        elif dealer > 21 or player > dealer:
            self.winner = PLAYER_WON
        else:
            self.winner = DEALER_WON

        return self.winner

    def rewards(self, is_splitted: bool) -> int:
        bet = self.player[5]
        print("264 BET: ", bet)
        winner = self.winner_state()
        natural_21_scenario = self.player[6] if is_splitted else self.dealer[5]

        reward_amount = 0  # Alapértelmezett érték: 0 (veszteség)

        if natural_21_scenario == 1:
            reward_amount = math.floor(bet * 2.5)  # Eredeti tét + 1.5x nyeremény
        elif winner == 6 and natural_21_scenario != 3:
            reward_amount = bet * 2  # Eredeti tét + 1x nyeremény
        elif (winner == 4 and natural_21_scenario != 3) or natural_21_scenario == 2:
            reward_amount = bet

        self.set_bet_to_null()
        print("278 reward_amount: ", reward_amount)
        return reward_amount

    def hit(self):
        if not self.is_round_active:
            return
        new_card = self.deck.pop(0)
        self.set_player_hand(new_card)

        self.sum(self.player[0], True)

    def stand(self):
        if self.sum(self.player[0], True) <= 21:
            count = self.sum(self.dealer[1], False)
            while count < 17:
                card = self.deck.pop(0)
                self.dealer[1].append(card)
                count = self.sum(self.dealer[1], False)

        return self.dealer

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
        if self.dealer[5] == 3:
            self.bet = 0

        return bet if self.dealer[5] == 3 else -ins_cost

    def double_request(self):
        self.player[5] += self.bet

        return self.bet

    def split_hand(self):
        if not self.can_split(self.player[0]) or len(self.players) > 3:
            return
        card_to_split = self.player[0].pop(0)
        new_hand1 = [card_to_split]
        new_hand2 = [self.player[0].pop()]
        new_hand = self.deal_card(new_hand1, True)
        hand_to_list = self.deal_card(new_hand2, False)
        self.player = new_hand
        self.players.insert(0, hand_to_list)
        self.set_split_req(1)

    def deal_card(self, hand, is_first):
        if self.deck and is_first:
            hand.append(self.deck.pop(0))
        player_sum = self.sum(hand, True)
        can_split = self.can_split(hand)
        player_state = self.state(player_sum)
        split_natural_21 = self.natural_21_state(hand, self.dealer_hand)
        player = [
            hand,
            player_sum,
            player_state,
            can_split,
            self.stated,
            self.bet,
            split_natural_21,
        ]

        return player

    def add_to_players_list_by_stand(self):
        if self.players[0][4] == False:
            self.player[4] = not self.stated
            self.players.append(self.player)
        else:
            self.player[4] = not self.stated
            self.players.insert(0, self.player)
        print("game 354 players: ", self.players)

        return self.players

    def add_split_player_to_game(self):
        self.player = self.players.pop(0)
        if self.deck:
            card = self.deck.pop(0)
            self.set_player_hand(card)
            hand = self.player[0]
            player_sum = self.sum(hand, True)
            can_split = self.can_split(hand)
            self.player[1] = player_sum
            self.player[2] = self.state(player_sum)
            self.player[3] = can_split
            self.player[6] = self.natural_21_state(hand, self.dealer_hand)
        self.set_split_req(-1)

        return self.player

    def add_player_from_players(self):
        self.player = self.players.pop(0)
        print("378 players: ", self.players)

    def serialize(self):
        return {
            "deck": self.deck,
            "player": self.player,
            "dealer": self.dealer,
            "dealer_hand": self.dealer_hand,
            "splitReq": self.split_req,
            "players": self.players,
            "bet": self.bet,
            "bet_list": self.bet_list,
            "winner": self.winner,
            "is_round_active": self.is_round_active,
            "deckLen": self.get_deck_len(),
        }

    @classmethod
    def deserialize(cls, data):
        game = cls()
        game.deck = data["deck"]
        game.player = data["player"]
        game.dealer = data["dealer"]
        game.dealer_hand = data["dealer_hand"]
        game.split_req = data["splitReq"]
        game.players = data["players"]
        game.bet = data["bet"]
        game.bet_list = data["bet_list"]
        game.winner = data["winner"]
        game.is_round_active = data.get("is_round_active", False)
        game.deck_len = data["deckLen"]
        return game
