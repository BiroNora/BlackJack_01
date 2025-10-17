from enum import IntEnum


class HandState(IntEnum):
    """A hand aktuális játékállapotát jelöli."""

    NONE = 0
    # Lejátszható állapotok
    UNDER_21 = 10

    # Végállapotok
    BLACKJACK = 11  # Eredeti 2 lapos Black Jack
    TWENTY_ONE = 8  # Splitelt vagy többlapos 21
    BUST = 9
