import type { GameStateData } from "../types/game-types";

interface SplitPlayButtonsProps {
  gameState: GameStateData;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}

const SplitPlayButtons: React.FC<SplitPlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
  onDouble,
  onSplit,
}) => {
  const { tokens, bet, player, players } = gameState;
  const canDouble = tokens >= bet;
  const canSplit = player[0].length == 2 && player[3] && tokens >= bet;
  const playersLength = players.length < 3 ? true : false;
  console.log("PLAYERS LENGTH: ", playersLength, players.length);

  const handleAnyButtonClick = (actionHandler: () => void) => {
    actionHandler();
  };

  return (
    <div>
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

        {canSplit && playersLength && (
          <button
            id="split-button"
            onClick={() => handleAnyButtonClick(onSplit)}
          >
            Split
          </button>
        )}
      </div>
    </div>
  );
};

export default SplitPlayButtons;
