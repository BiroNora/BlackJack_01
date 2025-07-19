import React, { useState } from "react";
import type { GameStateData } from "../types/game-types";
import "../styles/betting.css";

interface BettingScreenProps {
  gameState: GameStateData;
  onPlaceBet: (amount: number) => void;
  retakeBet: () => void;
}

const BettingScreen: React.FC<BettingScreenProps> = ({
  gameState,
  onPlaceBet,
  retakeBet,
}) => {
  const { tokens, bet, deckLen } = gameState;

  const betAmounts = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

  const handleAllIn = () => {
    onPlaceBet(tokens);
  };

  return (
    <div className="betting-screen-container">
      <div className="cards" id="cards">
        Cards: {deckLen}
      </div>

      <button id="start-button" disabled={bet === 0}>Start Game</button>

      <div id="deal-bank" className="deal-bank">
        <button id="deal-button" disabled={bet === 0} onClick={() => retakeBet()}>
          Bet: {bet}
        </button>
        <div id="bank">Tokens: {tokens}</div>
      </div>

      <div id="chips" className="chips">
        <button
          id="all-in"
          type="button"
          onClick={handleAllIn}
          disabled={tokens === 0}
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
            disabled={tokens < amount}
          >
            {amount.toLocaleString("hu-HU")}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BettingScreen;
