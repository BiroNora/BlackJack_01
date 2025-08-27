import { useEffect, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface CardsProps {
  gameState: GameStateData;
  initDeckLen: number | null;
}

const Cards: React.FC<CardsProps> = ({ gameState, initDeckLen }) => {
  const { deckLen } = gameState;
  const [, setDisplayedDeckLen] = useState(deckLen);
  console.log("init, decklen, gameState: ", initDeckLen, deckLen, gameState.currentGameState)

  useEffect(() => {
    if (initDeckLen !== null && initDeckLen > deckLen) {
      const interval = setInterval(() => {
        setDisplayedDeckLen((initDeckLen) => {
          if (initDeckLen <= deckLen) {
            clearInterval(interval);
            return deckLen;
          }
          return initDeckLen - 1;
        });
      }, 1000);

      // A cleanup funkció, ami leállítja az intervallumot, ha a komponens lecsatolódik
      return () => clearInterval(interval);
    } else {
      // Ha nincs szükség visszaszámlálásra, szinkronizáljuk a kijelzett értéket
      setDisplayedDeckLen(deckLen);
    }
  }, [deckLen, initDeckLen]);

  return (
    <div className="cards merriweather" id="cards">
      Cards: {deckLen}
    </div>
  );
};

export default Cards;
