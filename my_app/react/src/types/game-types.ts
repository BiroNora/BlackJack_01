export type GameState =
  | 'LOADING'
  | 'SHUFFLING'
  | 'BETTING'
  | 'INIT_GAME'
  | 'MAIN_TURN'
  | 'MAIN_STAND'
  | 'SPLIT_TURN'
  | 'SPLIT_STAND'
  | 'SPLIT_NAT21_TRANSIT'
  | 'SPLIT_NAT21_STAND'
  | 'SPLIT_FINISH'
  | 'SPLIT_FINISH_TRANSIT'
  | 'OUT_OF_TOKENS'
  | 'RESTART_GAME'
  | 'ERROR';

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
  code?: string | number;
  error?: string; // Lehet, hogy a backend küld hibakódot is
  details?: string | object; // További részletek
};

export type GameStateMachineHookResult = {
  gameState: GameStateData;
  currentGameState: GameState;
  transitionToState: (newState: GameState, newData?: Partial<GameStateData>) => void;
  handlePlaceBet: (amount: number) => Promise<void>;
  //handleDeal: () => Promise<void>; // Hozzáadva a visszatérési típushoz
  handleRetakeBet: () => Promise<void>;
  handleStartGame: (shouldShuffle: boolean) => void;
  handleHitRequest: () => Promise<void>;
  handleStandRequest: () => Promise<void>;
  handleDoubleRequest: () => Promise<void>;
  handleSplitRequest: () => Promise<void>;
  handleSplitHitRequest: () => Promise<void>;
  handleSplitStandRequest: () => Promise<void>;
  handleSplitDoubleRequest: () => Promise<void>;
  handleInsRequest: () => Promise<void>;
  preRewardBet: number | null;
  preRewardTokens: number | null;
  insPlaced: boolean;
  hasHitTurn: boolean;
  hasOver21: boolean;
  showInsLost: boolean;
  isSplitted: boolean;
};

export const states = [
  "",
  "BLACKJACK Player won!",
  "BlackJack push",
  "BlackJack Dealer won!",
  "Push",
  "Player lost",
  "Player won",
  "Dealer won",
  "twenty one",
  "bust",
  "under 21",
  "BlackJack",
];
