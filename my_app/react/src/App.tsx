import "./App.css";
import BetBank from "./components/BetBank";
import Betting from "./components/Betting";
import Cards from "./components/Cards";
import HeaderTitles from "./components/HeaderTitles";
import { Loading } from "./components/Loading";
import PlayButtons from "./components/PlayButtons";
import PlayerDealer from "./components/PlayerDealer";
import PlayerDealerMasked from "./components/PlayerDealerMasked";
import { Shuffling } from "./components/Shuffling";
import Winner from "./components/Winner";
import { useGameStateMachine } from "./hooks/useGameStateMachine";

function App() {
  const { gameState, handlePlaceBet, handleRetakeBet, handleStartGame, handleHitRequest } =
    useGameStateMachine();
  console.log("App.tsx render - currentGameState:", gameState.currentGameState);

  // A React itt dönti el, mit jelenítsen meg az aktuális állapot alapján
  // A `gameState.currentGameState` fogja vezérelni a megjelenítést
  switch (gameState.currentGameState) {
    case "LOADING":
      return (
        <div>
          <HeaderTitles />
          <Loading />
        </div>
      );
    case "SHUFFLING":
      return (
        <div>
          <HeaderTitles />
          <Shuffling />
        </div>
      );
    case "BETTING":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <Betting
            gameState={gameState}
            onPlaceBet={handlePlaceBet}
            retakeBet={handleRetakeBet}
            onStartGame={handleStartGame}
          />
        </div>
      );
    case "MAIN_TURN":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealerMasked gameState={gameState} />
          <PlayButtons gameState={gameState} onHit={handleHitRequest} />
          <BetBank gameState={gameState}/>
        </div>
      );
    case "MAIN_STAND":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealer gameState={gameState} />
          <Winner gameState={gameState} />
          <BetBank gameState={gameState}/>
        </div>
      );
    case "MAIN_NAT21":
    case "MAIN_NAT21_DEALER":
    case "SPLIT_START":
    case "SPLIT_TURN":
    case "SPLIT_FINISH":
    case "SPLIT_NAT21":
    case "ROUND_END":
    case "RESTART_GAME":
    case "ERROR":
    default:
      return <div>Ismeretlen állapot: {gameState.currentGameState}</div>;
  }
}

export default App;
