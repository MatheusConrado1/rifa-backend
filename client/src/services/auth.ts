import { API_BASE_URL } from '../config';
import type { AuthResponse } from '../types';

interface AuthPayload {
  username: string;
  password: string;
}

const parseError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }

    return data.message ?? data.error ?? 'Erro desconhecido.';
  } catch {
    return 'Erro desconhecido.';
  }
};

const request = async <T>(path: string, payload: AuthPayload): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
};

export const register = async (
  username: string,
  password: string,
): Promise<{ id: string; username: string }> => {
  return request<{ id: string; username: string }>('/auth/register', {
    username,
    password,
  });
};

export const login = async (
  username: string,
  password: string,
): Promise<AuthResponse> => {
  return request<AuthResponse>('/auth/login', {
    username,
    password,
  });
};
