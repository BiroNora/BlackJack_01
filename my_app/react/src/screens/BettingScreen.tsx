// src/screens/BettingScreen.tsx
import React from "react";
import { motion, type Variants } from "motion/react";
import { formatNumber } from "../utilities/utils";
import Cards from "../components/Cards";
import type { GameStateData } from "../types/game-types";

interface BettingScreenProps {
  gameState: GameStateData;
  onPlaceBet: (amount: number) => void;
  retakeBet: () => void;
  onStartGame: (shouldShuffle: boolean) => void;
  tokens: number;
  bet: number;
  betAmounts: number[];
  isDisabled: boolean;
  showButtons: boolean;
  variants: Variants;
  textVariants: Variants;
}

const BettingScreen: React.FC<BettingScreenProps> = ({
  gameState,
  onPlaceBet,
  retakeBet,
  onStartGame,
  tokens,
  bet,
  betAmounts,
  isDisabled,
  showButtons,
  variants,
  textVariants,
}) => {
  const handleAllIn = () => onPlaceBet(tokens);

  return (
    <div className="betting-screen-container">
      <Cards gameState={gameState} /> {/* Itt hívod meg a Cards komponenst */}
      <motion.button
        id="start-button"
        onClick={() =>
          onStartGame(gameState.deckLen === 0 || gameState.deckLen < 60)
        }
        disabled={isDisabled}
        variants={variants}
        animate={isDisabled ? "disabled" : "enabled"}
      >
        <motion.span variants={textVariants}>Start Game</motion.span>
      </motion.button>
      <div id="deal-bank" className="deal-bank">
        <motion.button
          id="deal-button"
          onClick={retakeBet}
          disabled={isDisabled}
          variants={variants}
          animate={isDisabled ? "disabled" : "enabled"}
        >
          <motion.span variants={textVariants}>
            Bet: {"  " + formatNumber(bet)}
          </motion.span>
        </motion.button>
      </div>
      <div id="bank" className="bank merriweather">
        Player's bank:{" "}
        <span className="bank-amount">{formatNumber(tokens)}</span>
      </div>
      <div
        id="chips"
        className={`button-container ${showButtons ? "show-buttons" : ""}`}
      >
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
            {formatNumber(amount)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BettingScreen;
