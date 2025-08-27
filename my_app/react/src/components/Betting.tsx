import type { GameStateData } from "../types/game-types";
import "../styles/betting.css";
import { formatNumber } from "../utilities/utils";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

interface BettingProps {
  gameState: GameStateData;
  onPlaceBet: (amount: number) => void;
  retakeBet: () => void;
  onStartGame: (shouldShuffle: boolean) => void;
}

const Betting: React.FC<BettingProps> = ({
  gameState,
  onPlaceBet,
  retakeBet,
  onStartGame,
}) => {
  const { tokens, bet, deckLen } = gameState;

  const [showButtons, setShowButtons] = useState(false);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutIdRef.current = window.setTimeout(() => {
      setShowButtons(true);
    }, 1000); // 1000 ms = 1 másodperc késleltetés

    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const betAmounts = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

  const handleAllIn = () => {
    onPlaceBet(tokens);
  };

  const handleStartGame = async () => {
    const shouldShuffle = deckLen === 0 || deckLen === 104 || deckLen < 60;
    onStartGame(shouldShuffle);
  };

  const isDisabled = bet === 0;

  const variants = {
    disabled: {
      opacity: 0.7,
      scale: 1,
      transition: {
        duration: 0.7,
      },
    },
    enabled: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.7,
      },
    },
  };

  const textVariants = {
    disabled: {
      opacity: 0.4,
      scale: 1,
      transition: {
        duration: 1,
      },
    },
    enabled: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 1,
      },
    },
  };

  return (
    <div className="betting-screen-container">
      <motion.button
        id="start-button"
        onClick={handleStartGame}
        disabled={isDisabled}
        variants={variants}
        animate={isDisabled ? "disabled" : "enabled"}
      >
        <motion.span variants={textVariants}>Start Game</motion.span>
      </motion.button>

      <div id="deal-bank" className="deal-bank">
        <motion.button
          id="deal-button"
          onClick={() => retakeBet()}
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

export default Betting;
