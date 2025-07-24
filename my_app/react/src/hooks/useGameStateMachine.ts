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
  handleInsurance,
  handleDouble,
  splitHand,
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
      console.log("!!!!!!Pre-reward bet elmentve:", gameState.player[5]);
      console.log("!!!!!: ", gameState.player)
      console.log("!!!!!!Pre-reward tokens elmentve:", gameState.tokens);
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

  const handleHitRequest = useCallback(async () => {
    setShowInsLost(false);
    savePreActionState();

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21) {
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

  const handleSplitRequest = useCallback(async () => {
    setShowInsLost(false);
    savePreActionState();

    try {
      const response = await splitHand()
      const resp = extractGameStateData(response);
      transitionToState('SPLIT_START', resp);
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState, savePreActionState]);

  const handleSplitHitRequest = useCallback(async () => {
    savePreActionState();

    try {
      const data = await handleHit();
      const response = extractGameStateData(data);

      if (response && response.player) {
        const playerHandValue = response.player[1];

        if (playerHandValue >= 21) {
          transitionToState('SPLIT_TURN', response);
        } else {
          transitionToState('SPLIT_START', response);
        }
      }
    } catch {
      transitionToState('ERROR');
    }
  }, [transitionToState, savePreActionState]);

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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined; // 'undefined' is important here
    let isMounted = true;

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
            await new Promise(resolve => setTimeout(resolve, 2000));
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
        setInsPlaced(false);
        setShowInsLost(false);
        setHasHitTurn(false);

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
              console.log("handleStartGame - INIT_GAME to MAIN_TURN:", response);
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
      console.log("Játék a MAIN_TURN állapotban.");
    }

    else if (gameState.currentGameState === 'MAIN_STAND') {
      console.log("Játék a MAIN_STAND állapotban.");
      console.log("Játék a MAIN_STAND állapotban. Vár 2 másodpercet...");

      timeoutId = setTimeout(() => {
        if (isMounted) {
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
      }, 3000);
    }

    return () => { // CLEANUP FÜGGVÉNY
      isMounted = false; // Jelezzük, hogy a komponens lecsatolódik
      if (timeoutId) { // Fontos ellenőrizni, hogy timeoutId kapott-e értéket
        clearTimeout(timeoutId); // Töröljük az időzítőt
      }
    };

  }, [gameState, savePreActionState, transitionToState]);

  return {
    gameState,
    transitionToState,
    handlePlaceBet,
    handleRetakeBet,
    handleStartGame,
    handleHitRequest,
    handleStandRequest,
    handleDoubleRequest,
    handleSplitRequest,
    handleSplitHitRequest,
    handleInsRequest,
    preRewardBet,
    preRewardTokens,
    insPlaced,
    hasHitTurn,
    showInsLost,
  };
}
