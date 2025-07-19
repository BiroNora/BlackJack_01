import type { DealerData, GameState, GameStateData, PlayerData } from "../types/game-types";

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function extractGameStateData(apiResponse: unknown): Partial<GameStateData> | undefined {
  if (typeof apiResponse !== 'object' || apiResponse === null) {
    console.error("extractGameStateData Hiba: Az API válasz nem objektum vagy null.");
    return undefined;
  }

  if (!('current_tokens' in apiResponse) || typeof (apiResponse as { current_tokens: unknown }).current_tokens !== 'number' ||
    !('game_state' in apiResponse) || typeof (apiResponse as { game_state: unknown }).game_state !== 'object' ||
    (apiResponse as { game_state: unknown }).game_state === null) {
    console.error("extractGameStateData Hiba: Az API válasz szerkezete nem a várt. Hiányzik 'current_tokens' vagy 'game_state'.", apiResponse);
    return undefined;
  }

  console.log("apiRespones: ", apiResponse)
  const token: number = apiResponse.current_tokens as number;
  const rawGameState: Partial<GameStateData> = apiResponse.game_state as Partial<GameStateData>;
  console.log("rawGameStae:", rawGameState)
  try {
    const processedData: Partial<GameStateData> = {
      currentGameState: rawGameState.currentGameState as GameState,
      player: rawGameState.player as PlayerData,
      dealer: rawGameState.dealer as DealerData,
      deckLen: rawGameState.deckLen as number,
      tokens: token,
      splitReq: rawGameState.splitReq as number,
      bet: rawGameState.bet as number,
      bet_list: rawGameState.bet_list as number[],
      players: rawGameState.players as PlayerData[],
      winner: rawGameState.winner as number,
      is_round_active: rawGameState.is_round_active as boolean,
    };
    return processedData;
  } catch (e) {
    console.error("extractGameStateData Hiba: Hiba történt a game_state mezőinek kinyerésekor.", e);
    return undefined;
  }
}
