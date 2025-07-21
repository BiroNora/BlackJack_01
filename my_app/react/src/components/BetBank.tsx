import type { GameStateData } from "../types/game-types";
import { formatNumber } from "../utilities/utils";
import "../styles/winner.css";

interface BetBankProps {
  gameState: GameStateData;
}

const BetBank: React.FC<BetBankProps> = ({ gameState }) => {
  const { tokens, bet } = gameState;

  return (
    <div >
      <div className="winners">Bet: {formatNumber(bet)}</div>
      <div className="winners">
        Player's bank:{" "}
        <span className="bank-amount">{formatNumber(tokens)}</span>
      </div>
    </div>
  );
};

export default BetBank;
