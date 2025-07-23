import type { GameStateData } from "../types/game-types";

interface PlayButtonsProps {
  gameState: GameStateData;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  // onSplit: () => void;
  onInsurance: () => void;
  insPlaced: boolean | null;
}

const PlayButtons: React.FC<PlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
  onDouble,
  onInsurance,
  insPlaced,
}) => {
  const { tokens, bet, player, dealer } = gameState;
  const canDouble = tokens >= bet;
  const canSplit = player[0].length == 2 && player[3] && tokens >= bet;
  const canInsure = tokens >= bet / 2 && dealer[4];

  const handleAnyButtonClick = (actionHandler: () => void) => {
    actionHandler();
  };

  return (
    <div id="play-buttons" className="button-container">
      <button
        id="hit-button"
        onClick={() => handleAnyButtonClick(() => onHit())}
      >
        Hit
      </button>
      <button id="stand-button" onClick={() => handleAnyButtonClick(onStand)}>
        Stand
      </button>

      {canDouble && (
        <button
          id="double-button"
          onClick={() => handleAnyButtonClick(onDouble)}
        >
          Double
        </button>
      )}

      {canSplit && (<button id="split-button">Split</button>)}

      {canInsure && !insPlaced && (
        <button id="insurance-button" onClick={() => handleAnyButtonClick(onInsurance)}>
          Insurance
        </button>
      )}
    </div>
  );
};

export default PlayButtons;
