// frontend/src/hooks/useGameStateMachine.ts

import { useState, useEffect, useCallback } from 'react';
import {
  initializeSessionAPI,
  getTokensAPI,
  getDeckLenAPI,
  setBet,
  takeBackDeal,
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

  useEffect(() => {
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
      // Például: Itt történne valami, amikor a játékos tétet tett, és át kell váltani a kártyaosztásra.
      // Ezt valószínűleg egy külön függvény (pl. handlePlaceBet) hívná meg,
      // ami aztán a transitionToState-tel váltana.
      console.log("Játék a BETTING állapotban. Várjuk a tétet...");
      // Ebben a fázisban valószínűleg nem történik automatikus állapotváltás a useEffect-ből,
      // hanem egy felhasználói interakció (tétrakás gomb megnyomása) indítja el.
      // AZONBAN: ha valamilyen időzítő vagy automatikus folyamat van itt, azt ide írnád.
    }
  }, [gameState.currentGameState, transitionToState]);

  return {
    gameState,
    transitionToState,
    handlePlaceBet,
    handleRetakeBet,
  };
}
