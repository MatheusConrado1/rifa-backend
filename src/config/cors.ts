const DEFAULT_CORS_ORIGINS = [
  'https://127.0.0.1:5500',
  'https://localhost:5500',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
];

export function getCorsOrigins(): string[] {
  const rawOrigins = process.env.CORS_ORIGINS;

  if (!rawOrigins) {
    return DEFAULT_CORS_ORIGINS;
  }

  const parsedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (parsedOrigins.length === 0) {
    return DEFAULT_CORS_ORIGINS;
  }

  return parsedOrigins;
}
