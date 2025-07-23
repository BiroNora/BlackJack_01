import type { GameStateData } from "../types/game-types";

interface PlayButtonsProps {
  gameState: GameStateData;
  onHit: (isDouble: boolean) => void;
  onStand: () => void;
  // onSplit: () => void;
  // onInsurance: () => void;
}

const PlayButtons: React.FC<PlayButtonsProps> = ({
  gameState,
  onHit,
  onStand,
}) => {
  const { tokens, bet, player, dealer } = gameState;
  const canDouble = tokens >= bet;
  const canSplit = player[0].length == 2 && player[3] && tokens >= bet
  const canInsure = tokens >= bet / 2 && dealer[4];

  return (
    <div id="play-buttons" className="button-container">
      <button id="hit-button" onClick={() => onHit(false)}>
        Hit
      </button>
      <button id="stand-button" onClick={() => onStand()}>
        Stand
      </button>

      {canDouble && (
        <button id="double-button" onClick={() => onHit(true)}>
          Double
        </button>
      )}

      {canSplit && (
        <button id="split-button">Split</button>
      )}

      {canInsure && <button id="insurance-button">Insurance</button>}
    </div>
  );
};

export default PlayButtons;
