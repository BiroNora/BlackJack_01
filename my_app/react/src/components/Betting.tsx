import type { GameStateData } from "../types/game-types";
import "../styles/betting.css";
import { useEffect, useRef, useState } from "react";
import BettingScreen from "../screens/BettingScreen";

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

  const handleStartGame = () => {
    const shouldShuffle = deckLen === 0 || deckLen < 60;
    // Mindig meghívjuk az onStartGame-et, átadva neki, hogy kell-e keverni
    onStartGame(shouldShuffle);
  };

  const isDisabled = bet === 0;

  const variants = {
    disabled: {
      opacity: 0.7,
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
    <BettingScreen
      gameState={gameState}
      onPlaceBet={onPlaceBet}
      retakeBet={retakeBet}
      onStartGame={handleStartGame}
      tokens={tokens}
      bet={bet}
      betAmounts={betAmounts}
      isDisabled={isDisabled}
      showButtons={showButtons}
      variants={variants}
      textVariants={textVariants}
    />
  );
};

export default Betting;
