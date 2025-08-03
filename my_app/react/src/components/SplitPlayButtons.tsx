import { useEffect, useRef, useState } from "react";
import type { GameStateData } from "../types/game-types";

interface SplitPlayButtonsProps {
  gameState: GameStateData;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  hasHitTurn: boolean;
  hasOver21: boolean;
}

const SplitPlayButtons: React.FC<SplitPlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
  onDouble,
  onSplit,
  hasHitTurn,
  hasOver21,
}) => {
  const { tokens, bet, player, players } = gameState;
  const canDouble = tokens >= bet && !hasHitTurn;
  const canSplit =
    player[0].length == 2 && player[3] && tokens >= bet && !hasHitTurn;
  const playersLength = players.length < 3 ? true : false;
  const [showButtons, setShowButtons] = useState(false);
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutIdRef.current = window.setTimeout(() => {
      setShowButtons(true);
    }, 400);

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
    <div>
      <div
        id="play-buttons"
        className={`button-container ${showButtons ? "show-buttons" : ""}`}
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

        {canSplit && playersLength && (
          <button
            id="split-button"
            onClick={() => handleAnyButtonClick(onSplit)}
            disabled={hasOver21}
          >
            Split
          </button>
        )}
      </div>
    </div>
  );
};

export default SplitPlayButtons;
