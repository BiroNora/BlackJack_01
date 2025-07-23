import type { GameStateData } from "../types/game-types";

interface SplitPlayButtonsProps {
  gameState: GameStateData;
  onHit: (isDouble: boolean) => void;
  onStand: () => void;
  // onSplit: () => void;
}

const SplitPlayButtons: React.FC<SplitPlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
}) => {
  const { tokens, bet, player, dealer } = gameState;
  const canDouble = tokens >= bet;
  const canSplit = player[0].length == 2 && player[3] && tokens >= bet;

  const handleAnyButtonClick = (actionHandler: () => void) => {
    actionHandler();
  };

  return (
    <div id="play-buttons" className="button-container">
      <button
        id="hit-button"
        onClick={() => handleAnyButtonClick(() => onHit(false))}
      >
        Hit
      </button>
      <button id="stand-button" onClick={() => handleAnyButtonClick(onStand)}>
        Stand
      </button>

      {canDouble && (
        <button
          id="double-button"
          onClick={() => handleAnyButtonClick(() => onHit(true))}
        >
          Double
        </button>
      )}

      {canSplit && (<button id="split-button">Split</button>)}
    </div>
  );
};

export default SplitPlayButtons;
