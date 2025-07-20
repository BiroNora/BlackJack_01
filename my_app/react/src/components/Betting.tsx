import type { GameStateData } from "../types/game-types";
import "../styles/betting.css";
import { formatNumber } from "../utilities/utils";

interface BettingProps {
  gameState: GameStateData;
  onPlaceBet: (amount: number) => void;
  retakeBet: () => void;
  onStartGame: (shouldShuffle: boolean) => void;
}

const Betting: React.FC<BettingProps> = ({
  gameState,
  onPlaceBet,
  retakeBet,
  onStartGame,
}) => {
  const { tokens, bet, deckLen } = gameState;

  const betAmounts = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000];

  const handleAllIn = () => {
    onPlaceBet(tokens);
  };

  const handleStartGame = () => {
    const shouldShuffle = deckLen === 0 || deckLen < 60;
    // Mindig meghívjuk az onStartGame-et, átadva neki, hogy kell-e keverni
    onStartGame(shouldShuffle);
  };

  return (
    <div className="betting-screen-container">
      <button id="start-button" onClick={handleStartGame} disabled={bet === 0}>
        Start Game
      </button>

      <div id="deal-bank" className="deal-bank">
        <button
          id="deal-button"
          onClick={() => retakeBet()}
          disabled={bet === 0}
        >
          Bet: {formatNumber(bet)}
        </button>
        <div id="bank">
          Player's bank:{" "}
          <span className="bank-amount">{formatNumber(tokens)}</span>
        </div>
      </div>

      <div id="chips" className="chips">
        <button
          id="all-in"
          type="button"
          onClick={handleAllIn}
          disabled={tokens === 0}
        >
          All In
        </button>

        {betAmounts.map((amount) => (
          <button
            key={amount}
            id={String(amount)}
            type="button"
            data-bet={amount}
            onClick={() => onPlaceBet(amount)}
            disabled={tokens < amount}
          >
            {formatNumber(amount)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Betting;
