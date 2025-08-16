import type { GameStateData } from "../types/game-types";

interface SplitPlayDoubleDisabledButtonsProps {
  gameState: GameStateData;
  hitCounter: number | null;
}

const SplitPlayDoubleDisabledButtons: React.FC<
  SplitPlayDoubleDisabledButtonsProps
> = ({ gameState }) => {
  const { tokens, bet } = gameState;
  const canDouble = tokens >= bet;
  console.log("SplitPlayDisabledButtons: ", gameState);
  console.log("SplitPlayDisabledButtons: ", canDouble);

  return (
    <div id="play-buttons" className="button-container1">
      <button id="hit-button" disabled={true}>
        Hit
      </button>
      <button id="stand-button" disabled={true}>
        Stand
      </button>
      {canDouble && (
        <button id="double-button" disabled={true}>
          Double
        </button>
      )}
    </div>
  );
};

export default SplitPlayDoubleDisabledButtons;
