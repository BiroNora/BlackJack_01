import type { GameStateData } from "../types/game-types";

interface PlayButtonsProps {
  gameState: GameStateData;
  onHit: (isDouble: boolean) => void;
  // onStand: () => void; // Add hozzá a többi gombhoz is, ha készen vannak
  // onSplit: () => void;
  // onInsurance: () => void;
}

const PlayButtons: React.FC<PlayButtonsProps> = ({ gameState, onHit }) => {
  const { tokens, bet, deckLen } = gameState;

  return (
    <div id="play-buttons" className="button-container">
      <button id="hit-button" onClick={() => onHit(false)}>
        Hit
      </button>
      <button id="stand-button">Stand</button>
      <button id="double-button" onClick={() => onHit(true)} >Double</button>
      <button id="split-button">Split</button>
      <button id="insurance-button">Insurance</button>
    </div>
  );
};

export default PlayButtons;
