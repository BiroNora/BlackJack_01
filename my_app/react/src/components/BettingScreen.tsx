import type { GameStateData } from "../types/game-types";

interface BettingScreenProps {
  gameState: GameStateData;
  // Ha a transitionToState-t is átadnád, az is típussal ellátott lehetne:
  // transitionToState: (newState: GameState, newData?: Partial<GameStateData>) => void;
}

const BettingScreen: React.FC<BettingScreenProps> = ({ gameState }) => {
  const { tokens, deckLen  } = gameState;

  return (
    <div>
      <h2>Tétrakás</h2>
      <p>Jelenlegi tokenjeid: **{tokens}**</p>
      <p>Pakli hossza: **{deckLen}**</p>
    </div>
  );
};

export default BettingScreen;
