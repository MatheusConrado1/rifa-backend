import type { TableState } from './types';

const TOKEN_KEY = 'rifa_token';
const USERNAME_KEY = 'rifa_username';

export interface AppState {
  token: string | null;
  username: string | null;
  mesaId: string;
  table: TableState | null;
  isConnected: boolean;
  logs: string[];
  errors: string[];
}

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const initialToken = readStorage(TOKEN_KEY);
const initialUsername = readStorage(USERNAME_KEY);

export const state: AppState = {
  token: initialToken,
  username: initialUsername,
  mesaId: 'mesa-1',
  table: null,
  isConnected: false,
  logs: [],
  errors: [],
};

export const setAuth = (token: string, username: string): void => {
  state.token = token;
  state.username = username;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
};

export const clearAuth = (): void => {
  state.token = null;
  state.username = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

export const pushLog = (message: string): void => {
  state.logs = [message, ...state.logs].slice(0, 40);
};

export const pushError = (message: string): void => {
  state.errors = [message, ...state.errors].slice(0, 10);
};

export const consumeLatestError = (): string | null => {
  const [latest, ...rest] = state.errors;
  state.errors = rest;
  return latest ?? null;
};
