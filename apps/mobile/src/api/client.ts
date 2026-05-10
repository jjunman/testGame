import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '@band/shared-types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:4000';
const TOKEN_KEY = 'band_management_token';

export const tokenStorage = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (value: string) => AsyncStorage.setItem(TOKEN_KEY, value),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}) {
  const token = await tokenStorage.get();
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    const rawMessage = json?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('\n')
      : rawMessage || '요청 처리에 실패했습니다.';
    throw new Error(message);
  }

  return (json as ApiResponse<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
};

export function toApiAssetUrl(value: string | null | undefined) {
  if (!value) {
    return value ?? null;
  }

  try {
    const source = new URL(value);
    if (source.pathname.startsWith('/uploads/')) {
      const apiBase = new URL(API_BASE_URL);
      source.protocol = apiBase.protocol;
      source.hostname = apiBase.hostname;
      source.port = apiBase.port;
      return source.toString();
    }
  } catch {
    if (value.startsWith('/')) {
      return `${API_BASE_URL}${value}`;
    }
  }

  return value;
}
