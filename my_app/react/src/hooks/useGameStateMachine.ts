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
  deckLen: 0,
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
      //console.log(`>>> Állapotváltás: ${prev.currentGameState} -> ${newState}`, updatedState);
      return updatedState;
    });
  }, []);

  const savePreActionState = useCallback(() => {
    if (gameState) {
      setPreRewardBet(gameState.player[5]);
      setPreRewardTokens(gameState.tokens);
      //console.log("!!!!!!Pre-reward bet elmentve:", gameState.player[5]);
      //console.log("!!!!!!Pre-reward tokens elmentve:", gameState.tokens);
    } else {
      setPreRewardBet(null);
      setPreRewardTokens(null);
    }
  }, [gameState, setPreRewardBet, setPreRewardTokens]);

  const handlePlaceBet = useCallback(async (amount: number) => {
    if (gameState.tokens >= amount && amount > 0) {
      try {
        const data = await setBet(amount);
        const response = extractGameStateData(data);

        if (response) {
          //console.log("handlePlaceBet - Feldolgozott GameState adat (ezt kapja az állapot):", response);
          transitionToState('BETTING', response);
        }
      } catch {
        transitionToState('ERROR');
      }
    }
  }, [gameState.tokens, transitionToState]);

  const handleRetakeBet = useCallback(async () => {
    if (gameState.bet_list) {
      try {
        const data = await takeBackDeal();
        const response = extractGameStateData(data);

        if (response) {
          //console.log("handleRetakeBet - Feldolgozott GameState adat (ezt kapja az állapot):", response);
          transitionToState('BETTING', response);
        }
      } catch {
        transitionToState('ERROR');
      }
    }
  }, [gameState.bet_list, transitionToState]);

  const handleStartGame = useCallback((shouldShuffle: boolean) => {
    if (shouldShuffle) {
      //console.log("Pakli hossza nem megfelelő, keverés szükséges.");
      transitionToState('SHUFFLING');
    } else {
      //console.log("Pakli rendben, játék indítása.");
      transitionToState('INIT_GAME');
    }
  }, [transitionToState]); // Függőség: transitionToState

  const handleHitRequest = useCallback(async () => {
    setShowInsLost(false);
    savePreActionState();

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21) {
          setHasOver21(true);
          await handleStand();
          const rewards = await handleReward(false);
          const resp = extractGameStateData(rewards);
          transitionToState('MAIN_STAND', resp);
        } else {
          setHasHitTurn(true);
          transitionToState('MAIN_TURN', response);
        }
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState, savePreActionState]);

  const handleStandRequest = useCallback(async () => {
    setShowInsLost(false);
    savePreActionState();

    try {
      await handleStand();
      const rewards = await handleReward(false);
      const resp = extractGameStateData(rewards);
      transitionToState('MAIN_STAND', resp);
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState, savePreActionState]);

  const handleDoubleRequest = useCallback(async () => {
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
          const rewardsResponse = await handleReward(false);
          const finalState = extractGameStateData(rewardsResponse);

          if (finalState) {
            transitionToState('MAIN_STAND', finalState);
          }
        }
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState, setPreRewardBet, setPreRewardTokens]);

  const handleInsRequest = useCallback(async () => {
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
    }
  }, [transitionToState, gameState, savePreActionState]);


  // SPLIT part
  const handleSplitRequest = useCallback(async () => {
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
    }
  }, [savePreActionState, transitionToState]);

  const handleSplitHitRequest = useCallback(async () => {
    setHasHitTurn(true);

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21) {
          setHasOver21(true);
          transitionToState('SPLIT_STAND', response);
        } else {
          transitionToState('SPLIT_TURN', response);
        }
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState]);

  const handleSplitStandRequest = useCallback(async () => {
    transitionToState('SPLIT_STAND');
  }, [transitionToState]);

  const handleSplitDoubleRequest = useCallback(async () => {
    setHasHitTurn(true);

    try {
      const doubleResponse = await handleDouble();
      const doubledState = extractGameStateData(doubleResponse);

      if (doubledState && doubledState.player && doubledState.tokens) {
        const data = await handleHit();
        const response = extractGameStateData(data);
        if (response) {
          transitionToState('SPLIT_STAND', response);
        }
      } else {
        transitionToState('SPLIT_TURN');
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState]);

  // --- useEffect blokkok ---

  useEffect(() => {
    isMountedRef.current = true; // Mountoláskor igazra állítjuk
    console.log("isMountedRef: Komponens mountolva, isMountedRef.current = true");

    return () => {
      isMountedRef.current = false; // Unmountoláskor hamisra állítjuk
      console.log("isMountedRef: Komponens unmountolva, isMountedRef.current = false");
    };
  }, []);

  // MÁSODIK (FŐ) useEffect: Játékállapot változások kezelése
  useEffect(() => {
    console.log("Fő useEffect futott. Jelenlegi állapot:", gameState.currentGameState);
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
          const minLoadingTimePromise = new Promise(resolve => setTimeout(resolve, 4000));

          const [sessionData] = await Promise.all([
            initializeSessionAPI(),
            minLoadingTimePromise
          ]);
          console.log("Session data loaded:", sessionData);

          const tokensResponse = await getTokensAPI() as TokensResponse;
          const deckLenResponse = await getDeckLenAPI() as DeckLenResponse;

          const userTokens = tokensResponse.user_tokens;
          const deckLength = deckLenResponse.deckLen;

          console.log("Alkalmazás inicializálva. Tokenek:", userTokens, "Pakli hossza:", deckLength);

          if (userTokens === 0) {
            transitionToState('RESTART_GAME', {
              tokens: userTokens,
              deckLen: deckLength,
            });
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

    // --- A BETTING ÁLLAPOT KEZELÉSE ---
    else if (gameState.currentGameState === 'BETTING') {
      //console.log("Játék a BETTING állapotban. Várjuk a tétet...");
    }

    // --- A SHUFFLING ÁLLAPOT KEZELÉSE ---
    else if (gameState.currentGameState === 'SHUFFLING') {
      console.log("Játék a SHUFFLING állapotban."); // Ezt már látod
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
            }, 2000);
          } else {
            // EZ A BLOKK FUT LE, HA A RESPONSE ÉRVÉNYTELEN!
            console.warn("SHUFFLING: AZ 'extractGameStateData' ÉRVÉNYTELEN VÁLASZT ADOTT VISSZA!");
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
      //console.log("Játék a INIT_GAME állapotban.");
      const InitGame = async () => {
        setInsPlaced(false);
        setShowInsLost(false);
        setHasHitTurn(false);
        setHasOver21(false);
        setIsSplitted(false);

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
              //console.log("handleStartGame - INIT_GAME to MAIN_TURN:", response);
              transitionToState('MAIN_TURN', response);
            }
          }
        } catch {
          transitionToState('ERROR');
        }
      };
      InitGame();
    }

    else if (gameState.currentGameState === 'MAIN_TURN') {
      console.log("Játék a MAIN_TURN állapotban gameState.", gameState);
    }

    else if (gameState.currentGameState === 'MAIN_STAND') {
      console.log("Játék a MAIN_STAND állapotban.", gameState);
      //console.log("Játék a MAIN_STAND állapotban. Vár 2 másodpercet...");
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
      }, 3000);
    }

    else if (gameState.currentGameState === 'SPLIT_STAND') {
      //console.log("Játék a SPLIT_STAND állapotban.");
      setHasHitTurn(false);
      setHasOver21(false);

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
              if (ans.player[6] === 1 || ans.player[6] === 2) {
                timeoutIdRef.current = window.setTimeout(() => {
                  // Csak akkor váltsunk állapotot, ha a komponens még mountolva van!
                  if (isMountedRef.current) {
                    transitionToState('SPLIT_NAT21_STAND', ans);
                  }
                }, 2000);
              } else {
                timeoutIdRef.current = window.setTimeout(() => {
                  // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                  if (isMountedRef.current) {
                    transitionToState('SPLIT_TURN', ans);
                  }
                }, 2000);
              }
            }
          } else {
            timeoutIdRef.current = window.setTimeout(() => {
              // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
              if (isMountedRef.current) {
                transitionToState('SPLIT_FINISH', response);
              }
            }, 2000);
          }
        } catch {
          transitionToState('ERROR');
        }
      };
      SplitStand();
    }

    else if (gameState.currentGameState === 'SPLIT_NAT21_TRANSIT') {
      console.log("Játék a SPLIT_NAT21_TRANSIT állapotban.");
      console.log("SPLIT_NAT21_TRANSIT gameState: ", gameState)
      setHasHitTurn(false);
      setHasOver21(false);

      const SplitNat21Stand = async () => {
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
      SplitNat21Stand();
    }

    else if (gameState.currentGameState === 'SPLIT_NAT21_STAND') {
      console.log("Játék a SPLIT_NAT21_STAND állapotban.");
      console.log("SPLIT_NAT21_STAND gameState: ", gameState)
      setHasHitTurn(false);
      setHasOver21(false);

      const SplitNat21Stand = async () => {
        if (!isMountedRef.current) return;

        try {
          transitionToState('SPLIT_STAND');
        } catch {
          transitionToState('ERROR');
        }
      };
      SplitNat21Stand();
    }

    else if (gameState.currentGameState === 'SPLIT_FINISH') {
      console.log("Játék a SPLIT_FINISH állapotban. Elindítjuk a feldolgozást.");

      const SplitFinish = async () => {
        try {
          savePreActionState();
          console.log("SPLIT FINISH BEÉRKEZÉS: ", gameState)
          const standData = await handleStand();
          const stand = extractGameStateData(standData);
          console.log("SPLIT FINISH STAND: ", stand)
          const rewardData = await handleReward(true);
          const reward = extractGameStateData(rewardData);
          console.log("SPLIT FINISH REWARD: ", reward)
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
      console.log("Játék a SPLIT_FINISH_TRANSIT állapotban. Elindítjuk a feldolgozást.");

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
                }, 3000);
              }
            } else {
              const updateData = await updatePlayerFromPlayers();
              const response = extractGameStateData(updateData);
              timeoutIdRef.current = window.setTimeout(() => {
                // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
                if (isMountedRef.current) {
                  transitionToState('SPLIT_FINISH', response);
                }
              }, 3000);
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
      console.log("Játék a OUT_OF_TOKENS állapotban. Elindítjuk a feldolgozást.");

      const HandleOutOfTokens = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          const data = await setRestart();
          const response = extractGameStateData(data);
          if (response) {
            setHasHitTurn(false);
            setHasOver21(false);
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
      console.log("Játék a RESTART_GAME állapotban. Elindítjuk a feldolgozást.");

      const HandleOutOfTokens = async () => {
        if (!isMountedRef.current) return;

        try {
          if (!isMountedRef.current) return;
          setHasHitTurn(false);
          setHasOver21(false);
          timeoutIdRef.current = window.setTimeout(() => {
            // CSAK AKKOR VÁLTSUNK ÁLLAPOTOT, HA A KOMPONENS MÉG MOUNTOLVA VAN!
            transitionToState('LOADING');
          }, 3000);
        } catch (e) {
          console.error("Hiba a RESTART_GAME fázisban:", e);
          transitionToState('ERROR');
        }
      };
      HandleOutOfTokens();
    }

  }, [gameState,
    transitionToState,
    savePreActionState,
    isMountedRef,
    timeoutIdRef,
  ]);

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
    showInsLost,
  };
}
