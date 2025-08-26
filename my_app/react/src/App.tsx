import BetBank from "./components/BetBank";
import BetBankDelayed from "./components/BetBankDelayed";
import Cards from "./components/Cards";
import { ErrorPage } from "./components/ErrorPage";
import HeaderTitles from "./components/HeaderTitles";
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
import { AnimatePresence, motion } from "motion/react";
import SplitPlayerDealerMasked from "./components/SplitPlayerDealerMasked";

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

  /* const motionVariants = {
    // A belépő animáció
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    // A kilépő animáció
    exit: { opacity: 0 },
    // Az animáció időtartama
    transition: { duration: 2, ease: "easeInOut" },
  };

  const motionVariants4 = {
    // A belépő animáció
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    // A kilépő animáció
    exit: {
      opacity: 0,
    },
    // Az animáció időtartama
    transition: { duration: 0.5, ease: "easeInOut" },
  }; */

  function PageWrapper({ children }) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 3 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <>
      <HeaderTitles />
      <AnimatePresence mode="wait">
        {(() => {
          switch (gameState.currentGameState) {
            case "LOADING":
              return (
                <div>
                  <PageWrapper>
                    <Loading />
                  </PageWrapper>
                </div>
              );
            case "SHUFFLING":
              return (
                <div>
                  <PageWrapper>
                    <Shuffling />
                  </PageWrapper>
                </div>
              );
            case "INIT_GAME":
              return <div></div>;
            case "BETTING":
              return (
                <div>
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
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <PlayerDealerMasked
                        gameState={gameState}
                        insMessage={showInsLost}
                      />
                    </div>
                  </PageWrapper>
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
                </div>
              );
            case "MAIN_STAND":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <PlayerDealer
                        gameState={gameState}
                        isSplitted={isSplitted}
                      />
                    </div>
                  </PageWrapper>
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
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <SplitPlayerDealerMasked gameState={gameState} />
                    </div>
                  </PageWrapper>

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
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
                </div>
              );
            case "SPLIT_STAND":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <SplitPlayerDealerMasked gameState={gameState} />
                    </div>
                  </PageWrapper>

                  <div className="game-action-area-wrapper">
                    <SplitPlayDisabledButtons gameState={gameState} />
                  </div>
                  <BetBank gameState={gameState} />
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
                </div>
              );
            case "SPLIT_STAND_DOUBLE":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <SplitPlayerDealerMasked gameState={gameState} />
                    </div>
                  </PageWrapper>

                  <div className="game-action-area-wrapper">
                    <SplitPlayDoubleDisabledButtons
                      gameState={gameState}
                      hitCounter={hitCounter}
                    />
                  </div>
                  <BetBank gameState={gameState} />
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
                </div>
              );
            case "SPLIT_NAT21_TRANSIT":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <SplitPlayerDealerMasked gameState={gameState} />
                    </div>
                  </PageWrapper>

                  <div className="game-action-area-wrapper">
                    <SplitPlayDisabledButtons gameState={gameState} />
                  </div>
                  <BetBank gameState={gameState} />
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
                </div>
              );
            case "SPLIT_FINISH":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <PlayerDealer
                        gameState={gameState}
                        isSplitted={isSplitted}
                      />
                    </div>

                    <div className="game-action-area-wrapper">
                      <SplitWinner gameState={gameState} />
                    </div>
                  </PageWrapper>
                  <BetBankDelayed
                    finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
                    initialBet={preRewardBet}
                    initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
                  />
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
                </div>
              );
            case "SPLIT_FINISH_TRANSIT":
              return (
                <div>
                  <Cards gameState={gameState} />
                  <PageWrapper>
                    <div className="player-dealer-area-wrapper">
                      <PlayerDealer
                        gameState={gameState}
                        isSplitted={isSplitted}
                      />
                    </div>
                  </PageWrapper>

                  <div className="game-action-area-wrapper">
                    <SplitWinner gameState={gameState} />
                  </div>
                  <BetBankDelayed
                    finalGameState={gameState} // Ez a JUTALMAKKAL MÓDOSÍTOTT állapot
                    initialBet={preRewardBet}
                    initialTokens={preRewardTokens} // Ez a JUTALOM ELŐTTI token érték
                  />
                  <PageWrapper>
                    <div className="players-area-wrapper">
                      <SplitPlayers gameState={gameState} />
                    </div>
                  </PageWrapper>
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
    </>
  );
}

export default App;
