import "./App.css";
import BetBank from "./components/BetBank";
import BetBankDelayed from "./components/BetBankDelayed";
import Betting from "./components/Betting";
import Cards from "./components/Cards";
import HeaderTitles from "./components/HeaderTitles";
import InsMessage from "./components/InsMessage";
import { Loading } from "./components/Loading";
import PlayButtons from "./components/PlayButtons";
import PlayerDealer from "./components/PlayerDealer";
import PlayerDealerMasked from "./components/PlayerDealerMasked";
import { Shuffling } from "./components/Shuffling";
import SplitPlayButtons from "./components/SplitPlayButtons";
import SplitPlayDisabledButtons from "./components/SplitPlayDisabledButtons";
import SplitPlayers from "./components/SplitPlayers";
import SplitWinner from "./components/SplitWinner";
import Winner from "./components/Winner";
import { useGameStateMachine } from "./hooks/useGameStateMachine";

function App() {
  const {
    gameState,
    handlePlaceBet,
    handleRetakeBet,
    handleStartGame,
    handleHitRequest,
    handleStandRequest,
    handleDoubleRequest,
    handleSplitRequest,
    handleSplitHitRequest,
    handleSplitStandRequest,
    handleSplitDoubleRequest,
    handleInsRequest,
    preRewardBet,
    preRewardTokens,
    insPlaced,
    hasHitTurn,
    showInsLost,
    hasOver21,
  } = useGameStateMachine();
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
          <div className="game-action-area-wrapper">
            <PlayButtons
              gameState={gameState}
              onHit={handleHitRequest}
              onStand={handleStandRequest}
              onDouble={handleDoubleRequest}
              onSplit={handleSplitRequest}
              onInsurance={handleInsRequest}
              insPlaced={insPlaced}
              hasHitTurn={hasHitTurn}
              hasOver21={hasOver21}
            />
          </div>
          <BetBank gameState={gameState} />
          <InsMessage insMessage={showInsLost} />
        </div>
      );
    case "MAIN_STAND":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealer gameState={gameState} />
          <div className="game-action-area-wrapper">
            <Winner gameState={gameState} />
          </div>
          <BetBankDelayed
            finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
            initialBet={preRewardBet}
            initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
          />
        </div>
      );
    case "SPLIT_TURN":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealerMasked gameState={gameState} />
          <div className="game-action-area-wrapper">
            <SplitPlayButtons
              gameState={gameState}
              onHit={handleSplitHitRequest}
              onStand={handleSplitStandRequest}
              onSplit={handleSplitRequest}
              onDouble={handleSplitDoubleRequest}
              hasHitTurn={hasHitTurn}
              hasOver21={hasOver21}
            />
          </div>
          <BetBank gameState={gameState} />
          <SplitPlayers gameState={gameState} />
        </div>
      );
    case "SPLIT_STAND":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealerMasked gameState={gameState} />
          <div className="game-action-area-wrapper">
            <SplitPlayDisabledButtons />
          </div>
          <BetBank gameState={gameState} />
          <SplitPlayers gameState={gameState} />
        </div>
      );
    case "SPLIT_FINISH":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealer gameState={gameState} />
          <div className="game-action-area-wrapper">
            <SplitWinner gameState={gameState} />
          </div>
          <BetBankDelayed
            finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
            initialBet={preRewardBet}
            initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
          />
          <SplitPlayers gameState={gameState} />
        </div>
      );
    case "SPLIT_NAT21":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <PlayerDealerMasked gameState={gameState} />
          <div className="game-action-area-wrapper">
            <SplitPlayDisabledButtons />
          </div>
          <BetBank gameState={gameState} />
          <SplitPlayers gameState={gameState} />
        </div>
      );
    case "ROUND_END":
    case "RESTART_GAME":
    case "ERROR":
    default:
      return <div>Ismeretlen állapot: {gameState.currentGameState}</div>;
  }
}

export default App;
