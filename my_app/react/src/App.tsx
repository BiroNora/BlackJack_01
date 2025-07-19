import "./App.css";
import Betting from "./components/Betting";
import HeaderTitles from "./components/HeaderTitles";
import { Loading } from "./components/Loading";
import { Shuffling } from "./components/Shuffling";
import { useGameStateMachine } from "./hooks/useGameStateMachine";

function App() {
  const { gameState, handlePlaceBet, handleRetakeBet } = useGameStateMachine();
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
          <Betting
            gameState={gameState}
            onPlaceBet={handlePlaceBet}
            retakeBet={handleRetakeBet}
          />
        </div>
      );
    case "MAIN_TURN":
    case "MAIN_STAND":
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
