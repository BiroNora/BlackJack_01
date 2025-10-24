import type { ErrorResponse } from "../types/game-types";
import { generateUUID } from "../utilities/utils";

export async function initializeSessionAPI() {
  try {
    // 1. Lekérjük/generáljuk a kliens egyedi azonosítóját (client_id) a böngésző localStorage-jából.
    let clientUuid = localStorage.getItem("blackjack_client_uuid");
    if (!clientUuid) {
      clientUuid = generateUUID(); // Generálunk egy újat, ha még nincs
      localStorage.setItem("blackjack_client_uuid", clientUuid); // Elmentjük a böngészőbe
    }

    // 2. Meghívjuk a szerveren lévő /api/initialize_session API-t,
    //    ÉS ELKÜLDJÜK A CLIENT_ID-T A KÉRÉS TESTÉBEN JSON FORMÁTUMBAN.
    const response = await fetch("/api/initialize_session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientUuid,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP hiba! státusz: ${response.status}`);
    }

    const data = await response.json();

    // Frissítjük a localStorage-t, ha a szerver esetleg új client_id-t küld vissza
    if (data.client_id && data.client_id !== clientUuid) {
      localStorage.setItem("blackjack_client_uuid", data.client_id);
    }

    return data; // Visszaadjuk a szerver válaszát (tartalmazza a message-t, user_id-t, client_id-t)
  } catch (error) {
    console.error("Error: ", error);
    throw error;
  }
}

export async function setBet(betAmount: number) {
  const data = await callApiEndpoint("/api/bet", "POST", { bet: betAmount });

  return data;
}

export async function takeBackDeal() {
  const data = await callApiEndpoint("/api/retake_bet", "POST");

  return data;
}

export async function getShuffling() {
  const data = await callApiEndpoint("/api/create_deck", "POST");

  return data;
}

export async function startGame() {
  const data = await callApiEndpoint("/api/start_game", "POST");

  return data;
}

export async function handleHit() {
  const data = await callApiEndpoint("/api/hit", "POST");

  return data;
}

export async function handleStand() {
  const data = await callApiEndpoint("/api/stand", "POST");

  return data;
}

export async function handleRewards() {
  const data = await callApiEndpoint("/api/rewards", "POST");

  return data;
}

export async function handleInsurance() {
  const data = await callApiEndpoint("/api/ins_request", "POST");

  return data;
}

export async function handleDouble() {
  const data = await callApiEndpoint("/api/double_request", "POST");

  return data;
}

export async function handleStandAndRewards() {
  const data = await callApiEndpoint("/api/stand_and_rewards", "POST");

  return data;
}

export async function splitHand() {
  const data = await callApiEndpoint("/api/split_request", "POST");

  return data;
}

export async function splitHit() {
  const data = await callApiEndpoint("/api/split_hit", "POST");

  return data;
}

export async function addSplitPlayerToGame() {
  const data = await callApiEndpoint("/api/add_split_player_to_game", "POST");

  return data;
}

export async function addToPlayersListByStand() {
  const data = await callApiEndpoint(
    "/api/add_to_players_list_by_stand",
    "POST"
  );

  return data;
}

export async function updatePlayerFromPlayers() {
  const data = await callApiEndpoint("/api/add_player_from_players", "POST");

  return data;
}

export async function handleSplitDouble() {
  const data = await callApiEndpoint("/api/split_double_request", "POST");

  return data;
}

export async function handleSplitStandAndRewards() {
  const data = await callApiEndpoint(
    "/api/split_double_stand_and_rewards",
    "POST"
  );

  return data;
}

export async function setRestart() {
  const data = await callApiEndpoint("/api/set_restart", "POST");

  return data;
}

export async function forceRestart() {
  const clientUuid = localStorage.getItem("blackjack_client_uuid");
  if (!clientUuid) {
    throw new Error("No id.");
  }

  const data = await callApiEndpoint("/api/force_restart", "POST", {
    client_id: clientUuid,
  });

  return data;
}

export interface HttpError extends Error {
  response?: {
    // A response property most opcionális
    status: number;
    statusText: string;
    error?: string;
    data?: ErrorResponse; // A szerver válasza (pl. { error: 'No more split hands.' })
  };
}

export async function callApiEndpoint<T>(
  endpoint: string,
  method: string = "GET", // Alapértelmezett legyen GET, ha nincs megadva
  body?: unknown
): Promise<T> {
  // <--- Visszatérési típus: Promise<T>
  try {
    const options: RequestInit = {
      method: method,
      headers: {
        "Content-Type": "application/json",
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
      const statusText = response.statusText || "Ismeretlen hiba";
      const errorMessage =
        errorData.message || `HTTP hiba! Státusz: ${status} ${statusText}.`;

      if (!(status === 400 && errorData.error === "No more split hands.")) {
        // Logolunk piros hibát, ha NEM a "No more split hands." hiba
        console.error(
          `API hiba a(z) '${endpoint}' végponton (státusz: ${status}):`,
          errorData
        );
      }
      // Ha a "No more split hands." hiba, akkor itt nem logolunk SEMMIT a konzolra.
      // Ezt a hibát majd a useGameStateMachine fogja diszkréten kezelni.

      // Mindenesetre dobjuk a hibát, hogy a hívó fél elkapja és kezelje.
      const errorToThrow: HttpError = new Error(errorMessage);
      errorToThrow.response = {
        status: status,
        statusText: statusText,
        data: errorData,
      };
      throw errorToThrow;
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();
    return data as T;
  } catch (error: unknown) {
    // *** FONTOS VÁLTOZTATÁS ITT: Kondicionális logolás a külső catch-ben is. ***
    // Csak akkor logolunk pirosat, ha valamilyen ismeretlen hiba történik.
    // Ha a `HttpError` a "No more split hands." esete, akkor itt sem logolunk.

    const isSpecificSplitHandError =
      error instanceof Error &&
      "response" in error &&
      (error as HttpError).response?.status === 400 &&
      (error as HttpError).response?.data?.error === "No more split hands.";

    if (!isSpecificSplitHandError) {
      console.error(
        `Hálózati vagy feldolgozási hiba a(z) '${endpoint}' végponton:`,
        error
      );
    }
    // Mindig továbbdobja a hibát a hívó félnek!
    throw error;
  }
}
