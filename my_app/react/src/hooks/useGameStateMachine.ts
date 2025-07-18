import type { GameState, GameStateData } from "../types/game-types";

let gameState: GameStateData = {
  currentGameState: 'LOADING',
  player: [[], 0, 0, false, false, 0, 0],
  dealer: [[], [], 0, 0, false, 0],
  deckLen: 0,
  tokens: 0,
  splitReq: 0,
  bet: 0,
  betList: [],
  players: [],
  winner: 0,
  is_round_active: false,
};

export function setGameState(
  newState: GameState,
  newData?: Partial<GameStateData>
): void {
  //console.log(`>>> setGameState hívva! Célállapot: ${newState}, bejövő adatok (newData):`, JSON.parse(JSON.stringify(newData || {})));
  //console.trace("setGameState HÍVÁS HELYE:");
  gameState = {
    ...gameState, // Másolja a jelenlegi globális állapotot
    ...(newData || {}), // Másolja az új adatokat, felülírva az előzőket, ha van egyezés
    currentGameState: newState, // <--- EZ A GARANCIA: Ez felülírja a newData.currentGameState-et!
  };

  //console.log(`DEBUG: gameState.currentGameState értéke KÖZVETLENÜL BEÁLLÍTÁS UTÁN: ${gameState.currentGameState}`);
  //console.log(`DEBUG: Teljes gameState objektum KÖZVETLENÜL BEÁLLÍTÁS UTÁN:`, JSON.parse(JSON.stringify(gameState)));

  updateGameUI(gameState);
}

async function updateGameUI(
  state: GameStateData,
): Promise<void> {
  //console.log("--> updateGameUI received state:", state);
  //console.trace("Call stack for updateGameUI"); // Also helpful

  switch (state.currentGameState) {
    case 'LOADING':
      //console.log("Entering LOADING state with data:", state);
      //console.log("Entering LOADING state with data JSON:", JSON.parse(JSON.stringify(state)));
      
      break;

    case 'BETTING':
      break;

    case 'MAIN_TURN':
      break;

    case 'MAIN_STAND':
      break;

    case 'MAIN_NAT21':
      break;

    case 'MAIN_NAT21_DEALER':
      break;

    case 'SPLIT_START':
      break;

    case 'SPLIT_TURN':
      break;

    case 'SPLIT_FINISH':
      break;

    case 'SPLIT_NAT21':
      break;

    case 'ROUND_END':
      break;

    case 'RESTART_GAME':
      break;

    case 'ERROR':
      break;

    default:
      console.warn("UNKNOWN STATE:", state);
      setGameState('ERROR');
      break;
  }
}
