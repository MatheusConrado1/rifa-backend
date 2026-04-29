import type { TableState } from './types';

type Listener = () => void;

type AuthState = {
  token: string | null;
  username: string | null;
  userId: string | null;
};

type GameState = {
  table: TableState | null;
  selectedTableId: string;
  playerName: string;
  statusMessage: string;
  warningMessage: string;
  errorMessage: string;
  socketConnected: boolean;
  audioMuted: boolean;
  audioVolume: number;
};

type AppState = {
  auth: AuthState;
  game: GameState;
};

const TOKEN_KEY = 'rifa.token';
const USERNAME_KEY = 'rifa.username';
const USER_ID_KEY = 'rifa.userId';
const TABLE_KEY = 'rifa.tableId';
const NAME_KEY = 'rifa.playerName';
const AUDIO_MUTED_KEY = 'rifa.audioMuted';
const AUDIO_VOLUME_KEY = 'rifa.audioVolume';

let state: AppState = {
  auth: {
    token: localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USERNAME_KEY),
    userId: localStorage.getItem(USER_ID_KEY),
  },
  game: {
    table: null,
    selectedTableId: localStorage.getItem(TABLE_KEY) ?? '',
    playerName: localStorage.getItem(NAME_KEY) ?? localStorage.getItem(USERNAME_KEY) ?? '',
    statusMessage: '',
    warningMessage: '',
    errorMessage: '',
    socketConnected: false,
    audioMuted: localStorage.getItem(AUDIO_MUTED_KEY) === '1',
    audioVolume: Number(localStorage.getItem(AUDIO_VOLUME_KEY) ?? '0.65'),
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

export function setToken(
  token: string | null,
  username: string | null,
  userId: string | null,
): void {
  state = {
    ...state,
    auth: {
      ...state.auth,
      token,
      username,
      userId,
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

  if (userId) {
    localStorage.setItem(USER_ID_KEY, userId);
  } else {
    localStorage.removeItem(USER_ID_KEY);
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

export function setAudioMuted(muted: boolean): void {
  state = {
    ...state,
    game: {
      ...state.game,
      audioMuted: muted,
    },
  };

  if (muted) {
    localStorage.setItem(AUDIO_MUTED_KEY, '1');
  } else {
    localStorage.removeItem(AUDIO_MUTED_KEY);
  }
  notify();
}

export function setAudioVolume(volume: number): void {
  const normalized = Math.max(0, Math.min(1, volume));
  state = {
    ...state,
    game: {
      ...state.game,
      audioVolume: normalized,
    },
  };
  localStorage.setItem(AUDIO_VOLUME_KEY, String(normalized));
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

export function setWarningMessage(message: string): void {
  state = {
    ...state,
    game: {
      ...state.game,
      warningMessage: message,
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
      warningMessage: '',
      errorMessage: '',
      socketConnected: false,
    },
  };
  notify();
}

export function clearAuthAndGame(): void {
  setToken(null, null, null);
  resetGameState();
}
