import { states, type GameStateData } from "../types/game-types";

interface TableProps {
  gameState: GameStateData;
}

const SplitWinner: React.FC<TableProps> = ({ gameState }) => {
  const { player, winner } = gameState;

  const nat21 = player[6];
  const state = states[winner];
  const winners = nat21 !== 0 ? states[nat21] : state;

  return (
    <div className="winners">
      {winners}
    </div>
  );
};

export default SplitWinner;
