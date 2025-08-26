import { useEffect, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface CardsProps {
  gameState: GameStateData;
}

const Cards: React.FC<CardsProps> = ({ gameState }) => {
  const { deckLen } = gameState;

  const [displayedDeckLen, setDisplayedDeckLen] = useState(deckLen);

  useEffect(() => {
    // Ha a megjelenített szám nagyobb, mint a valós szám, elindítjuk a visszaszámlálást
    if (displayedDeckLen > deckLen) {
      const interval = setInterval(() => {
        setDisplayedDeckLen((prevLen) => {
          // Ha elérte a valós számot, megállítjuk az animációt
          if (prevLen <= deckLen) {
            clearInterval(interval);
            return deckLen;
          }
          // Különben csökkentjük a számot
          return prevLen - 1;
        });
      }, 50); // A visszaszámlálás sebessége 50 ms-ként egyet csökken

      // A cleanup funkció megszünteti az intervallumot, ha a komponens eltűnik vagy a hook újra lefut
      return () => clearInterval(interval);
    } else {
      // Ha a valós szám nagyobb vagy egyenlő, azonnal frissítjük a kijelzőt
      setDisplayedDeckLen(deckLen);
    }
  }, [deckLen, displayedDeckLen]);

  return (
    <div className="cards merriweather" id="cards">
      Cards: {displayedDeckLen}
    </div>
  );
};

export default Cards;
