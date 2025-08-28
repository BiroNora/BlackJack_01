import { useEffect, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface CardsProps {
  gameState: GameStateData;
  initDeckLen: number | null;
}

const Cards: React.FC<CardsProps> = ({ gameState, initDeckLen }) => {
  const { deckLen } = gameState;
  const [displayedDeckLen, setDisplayedDeckLen] = useState(deckLen);
  const [tmp, setTmp] = useState(initDeckLen);
  console.log("init, decklen, tmp,  gameState: ", initDeckLen, deckLen, tmp, gameState.currentGameState)

  useEffect(() => {
    setDisplayedDeckLen(tmp!);
    if (initDeckLen !== null && initDeckLen > deckLen) {
      const interval = setInterval(() => {
        setDisplayedDeckLen((prevDisplayedLen) => {
          if (prevDisplayedLen <= deckLen) {
            clearInterval(interval);
            setTmp(deckLen);
            return deckLen;
          }
          return prevDisplayedLen - 1;
        });
      }, 400);

      return () => clearInterval(interval);
    } else {
      setDisplayedDeckLen(deckLen);
    }
  }, [deckLen, initDeckLen, tmp]);

  return (
    <div className="cards merriweather" id="cards">
      Cards: {displayedDeckLen}
    </div>
  );
};

export default Cards;
