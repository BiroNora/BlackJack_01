export type GameState =
  | "LOADING"
  | "SHUFFLING"
  | "BETTING"
  | "MAIN_TURN"
  | "MAIN_STAND"
  | "MAIN_NAT21"
  | "MAIN_NAT21_DEALER"
  | "SPLIT_START"
  | "SPLIT_TURN"
  | "SPLIT_FINISH"
  | "SPLIT_NAT21"
  | "ROUND_END"
  | "RESTART_GAME"
  | "ERROR";

export interface GameStateData {
  currentGameState: GameState;
  player: PlayerData;
  dealer: DealerData;
  deckLen: number;
  tokens: number;
  splitReq: number;
  bet: number;
  bet_list: number[];
  players: PlayerData[];
  winner: number;
  is_round_active: boolean;
}

export type PlayerData = [
  string[],
  number,
  number,
  boolean,
  boolean,
  number,
  number
];

export type DealerData = [string[], string[], number, number, boolean, number];

export type SessionInitResponse = {
  message: string;
  user_id: string;
  client_id: string;
}

export type TokensResponse = {
    user_tokens: number;
    message: string;
};

export type DeckLenResponse = {
    deckLen: number;
    message: string;
};

export type ErrorResponse = {
  message?: string; // Az üzenet opcionális, ha a backend nem mindig küld ilyet
  code?: string | number; // Lehet, hogy a backend küld hibakódot is
  details?: string | object; // További részletek
};

export type GameStateMachineHookResult = {
  gameState: GameStateData;
  transitionToState: (newState: GameState, newData?: Partial<GameStateData>) => void;
  handlePlaceBet: (amount: number) => Promise<void>;
  handleDeal: () => Promise<void>; // Hozzáadva a visszatérési típushoz
  handleStartGame: () => Promise<void>; // Hozzáadva a visszatérési típushoz
  handleRetakeBet: () => Promise<void>;
};
