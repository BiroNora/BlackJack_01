import type { ErrorResponse } from "../types/game-types";
import { generateUUID } from "../utilities/utils";

export async function initializeSessionAPI() {
  try {
    // 1. Lekérjük/generáljuk a kliens egyedi azonosítóját (client_id) a böngésző localStorage-jából.
    let clientUuid = localStorage.getItem('blackjack_client_uuid');
    if (!clientUuid) {
      clientUuid = generateUUID(); // Generálunk egy újat, ha még nincs
      localStorage.setItem('blackjack_client_uuid', clientUuid); // Elmentjük a böngészőbe
      console.log("Új client_id generálva és elmentve:", clientUuid);
    } else {
      console.log("Meglévő client_id betöltve:", clientUuid);
    }

    // 2. Meghívjuk a szerveren lévő /api/initialize_session API-t,
    //    ÉS ELKÜLDJÜK A CLIENT_ID-T A KÉRÉS TESTÉBEN JSON FORMÁTUMBAN.
    const response = await fetch("/api/initialize_session", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientUuid
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP hiba! státusz: ${response.status}`);
    }

    const data = await response.json();
    //console.log('Session inicializálás válasz:', data);

    // Frissítjük a localStorage-t, ha a szerver esetleg új client_id-t küld vissza
    if (data.client_id && data.client_id !== clientUuid) {
      localStorage.setItem('blackjack_client_uuid', data.client_id);
      //console.log("client_id frissítve a szerver válasza alapján:", data.client_id);
    }

    return data; // Visszaadjuk a szerver válaszát (tartalmazza a message-t, user_id-t, client_id-t)
  } catch (error) {
    console.error("Error: ", error);
    throw error;
  }
}

export async function getTokensAPI(): Promise<unknown | null> {
  const data = await callApiEndpoint("/api/get_init_tokens_from_db", "GET");

  //console.log("getTokensAPI API response:", data);
  return data;
}

export async function getDeckLenAPI() {
  const data = await callApiEndpoint("/api/get_deck_len", "GET");

  //console.log("getDeckLenAPI API response:", data);
  return data;
}

export async function getTokens() {
  const data = await callApiEndpoint("/api/get_tokens_from_db", "GET");

  //console.log("getTokens API response:", data);
  return data;
}

export async function setBet(betAmount: number) {
  const data = await callApiEndpoint("/api/bet", "POST", { bet: betAmount });

  //console.log("setBet API response:", data);
  return data;
}

export async function takeBackDeal() {
  const data = await callApiEndpoint("/api/retake_bet", "POST");

  //console.log("takeBackDeal API response:", data);
  return data;
}

export async function getShuffling() {
  const data = await callApiEndpoint("/api/create_deck", "POST");

  return data;
}

export async function startGame() {
  const data = await callApiEndpoint("/api/start_game", "POST");

  //console.log("startGame API response:", data);
  return data;
}

export async function getGameData() {
  const data = await callApiEndpoint("/api/get_game_data", "GET");

  //console.log("getGameData API response:", data);
  return data;
}

export async function handleHit() {
  const data = await callApiEndpoint("/api/hit", "POST");

  //console.log("handleHit API response:", data);
  return data;
}

export async function handleStand() {
  const data = await callApiEndpoint("/api/stand", "POST");

  //console.log("handleStand API response:", data);
  return data;
}

export async function handleReward(is_splitted: boolean) {
  const data = await callApiEndpoint("/api/rewards", "POST", { is_splitted: is_splitted });

  //console.log("handleReward API response:", data);
  return data;
}

export async function handleInsurance() {
  const data = await callApiEndpoint("/api/ins_request", "POST");

  console.log("handleInsurance API response:", data);
  return data;
}

export async function handleDouble() {
  const data = await callApiEndpoint("/api/double_request", "POST");

  console.log("handleDouble API response:", data);
  return data;
}

export async function splitHand() {
  const data = await callApiEndpoint("/api/split_request", "POST");

  console.log("splitHand API response:", data);
  return data;
}

export async function splittedToHand() {
  const data = await callApiEndpoint("/api/add_split_player_to_game", "POST");

  console.log("splittedToHand API response:", data);
  return data;
}

export async function updateSplitPlayersByStand() {
  const data = await callApiEndpoint("/api/add_to_list_by_stand", "POST");

  //console.log("updateSplitPlayersByStand API response:", data);
  return data;
}

export async function updatePlayerFromPlayers() {
  const data = await callApiEndpoint("/api/add_player_from_players", "POST");

  //console.log("updatePlayerFromPlayers API response:", data);
  return data;
}

export async function setRestart() {
  const data = await callApiEndpoint("/api/set_restart", "POST");

  //console.log("setRestart API response:", data);
  return data;
}

export async function roundToEnd() {
  const data = await callApiEndpoint("/api/round_end", "POST");

  //console.log("roundToEnd API response:", data);
  return data;
}

export async function callApiEndpoint<T>(
  endpoint: string,
  method: string = 'GET', // Alapértelmezett legyen GET, ha nincs megadva
  body?: unknown
): Promise<T> { // <--- Visszatérési típus: Promise<T>
  try {
    const options: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      // Próbáljuk meg kinyerni a hiba részleteit JSON formátumban
      let errorData: ErrorResponse = {};
      try {
        errorData = await response.json();
      } catch {
        // Ha nem JSON a hiba válasz, akkor egyszerűen csak egy üzenetet használunk
        errorData = { message: "Ismeretlen API válasz formátum (nem JSON)." };
      }

      const status = response.status;
      const statusText = response.statusText || 'Ismeretlen hiba';
      const errorMessage = errorData.message || `HTTP hiba! Státusz: ${status} ${statusText}.`;

      console.error(
        `API hiba a(z) '${endpoint}' végponton (státusz: ${status}):`,
        errorData
      );

      // Dobunk egy hibát, amit a hívó fél el tud kapni
      throw new Error(errorMessage);
    }

    // Ha a válasz sikeres, de nincs tartalom (pl. 204 No Content), akkor üres objektumot adjunk vissza
    // Különben próbáljuk meg JSON-ként feldolgozni
    if (response.status === 204) {
      return {} as T; // Sikeres, de üres válasz esetén üres objektumot adunk vissza, típuskényszerítve T-re
    }

    const data = await response.json();
    return data as T; // Típuskényszerítés a generikus T típusra
  } catch (error: unknown) {
    // Ez a blokk hálózati hibákat (pl. nincs internet) vagy az előző throw-ált hibákat kapja el
    console.error(`Hálózati vagy feldolgozási hiba a(z) '${endpoint}' végponton:`, error);
    throw error; // Fontos: továbbdobja a hibát, hogy a hívó fél kezelhesse!
  }
}
