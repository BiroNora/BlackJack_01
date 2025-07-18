import "./App.css";
import BettingScreen from "./components/BettingScreen";
import HeaderTitles from "./components/HeaderTitles";
import { LoadingScreen } from "./components/LoadingScreen";
import { useGameStateMachine } from "./hooks/useGameStateMachine";

function App() {
  const { gameState } = useGameStateMachine();
  console.log("App.tsx render - currentGameState:", gameState.currentGameState);

  // A React itt dönti el, mit jelenítsen meg az aktuális állapot alapján
  // A `gameState.currentGameState` fogja vezérelni a megjelenítést
  switch (gameState.currentGameState) {
    case "LOADING":
      return (
        <div>
          <HeaderTitles />
          <LoadingScreen />
        </div>
      );
    case "BETTING":
      return (
        <div>
          <HeaderTitles />
          <BettingScreen gameState={gameState} />
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
