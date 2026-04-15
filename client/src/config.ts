const normalizeUrl = (url: string): string => url.replace(/\/$/, '');

export const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
);

export const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL,
);
