const DEFAULT_HEADERS = {
  Accept: "application/json",
};
const DEV_TEST_USER_STORAGE_KEY = "curated-closet.dev-test-user-id";

function developmentTestUserId() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryUserId = searchParams.get("test_user_id")?.trim();
  if (queryUserId) {
    window.localStorage.setItem(DEV_TEST_USER_STORAGE_KEY, queryUserId);
    return queryUserId;
  }

  return window.localStorage.getItem(DEV_TEST_USER_STORAGE_KEY)?.trim() || null;
}

export function localDevAuthHeaders() {
  const headers = new Headers();
  const devTestUserId = developmentTestUserId();

  if (devTestUserId) {
    headers.set("X-Test-User-Id", devTestUserId);
  }

  return headers;
}

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
  localDevAuthHeaders().forEach((value, key) => headers.set(key, value));

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
