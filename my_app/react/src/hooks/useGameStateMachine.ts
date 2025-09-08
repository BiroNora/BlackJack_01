import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initializeSessionAPI,
  getTokensAPI,
  getDeckLenAPI,
  setBet,
  takeBackDeal,
  getShuffling,
  startGame,
  handleHit,
  handleStand,
  handleReward,
  handleInsurance,
  handleDouble,
  splitHand,
  updateSplitPlayersByStand,
  splittedToHand,
  updatePlayerFromPlayers,
  getGameData,
  setRestart,
  forceRestart,
} from '../api/api-calls';
import type {
  DeckLenResponse,
  GameState,
  GameStateData,
  GameStateMachineHookResult,
  TokensResponse,
} from '../types/game-types';
import { extractGameStateData } from '../utilities/utils';


// Kezdeti állapot a játékgép számára
const initialGameState: GameStateData = {
  currentGameState: 'LOADING',
  player: [[], 0, 0, false, false, 0, 0],
  dealer: [[], [], 0, 0, false, 0],
  deckLen: 104,
  tokens: 0,
  splitReq: 0,
  bet: 0,
  bet_list: [],
  players: [],
  winner: 0,
  is_round_active: false,
};

// A hook visszatérési típusa most inline van deklarálva, nincs külön 'type' definíció.
export function useGameStateMachine(): GameStateMachineHookResult {
  const [gameState, setLocalGameState] = useState<GameStateData>(initialGameState);
  const [preRewardBet, setPreRewardBet] = useState<number | null>(null);
  const [preRewardTokens, setPreRewardTokens] = useState<number | null>(null);
  const [insPlaced, setInsPlaced] = useState(false);
  const [showInsLost, setShowInsLost] = useState(false);
  const [hasHitTurn, setHasHitTurn] = useState(false);
  const [hasOver21, setHasOver21] = useState(false);
  const [isSplitted, setIsSplitted] = useState(false);
  const [hasSplitNat21, setHasSplitNat21] = useState(false);
  const [hitCounter, setHitCounter] = useState<number | null>(null);
  const [initDeckLen, setInitDeckLen] = useState<number | null>(null);
  // isWaitingForServerResponse = isWFSR
  // setIsWaitingForServerResponse = setIsWFSR
  const [isWFSR, setIsWFSR] = useState(false);

  const timeoutIdRef = useRef<number | null>(null);

  // Az isMounted ref-et is használjuk a komponens mountolt állapotának követésére
  // Ennek típusa boolean, a useRef pedig automatikusan kikövetkezteti.
  const isMountedRef = useRef(true);

  // Állapotváltó funkció
  const transitionToState = useCallback((
    newState: GameState,
    newData?: Partial<GameStateData>
  ) => {
    setLocalGameState(prev => {
      const updatedState = {
        ...prev,
        ...newData,
        currentGameState: newState,
      };
      console.log(`>>> Állapotváltás: ${prev.currentGameState} -> ${newState}`, updatedState);
      return updatedState;
    });
  }, []);

  const savePreActionState = useCallback(() => {
    if (gameState) {
      setPreRewardBet(gameState.player[5]);
      setPreRewardTokens(gameState.tokens);
    } else {
      setPreRewardBet(null);
      setPreRewardTokens(null);
    }
  }, [gameState, setPreRewardBet, setPreRewardTokens]);

  // A counter növelésére szolgáló callback
  const incrementHitCounter = useCallback(() => {
    setHitCounter(prevCount => (prevCount === null ? 1 : prevCount + 1));
  }, []);

  // A counter nullázására szolgáló callback
  const resetHitCounter = useCallback(() => {
    setHitCounter(null);
  }, []);

  const resetGameVariables = useCallback(() => {
    setPreRewardBet(null);
    setPreRewardTokens(null);
    setInsPlaced(false);
    setShowInsLost(false);
    setHasHitTurn(false);
    setHasOver21(false);
    setIsSplitted(false);
    setHasSplitNat21(false);
    setHitCounter(null);
    setIsWFSR(false);
  }, []);

  const handlePlaceBet = useCallback(async (amount: number) => {
    if (gameState.tokens >= amount && amount > 0) {
      setIsWFSR(true);
      try {
        const data = await setBet(amount);
        const response = extractGameStateData(data);

        if (response) {
          transitionToState('BETTING', response);
        }
      } catch {
        transitionToState('ERROR');
      } finally {
        setIsWFSR(false);
      }
    }
  }, [gameState.tokens, transitionToState]);

  const handleRetakeBet = useCallback(async () => {
    if (gameState.bet_list) {
      setIsWFSR(true);
      try {
        const data = await takeBackDeal();
        const response = extractGameStateData(data);

        if (response) {
          transitionToState('BETTING', response);
        }
      } catch {
        transitionToState('ERROR');
      } finally {
        setIsWFSR(false);
      }
    }
  }, [gameState.bet_list, transitionToState]);

  const handleStartGame = useCallback((shouldShuffle: boolean) => {
    if (shouldShuffle) {
      transitionToState('SHUFFLING');
    } else {
      transitionToState('INIT_GAME');
    }
  }, [transitionToState]); // Függőség: transitionToState

  const handleHitRequest = useCallback(async () => {
    setIsWFSR(true);
    setShowInsLost(false);
    savePreActionState();

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);
      if (response && response.player) {
        const playerHandValue = response.player[1];
        if (playerHandValue >= 21) {
          setHasOver21(true);
        }
        setHasHitTurn(true);
        transitionToState('MAIN_TURN', response);
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [transitionToState, savePreActionState]);

  const handleStandRequest = useCallback(async () => {
    setIsWFSR(true);
    setShowInsLost(false);
    savePreActionState();

    try {
      await handleStand();
      const rewards = await handleReward(false);
      const resp = extractGameStateData(rewards);
      transitionToState('MAIN_STAND', resp);
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [transitionToState, savePreActionState]);

  const handleDoubleRequest = useCallback(async () => {
    setIsWFSR(true);
    setShowInsLost(false);

    try {
      const doubleResponse = await handleDouble();
      const doubledState = extractGameStateData(doubleResponse);

      if (doubledState && doubledState.player && doubledState.tokens) {
        setPreRewardBet(doubledState.player[5]);
        setPreRewardTokens(doubledState.tokens);

        const hitResponse = await handleHit();
        const hitState = extractGameStateData(hitResponse);

        if (hitState) {
          await handleStand();
          const rewardsResponse = await handleReward(false);
          const finalState = extractGameStateData(rewardsResponse);

          if (finalState) {
            transitionToState('MAIN_STAND', finalState);
          }
        }
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [transitionToState, setPreRewardBet, setPreRewardTokens]);

  const handleInsRequest = useCallback(async () => {
    setIsWFSR(true);
    setInsPlaced(true);
    savePreActionState();

    const insWon = gameState.dealer[5] === 3 ? true : false;

    try {
      const data = await handleInsurance();
      const resp = extractGameStateData(data);
      if (insWon) {
        transitionToState('MAIN_STAND', resp);
      } else {
        setShowInsLost(true);
        transitionToState('MAIN_TURN', resp);
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [transitionToState, gameState, savePreActionState]);


  // SPLIT part
  const handleSplitRequest = useCallback(async () => {
    setIsWFSR(true);
    setShowInsLost(false);
    setIsSplitted(true);
    savePreActionState();

    try {
      const response = await splitHand()
      const resp = extractGameStateData(response);
      if (resp && resp.player) {
        if (resp.player[6] === 1 || resp.player[6] === 2) {
          transitionToState('SPLIT_NAT21_TRANSIT', resp);
        } else {
          transitionToState('SPLIT_TURN', resp);
        }
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [savePreActionState, transitionToState]);

  const handleSplitHitRequest = useCallback(async () => {
    setIsWFSR(true);
    setHasHitTurn(true);

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);
      const newHitCounter = hitCounter === null ? 1 : hitCounter + 1;
      incrementHitCounter();

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21) {
          if (newHitCounter === 1) {
            setHasOver21(true);
            transitionToState('SPLIT_STAND_DOUBLE', response);
          }
          else {
            setHasOver21(true);
            transitionToState('SPLIT_STAND', response);
          }
        }
        else {
          transitionToState('SPLIT_TURN', response);
        }
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [hitCounter, incrementHitCounter, transitionToState]);

  const handleSplitStandRequest = useCallback(async () => {
    setIsWFSR(true); // reset in case state

    if (hasHitTurn === false) {
      transitionToState('SPLIT_STAND_DOUBLE');
    } else {
      transitionToState('SPLIT_STAND');
    }
  }, [hasHitTurn, transitionToState]);

  const handleSplitDoubleRequest = useCallback(async () => {
    setIsWFSR(true);
    setHasHitTurn(true);

    try {
      const doubleResponse = await handleDouble();
      const doubledState = extractGameStateData(doubleResponse);

      if (doubledState && doubledState.player && doubledState.tokens) {
        const data = await handleHit();
        const response = extractGameStateData(data);
        if (response) {
          transitionToState('SPLIT_STAND_DOUBLE', response);
        }
      } else {
        transitionToState('SPLIT_TURN');
      }
    } catch {
      transitionToState('ERROR');
    } finally {
      setIsWFSR(false);
    }
  }, [transitionToState]);

  // --- useEffect blokkok ---

  useEffect(() => {
    isMountedRef.current = true;
    //console.log("isMountedRef: Komponens mountolva, isMountedRef.current = true");

    return () => {
      isMountedRef.current = false;
      //console.log("isMountedRef: Komponens unmountolva, isMountedRef.current = false");
    };
  }, []);

  // MÁSODIK (FŐ) useEffect: Játékállapot változások kezelése
  useEffect(() => {
    //console.log("Fő useEffect futott. Jelenlegi állapot:", gameState.currentGameState);
    // Minden újrafutáskor töröljük az előzőleg beállított időzítőt, ha van.
    // Ez megakadályozza, hogy több időzítő fusson egyszerre, vagy "szellem" időzítők maradjanak.
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null; // Fontos, hogy nullázzuk is
    }

    // --- LOADING ÁLLAPOT KEZELÉSE ---
    if (gameState.currentGameState === 'LOADING') {
      const initializeApplicationOnLoad = async () => {
        try {
          const minLoadingTimePromise = new Promise(resolve => setTimeout(resolve, 7000));

          await Promise.all([
            initializeSessionAPI(),
            minLoadingTimePromise
          ]);

          const tokensResponse = await getTokensAPI() as TokensResponse;
          const deckLenResponse = await getDeckLenAPI() as DeckLenResponse;

          const userTokens = tokensResponse.user_tokens;
          const deckLength = deckLenResponse.deckLen;

          setInitDeckLen(gameState.deckLen);

          if (userTokens === 0) {
            transitionToState('OUT_OF_TOKENS');
          } else {
            transitionToState('BETTING', {
              tokens: userTokens,
              deckLen: deckLength,
            });
          }
        } catch (error) {
          console.error("ERROR: ", error);
          transitionToState('ERROR', {
            tokens: 0,
            deckLen: 0,
          });
        }
      };

      initializeApplicationOnLoad();
    }

    // --- A SHUFFLING ÁLLAPOT KEZELÉSE ---
    else if (gameState.currentGameState === 'SHUFFLING') {
      const shufflingAct = async () => {
        // Early exit if component unmounted while awaiting (optional but good practice)
        if (!isMountedRef.current) {
          return;
        }

        try {
          const data = await getShuffling();
          const response = extractGameStateData(data);

          if (!isMountedRef.current) {
            return;
          }

          if (response) {
            timeoutIdRef.current = window.setTimeout(() => {
              // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
              if (isMountedRef.current) {
                transitionToState('INIT_GAME', response);
              }
            }, 5000);
          }
        } catch (e) {
          // EZ A BLOKK FUT LE, HA A GETSHUFFLING() VAGY AZ EXTRACTGAMESTATEDATA() HIBÁVAL VÉGZŐDIK!
          console.error("SHUFFLING: Hiba a SHUFFLING fázisban:", e);
          if (isMountedRef.current) {
            transitionToState('ERROR');
          }
        }
      };
      shufflingAct();
    }

    else if (gameState.currentGameState === 'INIT_GAME') {
      const InitGame = async () => {
        setIsWFSR(true);
        resetGameVariables();
        setInitDeckLen(gameState.deckLen);

        try {
          const data = await startGame();
          const response = extractGameStateData(data);

          if (response && response.dealer) {
            if (response.dealer[5] === 1 || response.dealer[5] === 2) {
              savePreActionState();
              const rewards = await handleReward(false);
              const resp = extractGameStateData(rewards);
              transitionToState('MAIN_STAND', resp);
            } else {
              transitionToState('MAIN_TURN', response);
            }
          }
        } catch {
          transitionToState('ERROR');
        } finally {
          setIsWFSR(false);
        }
      };
      InitGame();
    }

    else if (gameState.currentGameState === 'MAIN_TURN') {
      const MainTurn = async () => {
        setIsWFSR(true);

        try {
          if (hasOver21) {
            await handleStand();
            const rewards = await handleReward(false);
            const resp = extractGameStateData(rewards);
            transitionToState('MAIN_STAND', resp);
          }
        } catch {
          transitionToState('ERROR');
        } finally {
          setIsWFSR(false);
        }
      };
      MainTurn();
    }

    else if (gameState.currentGameState === 'MAIN_STAND') {
      if (!isMountedRef.current) return;

      timeoutIdRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          if (gameState.tokens === 0) {
            transitionToState('OUT_OF_TOKENS');
          } else {
            const nextRoundGameState: Partial<GameStateData> = {
              currentGameState: 'BETTING',
              player: [[], 0, 0, false, false, 0, 0],
              dealer: [[], [], 0, 0, false, 0],
              deckLen: gameState.deckLen, // A deckLen értéke is átkerül
              tokens: gameState.tokens,
              bet: 0,
              bet_list: [],
              players: [],
              winner: 0,
              is_round_active: true,
            };
            transitionToState('BETTING', nextRoundGameState);
          }
        }
      }, 4000);
    }

    else if (gameState.currentGameState === 'SPLIT_STAND' || gameState.currentGameState === 'SPLIT_STAND_DOUBLE') {
      setIsWFSR(true);
      setHasHitTurn(false); // See handleSplitStandRequest
      setHasOver21(false);
      resetHitCounter();

      const SplitStand = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          const data = await updateSplitPlayersByStand();
          const response = extractGameStateData(data);

          if (response && response.splitReq && response.splitReq > 0) {
            const splitResponse = await splittedToHand();
            const ans = extractGameStateData(splitResponse);

            if (ans && ans.player) {
              if (ans.player[0].length === 2 && (ans.player[6] === 1 || ans.player[6] === 2)) {
                if (gameState.currentGameState === 'SPLIT_STAND_DOUBLE') {
                  timeoutIdRef.current = window.setTimeout(() => {
                    // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                    if (isMountedRef.current) {
                      transitionToState('SPLIT_NAT21_TRANSIT', ans);
                    }
                  }, 2000);
                } else {
                  transitionToState('SPLIT_NAT21_TRANSIT', ans);
                }
              } else {
                if (hasSplitNat21) {
                  setHasSplitNat21(false);
                  transitionToState('SPLIT_TURN', ans);
                } else {
                  timeoutIdRef.current = window.setTimeout(() => {
                    // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                    if (isMountedRef.current) {
                      transitionToState('SPLIT_TURN', ans);
                    }
                  }, 2000);
                }
              }
            }
          } else {
            if (hasSplitNat21) {
              setHasSplitNat21(false);
              transitionToState('SPLIT_FINISH', response);
            } else {
              timeoutIdRef.current = window.setTimeout(() => {
                // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                if (isMountedRef.current) {
                  transitionToState('SPLIT_FINISH', response);
                }
              }, 2000);
            }
          }
        } catch {
          transitionToState('ERROR');
        } finally {
          setIsWFSR(false);
        }
      };
      SplitStand();
    }

    else if (gameState.currentGameState === 'SPLIT_NAT21_TRANSIT') {
      setHasSplitNat21(true);

      const SplitNat21Transit = async () => {
        if (!isMountedRef.current) return;

        try {
          timeoutIdRef.current = window.setTimeout(() => {
            if (isMountedRef.current) {
              transitionToState('SPLIT_STAND');
            }
          }, 2000);
        } catch {
          transitionToState('ERROR');
        }
      };
      SplitNat21Transit();
    }

    else if (gameState.currentGameState === 'SPLIT_FINISH') {
      setHasHitTurn(false);

      const SplitFinish = async () => {
        try {
          savePreActionState();
          const standData = await handleStand();
          const stand = extractGameStateData(standData);

          const rewardData = await handleReward(true);
          const reward = extractGameStateData(rewardData);

          if (reward && reward?.players && stand) {
            const combinedState = { ...stand, ...reward };
            transitionToState('SPLIT_FINISH_TRANSIT', combinedState);
          } else {
            transitionToState('ERROR')
          }
        } catch (e) {
          console.error("Hiba a SPLIT_FINISH fázisban:", e);
          transitionToState('ERROR');
        }
      };
      SplitFinish();
    }

    else if (gameState.currentGameState === 'SPLIT_FINISH_TRANSIT') {
      const SplitFinishTransit = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          const gameData = await getGameData();
          const data = extractGameStateData(gameData);
          if (data && data.players) {
            if (data.players.length === 0) {
              if (data.tokens === 0) {
                // If tokens are zero, transition to the game over state
                // We don't need a new state object here, as OUT_OF_TOKENS handles this
                transitionToState('OUT_OF_TOKENS');
              } else {
                setHasHitTurn(false);
                setHasOver21(false);
                timeoutIdRef.current = window.setTimeout(() => {
                  // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                  if (isMountedRef.current) {
                    transitionToState('BETTING', {
                      currentGameState: 'BETTING',
                      player: [[], 0, 0, false, false, 0, 0],
                      dealer: [[], [], 0, 0, false, 0],
                      deckLen: gameState.deckLen,
                      tokens: gameState.tokens,
                      bet: 0,
                      bet_list: [],
                      players: [],
                      winner: 0,
                      is_round_active: true,
                    });
                  }
                }, 4000);
              }
            } else {
              const updateData = await updatePlayerFromPlayers();
              const response = extractGameStateData(updateData);
              timeoutIdRef.current = window.setTimeout(() => {
                // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                if (isMountedRef.current) {
                  transitionToState('SPLIT_FINISH', response);
                }
              }, 4000);
            }
          }
        } catch (e) {
          console.error("Hiba a SPLIT_FINISH_TRANSIT fázisban:", e);
          transitionToState('ERROR')
        }
      };
      SplitFinishTransit();
    }

    else if (gameState.currentGameState === 'OUT_OF_TOKENS') {
      const HandleOutOfTokens = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          const data = await setRestart();
          const response = extractGameStateData(data);
          if (response) {
            timeoutIdRef.current = window.setTimeout(() => {
              // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
              transitionToState('RESTART_GAME', response);
            }, 5000);
          }
        } catch (e) {
          console.error("Hiba a RESTART_GAME fázisban:", e);
          transitionToState('ERROR');
        }
      };
      HandleOutOfTokens();
    }

    else if (gameState.currentGameState === 'RESTART_GAME') {
      const RestartGame = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          resetGameVariables();
          timeoutIdRef.current = window.setTimeout(() => {
            // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
            transitionToState('RELOADING');
          }, 5000);
        } catch (e) {
          console.error("Hiba a RESTART_GAME fázisban:", e);
          transitionToState('ERROR');
        }
      };
      RestartGame();
    }

    else if (gameState.currentGameState === 'ERROR') {
      const ForceRestart = async () => {
        if (!isMountedRef.current) return;

        await new Promise(resolve => setTimeout(resolve, 5000));

        setIsWFSR(true);

        try {
          const data = await forceRestart();
          const response = extractGameStateData(data);
          if (response) {
            transitionToState('RELOADING', response);
          }
        } catch (error) {
          console.error("Hiba a kényszerített újraindítás során:", error);
        } finally {
          setIsWFSR(false);
        }
      };
      ForceRestart();
    }

    else if (gameState.currentGameState === 'RELOADING') {
      const Reloading = async () => {
        if (!isMountedRef.current) return;

        try {
          timeoutIdRef.current = window.setTimeout(() => {
            // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
            transitionToState('BETTING', gameState);
          }, 5000);
        } catch (error) {
          console.error("Error: ", error);
        }
      };
      Reloading();
    }

  }, [gameState, transitionToState, savePreActionState, isMountedRef, timeoutIdRef, resetHitCounter, hasSplitNat21, resetGameVariables, setInitDeckLen, hasOver21]);

  return {
    gameState,
    currentGameState: gameState.currentGameState,
    transitionToState,
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
    hasOver21,
    isSplitted,
    hitCounter,
    showInsLost,
    initDeckLen,
    isWFSR,
  };
}
