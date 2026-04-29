import { API_BASE_URL } from '../config';
import type { AuthResponse } from '../types';

type Credentials = {
  username: string;
  password: string;
};

async function request<T>(path: string, body: Credentials): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as { message?: string } & T;

  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(message ?? 'Falha na requisicao.');
  }

  return data as T;
}

export async function register(credentials: Credentials): Promise<void> {
  await request('/auth/register', credentials);
}

export async function login(credentials: Credentials): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', credentials);
}
