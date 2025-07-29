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
    //console.error("extractGameStateData Hiba: Az API válasz nem objektum vagy null.");
    return undefined;
  }

  if (!('current_tokens' in apiResponse) || typeof (apiResponse as { current_tokens: unknown }).current_tokens !== 'number' ||
    !('game_state' in apiResponse) || typeof (apiResponse as { game_state: unknown }).game_state !== 'object' ||
    (apiResponse as { game_state: unknown }).game_state === null) {
    //console.error("extractGameStateData Hiba: Az API válasz szerkezete nem a várt. Hiányzik 'current_tokens' vagy 'game_state'.", apiResponse);
    return undefined;
  }

  //console.log("apiRespones: ", apiResponse)
  const token: number = apiResponse.current_tokens as number;
  const rawGameState: Partial<GameStateData> = apiResponse.game_state as Partial<GameStateData>;
  //console.log("rawGameStae:", rawGameState)
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

export function formatNumber(number: number) {
  return number.toLocaleString("en-US");
}

/* export function loop(data: (string | number)[]): string {
  // Convert all elements to strings and join them with "  + "
  const item = data.map(value => String(value)).join("  + ");

  // If the array is empty, join() returns an empty string, so no need for slice.
  // If the array is not empty, join() does not add trailing separator, so no need for slice.
  return item;
} */

export function loop(data: any) {
  let item = "";
  for (let i = 0; i < data.length; i++) {
    item += data[i] + "  + ";
  }
  item = item.slice(0, -2);
  return item;
}

export function formatCard(card: any) {
  if (card.trim() === "✪") {
    return `<span class="red-suit">✪</span>`;
  }

  const suit = card[0];
  const value = card.substring(1).trim();

  let suitClass = "";
  if (suit === "♥" || suit === "♦") {
    suitClass = "red-suit";
  } else if (suit === "♠" || suit === "♣") {
    suitClass = "black-suit";
  } else {
    console.log("card: ",card)
    return card;
  }

  return `<span class="${suitClass}">${suit}</span>${value}`;
}

export function formatHand(data: any) {
  const card = data.split(/\s*\+\s*/);
  const formattedCardsHTML = card.map((card: any) => formatCard(card.trim()));
  return formattedCardsHTML.join(' <span class="equal-text">+</span> ');
}
