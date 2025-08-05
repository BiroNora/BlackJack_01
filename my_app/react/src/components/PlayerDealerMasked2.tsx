import React, { type JSX } from "react";
import type { GameStateData } from "../types/game-types";
import "../styles/playerDealer2.css";
import { maskedScore } from "../utilities/utils";

interface TableProps {
  gameState: GameStateData;
}

const PlayerDealerMasked2: React.FC<TableProps> = ({ gameState }) => {
  const { player, dealer } = gameState;

  const dealerMasked = dealer[0][1][1];
  const dealerMaskedScore = maskedScore(dealerMasked);

  const formatCard = (card: string): JSX.Element | string => {
    if (card.trim() === "✪") {
      return <span className="red-suit"> ✪ </span>;
    }

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
        <span className="merriweatherblack">{value}</span>
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

  const loop = (data: string[]): string[] => {
    return data.map((card) => String(card).trim());
  };

  const playerHand = loop(player[0]);
  const dealerHand = loop(dealer[0]);

  const formattedPlayerHand = formatHand(playerHand);
  const formattedDealerHand = formatHand(dealerHand);

  return (
    <div>
      <div id="dealer-hand" className="play">
        <div>
          <span className="label-text">Dealer:</span>{" "}{dealerMaskedScore}
        </div>
        <div className="hand">{formattedDealerHand}</div>
      </div>
      <div id="player-hand" className="play">
        <div>
          <span className="label-text">Player:</span>{" "}<span >{player[1]}</span>
        </div>
        <div className="hand">{formattedPlayerHand}</div>
      </div>
    </div>
  );
};

export default PlayerDealerMasked2;
