// src/components/BetBankDelayed.tsx

import React, { useState, useEffect, useRef } from "react";
import type { GameStateData } from "../types/game-types";
import { formatNumber } from "../utilities/utils";
import "../styles/betting.css";

interface BetBankDelayedProps {
  finalGameState: GameStateData; // Ez a prop most már helyesen van definiálva
  initialBet: number | null;
  initialTokens: number | null;
}

const BetBankDelayed: React.FC<BetBankDelayedProps> = ({
  finalGameState,
  initialBet,
  initialTokens,
}) => {
  // Belső állapot a VIZUÁLISAN megjelenített tokenek és tét számára.
  // Kezdetben null-ra állítjuk, vagy egy speciális "átmeneti" értékre.
  // Ezt fogjuk beállítani a "régi" értékre, majd a "setTimeout" után az "új" értékre.
  const [displayedBet, setDisplayedBet] = useState<number | null>(initialBet);
  const [displayedTokens, setDisplayedTokens] = useState<number | null>(
    initialTokens
  );

  // useRef segítségével tároljuk a gameState előző állapotát,
  // hogy hozzáférjünk a "régi" token és tét értékekhez.
  const prevGameStateRef = useRef<GameStateData | null>(null);

  useEffect(() => {
    const timeoutId: NodeJS.Timeout = setTimeout(() => {
      setDisplayedTokens(finalGameState.tokens);
      setDisplayedBet(finalGameState.bet); // <<< Tét frissítése
      console.log(
        "--- DEBUG --- BetBankDelayed: Értékek frissítve a késleltetés után (új): Tokens:",
        finalGameState.tokens,
        "Bet:",
        finalGameState.bet
      );
    }, 1500); // 1.5 másodperc késleltetés a vizuális frissítés előtt

    // Frissítsük a ref-et az aktuális finalGameState-tel a későbbi futtatásokhoz vagy egyéb logikához.
    // Azonban, ha csak az initialTokens és finalGameState van közvetlenül átadva,
    // akkor ez a ref nem feltétlenül szükséges a "régi-új" logika magjához.
    // Ha más célra is használnád a prevGameStateRef-et, hagyd bent ezt a sort:
    prevGameStateRef.current = finalGameState;

    // Tisztító függvény: Töröljük az időzítőt, ha a komponens lecsatolódik vagy a függőségek megváltoznak
    return () => {
      clearTimeout(timeoutId);
      console.log("BetBankDelayed: Időzítő törölve.");
    };
  }, [finalGameState, initialTokens, initialBet]); // Függőségek: újraindul, ha a finalGameState vagy initialTokens változik
  console.log("displayedBet: ", displayedBet)
  // Vizuális megjelenítési logika:
  // Használjunk placeholdert, ha a displayedTokens null (pl. kezdeti betöltéskor, ha az initialTokens null volt)
  const tokensToDisplay =
  displayedTokens !== null ? formatNumber(displayedTokens) : "---";
  const betToDisplay =
  displayedBet !== null ? formatNumber(displayedBet) : "---";
  console.log("betToDisplay: ", betToDisplay)

  return (
    <div >
      <div className="bank">Bet: {betToDisplay}</div>
      <div className="bank">
        Player's bank: <span className="bank-amount">{tokensToDisplay}</span>
      </div>
    </div>
  );
};

export default BetBankDelayed;
