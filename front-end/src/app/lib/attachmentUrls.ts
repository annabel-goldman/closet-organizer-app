const LOCAL_BACKEND_BASE_URL = "http://127.0.0.1:3000";

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function defaultBackendBaseUrl() {
  if (typeof window === "undefined") {
    return LOCAL_BACKEND_BASE_URL;
  }

  return isLocalDevelopmentHost(window.location.hostname) && window.location.port !== "3000"
    ? LOCAL_BACKEND_BASE_URL
    : window.location.origin;
}

function isLocalDevelopmentOrigin(origin: URL, backendOrigin: URL) {
  const currentPort = origin.port || (origin.protocol === "https:" ? "443" : "80");
  const backendPort = backendOrigin.port || (backendOrigin.protocol === "https:" ? "443" : "80");

  return (
    origin.protocol === backendOrigin.protocol
    && currentPort === backendPort
    && isLocalDevelopmentHost(origin.hostname)
  );
}

const viteEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : {};
const BACKEND_BASE_URL = viteEnv.VITE_BACKEND_BASE_URL ?? defaultBackendBaseUrl();

export function normalizeAttachmentUrl(rawUrl: unknown) {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return null;
  }

  const trimmed = rawUrl.trim();

  if (typeof window === "undefined") {
    return trimmed;
  }

  if (!isLocalDevelopmentHost(window.location.hostname) || window.location.port === "3000") {
    return trimmed;
  }

  try {
    const normalizedBackendOrigin = new URL(BACKEND_BASE_URL, window.location.origin);
    const parsed = new URL(trimmed, normalizedBackendOrigin);

    if (
      isLocalDevelopmentOrigin(parsed, normalizedBackendOrigin)
      && parsed.pathname.startsWith("/rails/active_storage/")
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export async function fetchAttachmentResponse(
  rawUrl: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  remainingRedirects = 5,
): Promise<Response> {
  const normalizedUrl = normalizeAttachmentUrl(rawUrl) ?? rawUrl;
  const response = await fetchImpl(normalizedUrl, {
    ...init,
    redirect: "manual",
  });

  if (
    remainingRedirects > 0
    && response.status >= 300
    && response.status < 400
  ) {
    const nextLocation = response.headers.get("location");
    if (nextLocation) {
      return fetchAttachmentResponse(nextLocation, init, fetchImpl, remainingRedirects - 1);
    }
  }

  return response;
}
