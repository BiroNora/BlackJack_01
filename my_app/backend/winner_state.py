from enum import IntEnum


class WinnerState(IntEnum):
    """A kör kimenetelét vagy az eredményt jelöli."""
    NONE = 0

    # Black Jack eredmények (általában 3:2 kifizetés)
    BLACKJACK_PLAYER_WON = 1
    BLACKJACK_PUSH = 2
    BLACKJACK_DEALER_WON = 3

    # Általános kimenetelek (1:1 kifizetés)
    PUSH = 4
    PLAYER_LOST = 5
    PLAYER_WON = 6
    DEALER_WON = 7
