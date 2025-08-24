import { motion } from "motion/react";
import BetBank from "./components/BetBank";
import BetBankDelayed from "./components/BetBankDelayed";
import Betting from "./components/Betting";
import Cards from "./components/Cards";
import { ErrorPage } from "./components/ErrorPage";
import HeaderTitles from "./components/HeaderTitles";
import InsMessage from "./components/InsMessage";
import { Loading } from "./components/Loading";
import { OutOfTokens } from "./components/OutOfTokens";
import PlayButtons from "./components/PlayButtons";
import PlayerDealer from "./components/PlayerDealer";
import PlayerDealerMasked from "./components/PlayerDealerMasked";
import { Restart } from "./components/RestartGame";
import { Shuffling } from "./components/Shuffling";
import SplitPlayButtons from "./components/SplitPlayButtons";
import SplitPlayDisabledButtons from "./components/SplitPlayDisabledButtons";
import SplitPlayDoubleDisabledButtons from "./components/SplitPlayDoubleDisabledButtons";
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
    isSplitted,
    hitCounter,
  } = useGameStateMachine();
  //console.log("App.tsx render - currentGameState:", gameState.currentGameState);

  const transitionProps1 = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    duration: 1,
    delay: 0.5,
    ease: [0, 0, 0.58, 1],
  };

  const transitionProps2 = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    duration: 2,
    delay: 0.5,
    ease: [0, 0, 0.58, 1],
  };

  // A React itt dönti el, mit jelenítsen meg az aktuális állapot alapján
  // A `gameState.currentGameState` fogja vezérelni a megjelenítést
  switch (gameState.currentGameState) {
    case "LOADING":
      return (
        <div>
          <HeaderTitles />
          <motion.div key="loading" {...transitionProps1}>
            <Loading />
          </motion.div>
        </div>
      );
    case "SHUFFLING":
      return (
        <div>
          <HeaderTitles />
          <motion.div key="shuffling" {...transitionProps2}>
            <Shuffling />
          </motion.div>
        </div>
      );
    case "INIT_GAME":
      return (
        <div>
          <HeaderTitles />
        </div>
      );
    case "BETTING":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <motion.div key="betting" {...transitionProps2}>
            <Betting
              gameState={gameState}
              onPlaceBet={handlePlaceBet}
              retakeBet={handleRetakeBet}
              onStartGame={handleStartGame}
            />
          </motion.div>
        </div>
      );
    case "MAIN_TURN":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <motion.div key="MAIN_TURN" {...transitionProps2}>
            <div className="player-dealer-area-wrapper">
              <PlayerDealerMasked gameState={gameState} />
            </div>
          </motion.div>

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
          <motion.div key="loading-state" {...transitionProps1}>
            <div className="player-dealer-area-wrapper">
              <PlayerDealer gameState={gameState} isSplitted={isSplitted} />
            </div>
          <div className="game-action-area-wrapper">
            <Winner gameState={gameState} />
          </div>
          </motion.div>
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
          <div className="player-dealer-area-wrapper">
            <PlayerDealerMasked gameState={gameState} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitPlayButtons
              gameState={gameState}
              onHit={handleSplitHitRequest}
              onStand={handleSplitStandRequest}
              onSplit={handleSplitRequest}
              onDouble={handleSplitDoubleRequest}
              hitCounter={hitCounter}
              hasOver21={hasOver21}
            />
          </div>
          <BetBank gameState={gameState} />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "SPLIT_STAND":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <div className="player-dealer-area-wrapper">
            <PlayerDealerMasked gameState={gameState} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitPlayDisabledButtons gameState={gameState} />
          </div>
          <BetBank gameState={gameState} />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "SPLIT_STAND_DOUBLE":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <div className="player-dealer-area-wrapper">
            <PlayerDealerMasked gameState={gameState} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitPlayDoubleDisabledButtons
              gameState={gameState}
              hitCounter={hitCounter}
            />
          </div>
          <BetBank gameState={gameState} />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "SPLIT_NAT21_TRANSIT":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <div className="player-dealer-area-wrapper">
            <PlayerDealerMasked gameState={gameState} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitPlayDisabledButtons gameState={gameState} />
          </div>
          <BetBank gameState={gameState} />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "SPLIT_FINISH":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <div className="player-dealer-area-wrapper">
            <PlayerDealer gameState={gameState} isSplitted={isSplitted} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitWinner gameState={gameState} />
          </div>
          <BetBankDelayed
            finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
            initialBet={preRewardBet}
            initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
          />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "SPLIT_FINISH_TRANSIT":
      return (
        <div>
          <HeaderTitles />
          <Cards gameState={gameState} />
          <div className="player-dealer-area-wrapper">
            <PlayerDealer gameState={gameState} isSplitted={isSplitted} />
          </div>
          <div className="game-action-area-wrapper">
            <SplitWinner gameState={gameState} />
          </div>
          <BetBankDelayed
            finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
            initialBet={preRewardBet}
            initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
          />
          <div className="players-area-wrapper">
            <SplitPlayers gameState={gameState} />
          </div>
        </div>
      );
    case "OUT_OF_TOKENS":
      return (
        <div>
          <HeaderTitles />
          <OutOfTokens />
        </div>
      );
    case "RESTART_GAME":
      return (
        <div>
          <HeaderTitles />
          <Restart />
        </div>
      );
    case "ERROR":
      return (
        <div>
          <HeaderTitles />
          <ErrorPage />
        </div>
      );
    default:
      return (
        <div>
          <HeaderTitles />
          <ErrorPage />
        </div>
      );
  }
}

export default App;
