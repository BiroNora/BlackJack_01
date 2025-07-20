import type { GameStateData } from "../types/game-types";

interface CardsProps {
  gameState: GameStateData;
}

const Cards: React.FC<CardsProps> = ({
  gameState,
}) => {
  const { deckLen } = gameState;

  return (
    <div className="cards" id="cards">
      Cards: {deckLen}
    </div>
  );
};

export default Cards;
