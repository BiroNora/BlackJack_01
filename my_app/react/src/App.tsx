import { AnimatePresence,motion, type Transition, type Variants } from "motion/react";
import BetBank from "./components/BetBank";
import BetBankDelayed from "./components/BetBankDelayed";
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
import Betting from "./components/Betting";

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

  /* const motionVariants = {
    initial: { opacity: 0,},
    animate: { opacity: 1, x: 0  },
    exit: { opacity: 0, x: 100  },
  }; */

  // A transition beállítások definíciója
  /* const motionTransition: Transition = {
    duration: 3,
    ease: "linear", // Vagy a számtömb: [0, 0, 1, 1]
  }; */

  /* const transition: Transition = {
    duration: 0.5, // 0.5 másodperc
    ease: "easeOut",
  };

  const variation: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  }; */

  const motionVariants = {
    // A belépő animáció
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    // A kilépő animáció
    exit: { opacity: 0 },
    // Az animáció időtartama
    transition: { duration: 1, ease: "easeInOut" },
  };

  return (
    <div>
      <HeaderTitles />
      <AnimatePresence mode="wait">
        {(() => {
          switch (gameState.currentGameState) {
            case "LOADING":
              return (
                //<motion.div key="LOADING" transition={{transition}} variants={{variation}}>
                <motion.div key="LOADING" {...motionVariants}>
                  <Loading />
                </motion.div>
              );
            case "SHUFFLING":
              return (
                <motion.div key="SHUFFLING" {...motionVariants}>
                  <Shuffling />
                </motion.div>
              );
            case "INIT_GAME":
              return (
                <motion.div key="INIT_GAME" {...motionVariants}>
                  {/* Itt nem jelenik meg semmi, de az animáció működik a következő állapotra való átmenetkor */}
                </motion.div>
              );
            case "BETTING":
              return (
                <motion.div key="BETTING" {...motionVariants}>
                  <Betting
                    gameState={gameState}
                    onPlaceBet={handlePlaceBet}
                    retakeBet={handleRetakeBet}
                    onStartGame={handleStartGame}
                  />
                </motion.div>
              );
            case "MAIN_TURN":
              return (
                <motion.div
                  key="MAIN_TURN" {...motionVariants}
                >
                  <Cards gameState={gameState} />
                  <div className="player-dealer-area-wrapper">
                    <PlayerDealerMasked gameState={gameState} />
                  </div>

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
                </motion.div>
              );
            case "MAIN_STAND":
              return (
                <motion.div
                  key="MAIN_STAND"
                  {...motionVariants}
                >
                  <Cards gameState={gameState} />
                  <div className="game-action-area-wrapper">
                    <PlayerDealer
                      gameState={gameState}
                      isSplitted={isSplitted}
                    />
                  </div>
                  <div className="game-action-area-wrapper">
                    <Winner gameState={gameState} />
                  </div>
                  <BetBankDelayed
                    finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
                    initialBet={preRewardBet}
                    initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
                  />
                </motion.div>
              );
            case "SPLIT_TURN":
              return (
                <div>
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
                  <Cards gameState={gameState} />
                  <div className="player-dealer-area-wrapper">
                    <PlayerDealer
                      gameState={gameState}
                      isSplitted={isSplitted}
                    />
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
                  <Cards gameState={gameState} />
                  <div className="player-dealer-area-wrapper">
                    <PlayerDealer
                      gameState={gameState}
                      isSplitted={isSplitted}
                    />
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
                  <OutOfTokens />
                </div>
              );
            case "RESTART_GAME":
              return (
                <div>
                  <Restart />
                </div>
              );
            case "ERROR":
              return (
                <div>
                  <ErrorPage />
                </div>
              );
            default:
              return (
                <div>
                  <ErrorPage />
                </div>
              );
          }
        })()}
      </AnimatePresence>
    </div>
  );

  // A React itt dönti el, mit jelenítsen meg az aktuális állapot alapján
  // A `gameState.currentGameState` fogja vezérelni a megjelenítést
}

export default App;
