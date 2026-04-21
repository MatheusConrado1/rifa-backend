const API_BASE_URL_DEFAULT = 'http://localhost:3000';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? API_BASE_URL_DEFAULT;

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_BASE_URL ?? API_BASE_URL_DEFAULT;
