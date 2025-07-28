import React, { type JSX } from "react";
import "../styles/playerDealer.css";
import type { GameStateData } from "../types/game-types";

interface TableProps {
  gameState: GameStateData;
}

const SplitPlayersFinish: React.FC<TableProps> = ({ gameState }) => {
  const { players } = gameState;

  const loop = (data: string[]): string[] => {
    return data.map((card) => String(card).trim());
  };

  const formatCard = (card: string): JSX.Element | string => {
    const suit = card[0]; // Az első karakter a szín
    const value = card.substring(1).trim(); // A többi karakter az érték

    let suitClass = "";
    if (suit === "♥" || suit === "♦") {
      suitClass = "red-suit";
    } else if (suit === "♠" || suit === "♣") {
      suitClass = "black-suit";
    } else {
      return card; // Visszaadja a nyers stringet, ha nem felismerhető a szín
    }

    return (
      <React.Fragment>
        <span className={suitClass}>{suit}</span>
        {value}
      </React.Fragment>
    );
  };

  const formatHand = (cardStrings: string[]): JSX.Element[] => {
    const formattedElements = cardStrings.map((cardString, index) => {
      // Elválasztó elem, ha nem az első lap (fontos a 'key' prop!)
      const separator =
        index > 0 ? (
          <span key={`hand-sep-${index}`} className="equal-text">
            {" "}
            +{" "}
          </span>
        ) : null;

      // React.Fragment használata a szeparátor és a kártya csoportosítására (fontos a 'key' prop!)
      return (
        <React.Fragment key={cardString + index}>
          {separator} {formatCard(cardString)}{" "}
          {/* formatCard már JSX elemet ad vissza */}
        </React.Fragment>
      );
    });

    return formattedElements; // JSX elemek tömbje
  };

  return (
    <div>
      <ul id="players-list">
        {players
          .filter((_, index) => index !== 0)
          .map((player, index) => {
            const hand = loop(player[0]);
            const formattedHand = formatHand(hand); // Formázzuk a lapokat JSX-re
            const bet = player[5]; // Kivesszük a tétet

            return (
              <li key={index} className="player">
                Hand: {formattedHand} &nbsp; Bet: {bet}
              </li>
            );
          })}
      </ul>
    </div>
  );
};

export default SplitPlayersFinish;
