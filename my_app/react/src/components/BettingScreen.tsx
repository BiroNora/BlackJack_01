import React from "react";
import type { GameStateData } from "../types/game-types";
import "../styles/betting.css";

interface BettingScreenProps {
  gameState: GameStateData;
  onPlaceBet: (amount: number) => void;
  onClearBet: () => void;
  onStartGame: () => void;
}

const BettingScreen: React.FC<BettingScreenProps> = ({
  gameState,
  onPlaceBet,
  onClearBet,
  onStartGame,
}) => {
  const { tokens, bet, deckLen } = gameState;

  const betAmounts = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

  const handleAllIn = () => {
    onPlaceBet(tokens);
  };

  const canPlaceAnyBet = tokens > 0;

  return (
    <div className="betting-screen-container">
      <div className="cards" id="cards">
        Cards: {deckLen}
      </div>

      <button id="start-button" onClick={onStartGame}>
        Start Game
      </button>

      <div id="deal-bank" className="deal-bank">
        <button id="deal-button" onClick={onClearBet} disabled={bet === 0}>
          Deal: {bet}
        </button>
        <div id="bank">Tokens: {tokens}</div>
      </div>

      <div id="chips" className="chips">
        <button
          id="all-in"
          type="button"
          onClick={handleAllIn}
          disabled={!canPlaceAnyBet}
        >
          All In
        </button>

        {betAmounts.map((amount) => (
          <button
            key={amount}
            id={String(amount)}
            type="button"
            data-bet={amount}
            onClick={() => onPlaceBet(amount)}
            disabled={tokens < amount || !canPlaceAnyBet}
          >
            {amount.toLocaleString("hu-HU")}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BettingScreen;
