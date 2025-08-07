import { useEffect, useRef, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface PlayButtonsProps {
  gameState: GameStateData;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsurance: () => void;
  insPlaced: boolean;
  hasHitTurn: boolean;
  hasOver21: boolean;
}

const PlayButtons: React.FC<PlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsurance,
  insPlaced,
  hasHitTurn,
  hasOver21,
}) => {
  const { tokens, bet, player, dealer } = gameState;
  const canDouble = tokens >= bet && !hasHitTurn;
  const canSplit =
    player[0].length == 2 && player[3] && tokens >= bet && !hasHitTurn;
  const canInsure = tokens >= bet / 2 && dealer[4] && !hasHitTurn;
  const [showButtons, setShowButtons] = useState(false);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutIdRef.current = window.setTimeout(() => {
      setShowButtons(true);
    }, 1000);

    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  const handleAnyButtonClick = (actionHandler: () => void) => {
    if (!hasOver21) {
      actionHandler();
    }
  };

  return (
    <div
      id="play-buttons"
      className={`button-container1 ${showButtons ? "show-buttons" : ""}`}
    >
      <button
        id="hit-button"
        onClick={() => handleAnyButtonClick(() => onHit())}
        disabled={hasOver21}
      >
        Hit
      </button>
      <button
        id="stand-button"
        onClick={() => handleAnyButtonClick(onStand)}
        disabled={hasOver21}
      >
        Stand
      </button>

      {canDouble && (
        <button
          id="double-button"
          onClick={() => handleAnyButtonClick(onDouble)}
          disabled={hasOver21}
        >
          Double
        </button>
      )}

      {canSplit && (
        <button
          id="split-button"
          onClick={() => handleAnyButtonClick(onSplit)}
          disabled={hasOver21}
        >
          Split
        </button>
      )}

      {canInsure && !insPlaced && (
        <button
          id="insurance-button"
          onClick={() => handleAnyButtonClick(onInsurance)}
          disabled={hasOver21}
        >
          Insurance
        </button>
      )}
    </div>
  );
};

export default PlayButtons;
