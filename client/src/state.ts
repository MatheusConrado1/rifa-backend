import type { TableState } from './types';

type Listener = () => void;

type AuthState = {
  token: string | null;
  username: string | null;
};

type GameState = {
  table: TableState | null;
  selectedTableId: string;
  playerName: string;
  statusMessage: string;
  errorMessage: string;
  socketConnected: boolean;
};

type AppState = {
  auth: AuthState;
  game: GameState;
};

const TOKEN_KEY = 'rifa.token';
const USERNAME_KEY = 'rifa.username';
const TABLE_KEY = 'rifa.tableId';
const NAME_KEY = 'rifa.playerName';

let state: AppState = {
  auth: {
    token: localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USERNAME_KEY),
  },
  game: {
    table: null,
    selectedTableId: localStorage.getItem(TABLE_KEY) ?? '',
    playerName: localStorage.getItem(NAME_KEY) ?? localStorage.getItem(USERNAME_KEY) ?? '',
    statusMessage: '',
    errorMessage: '',
    socketConnected: false,
  },
};

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getState(): AppState {
  return state;
}

export function setToken(token: string | null, username: string | null): void {
  state = {
    ...state,
    auth: {
      ...state.auth,
      token,
      username,
    },
  };

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (username) {
    localStorage.setItem(USERNAME_KEY, username);
  } else {
    localStorage.removeItem(USERNAME_KEY);
  }

  notify();
}

export function setLobbyData(tableId: string, playerName: string): void {
  state = {
    ...state,
    game: {
      ...state.game,
      selectedTableId: tableId,
      playerName,
    },
  };
  localStorage.setItem(TABLE_KEY, tableId);
  localStorage.setItem(NAME_KEY, playerName);
  notify();
}

export function setSocketConnected(connected: boolean): void {
  state = {
    ...state,
    game: {
      ...state.game,
      socketConnected: connected,
    },
  };
  notify();
}

export function setStatusMessage(message: string): void {
  state = {
    ...state,
    game: {
      ...state.game,
      statusMessage: message,
    },
  };
  notify();
}

export function setErrorMessage(message: string): void {
  state = {
    ...state,
    game: {
      ...state.game,
      errorMessage: message,
    },
  };
  notify();
}

export function setTableState(table: TableState | null): void {
  state = {
    ...state,
    game: {
      ...state.game,
      table,
    },
  };
  notify();
}

export function resetGameState(): void {
  state = {
    ...state,
    game: {
      ...state.game,
      table: null,
      statusMessage: '',
      errorMessage: '',
      socketConnected: false,
    },
  };
  notify();
}

export function clearAuthAndGame(): void {
  setToken(null, null);
  resetGameState();
}
