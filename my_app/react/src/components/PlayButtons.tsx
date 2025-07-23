import { useEffect, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface PlayButtonsProps {
  gameState: GameStateData;
  onHit: (isDouble: boolean) => void;
  onStand: () => void;
  // onSplit: () => void;
  onInsurance: () => void;
}

const PlayButtons: React.FC<PlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
  onInsurance,
}) => {
  const { tokens, bet, player, dealer } = gameState;
  const canDouble = tokens >= bet;
  const canSplit = player[0].length == 2 && player[3] && tokens >= bet;
  const canInsure = tokens >= bet / 2 && dealer[4];
  const [showInsLost, setShowInsLost] = useState(false);
  const [insPlaced, setInsPlaced] = useState(false);

  const handleInsClick = () => {
    setInsPlaced(true);
    onInsurance();
  };

  useEffect(() => {
    const insLost = insPlaced && dealer[5] !== 3;

    if (insLost) {
      setShowInsLost(true);
      setInsPlaced(false);
    }
  }, [dealer, insPlaced]);

  const handleAnyButtonClick = (actionHandler: () => void) => {
    setShowInsLost(false);
    actionHandler();
  };

  return (
    <div id="play-buttons" className="button-container">
      <button id="hit-button" onClick={() => handleAnyButtonClick(() => onHit(false))}>
        Hit
      </button>
      <button id="stand-button" onClick={() => handleAnyButtonClick(onStand)}>
        Stand
      </button>

      {canDouble && (
        <button id="double-button" onClick={() => handleAnyButtonClick(() => onHit(true))}>
          Double
        </button>
      )}

      {canSplit && <button id="split-button">Split</button>}

      {canInsure && (
        <button id="insurance-button" onClick={handleInsClick}>
          Insurance
        </button>
      )}

      {showInsLost && <div id="insurance-lost-message">Insurance lost</div>}
    </div>
  );
};

export default PlayButtons;
