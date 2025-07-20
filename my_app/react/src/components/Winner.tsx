import { states, type GameStateData } from "../types/game-types";
import "../styles/winner.css";

interface TableProps {
  gameState: GameStateData;
}

const Winner: React.FC<TableProps> = ({ gameState }) => {
  const { dealer, winner } = gameState;

  const nat21 = dealer[5];
  const state = states[winner];
  const winners = nat21 !== 0 ? states[nat21] : state;

  return (
    <div className="winners">
      {winners}
    </div>
  );
};

export default Winner;
