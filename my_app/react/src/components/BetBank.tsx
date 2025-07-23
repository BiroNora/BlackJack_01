import type { GameStateData } from "../types/game-types";
import { formatNumber } from "../utilities/utils";
import "../styles/betting.css";

interface BetBankProps {
  gameState: GameStateData;
}

const BetBank: React.FC<BetBankProps> = ({ gameState }) => {
  const { tokens, bet } = gameState;

  return (
    <div >
      <div className="bank">Bet:{" "} {formatNumber(bet)}</div>
      <div className="bank">
        Player's bank: {" "}
        <span className="bank-amount">{formatNumber(tokens)}</span>
      </div>
    </div>
  );
};

export default BetBank;
