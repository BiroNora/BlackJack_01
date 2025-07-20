// frontend/src/hooks/useGameStateMachine.ts

import { useState, useEffect, useCallback } from 'react';
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

  const handlePlaceBet = useCallback(async (amount: number) => {
    if (gameState.tokens >= amount && amount > 0) {
      try {
        const data = await setBet(amount);
        const response = extractGameStateData(data);

        if (response) {
          console.log("handlePlaceBet - Feldolgozott GameState adat (ezt kapja az állapot):", response);
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
          console.log("handleRetakeBet - Feldolgozott GameState adat (ezt kapja az állapot):", response);
          transitionToState('BETTING', response);
        }
      } catch {
        transitionToState('ERROR');
      }
    }
  }, [gameState.bet_list, transitionToState]);

  const handleStartGame = useCallback((shouldShuffle: boolean) => {
    if (shouldShuffle) {
      console.log("Pakli hossza nem megfelelő, keverés szükséges.");
      transitionToState('SHUFFLING');
    } else {
      console.log("Pakli rendben, játék indítása.");
      transitionToState('INIT_GAME');
    }
  }, [transitionToState]); // Függőség: transitionToState

  const handleHitRequest = useCallback(async (isDouble: boolean) => {
    try {
      const data = await handleHit();
      const response = extractGameStateData(data);

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21 || isDouble) {
          await handleStand();
          const rewards = await handleReward(false);
          const resp = extractGameStateData(rewards);
          transitionToState('MAIN_STAND', resp);
        } else {
          transitionToState('MAIN_TURN', response);
        }
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | null = null;

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
      console.log("Játék a BETTING állapotban. Várjuk a tétet...");
    }

    // --- A SHUFFLING ÁLLAPOT KEZELÉSE ---
    else if (gameState.currentGameState === 'SHUFFLING') {
      console.log("Játék a SHUFFLING állapotban.");
      const shufflingAct = async () => {
        try {
          const data = await getShuffling();
          const response = extractGameStateData(data);

          if (response) {
            console.log("handleStartGame - SHUFFLING to INIT_GAME:", response);
            await new Promise(resolve => setTimeout(resolve, 4000));
            transitionToState('INIT_GAME', response);
          }
        } catch {
          transitionToState('ERROR');
        }
      };
      shufflingAct();
    }

    else if (gameState.currentGameState === 'INIT_GAME') {
      console.log("Játék a INIT_GAME állapotban.");
      const InitGame = async () => {
        try {
          const data = await startGame();
          const response = extractGameStateData(data);

          if (response) {
            console.log("handleStartGame - INIT_GAME to MAIN_TURN:", response);
            transitionToState('MAIN_TURN', response);
          }
        } catch {
          transitionToState('ERROR');
        }
      };
      InitGame();
    }

    else if (gameState.currentGameState === 'MAIN_TURN') {
      console.log("Játék a MAIN_TURN állapotban.");

    }

    else if (gameState.currentGameState === 'MAIN_STAND') {
      console.log("Játék a MAIN_STAND állapotban.");
      console.log("Játék a MAIN_STAND állapotban. Vár 2 másodpercet...");
      timeoutId = setTimeout(() => {
        if (isMounted) { // Ellenőrizzük, hogy a komponens még "él-e"
          transitionToState('BETTING');
        }
      }, 3000);
    }
    return () => { // CLEANUP FÜGGVÉNY
      isMounted = false; // Jelezzük, hogy a komponens lecsatolódik
      if (timeoutId) {
        clearTimeout(timeoutId); // Töröljük az időzítőt
      }
    };

  }, [gameState.currentGameState, transitionToState]);

  return {
    gameState,
    transitionToState,
    handlePlaceBet,
    handleRetakeBet,
    handleStartGame,
    handleHitRequest,
  };
}
