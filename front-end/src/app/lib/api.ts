const DEFAULT_HEADERS = {
  Accept: "application/json",
};

async function buildApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string; errors?: string[] };
    const message = payload.errors?.join(", ") || payload.error;
    return new Error(message || `Request failed with status ${response.status}`);
  } catch {
    return new Error(`Request failed with status ${response.status}`);
  }
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(DEFAULT_HEADERS);

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return fetch(path, {
    credentials: "include",
    ...init,
    headers,
  });
}

export async function requestJson<T>(path: string, init: RequestInit = {}) {
  const response = await apiRequest(path, init);
  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as T;
}

export async function requestJsonOrNull<T>(
  path: string,
  nullStatus: number,
  init: RequestInit = {},
) {
  const response = await apiRequest(path, init);
  if (response.status === nullStatus) {
    return null;
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as T;
}

export async function requestVoid(path: string, init: RequestInit = {}) {
  const response = await apiRequest(path, init);
  if (!response.ok) {
    throw await buildApiError(response);
  }
}
