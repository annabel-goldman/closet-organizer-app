export const LOCAL_BACKEND_BASE_URL = "http://127.0.0.1:3000";

export function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function defaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "/api";
  }

  return isLocalDevelopmentHost(window.location.hostname) && window.location.port !== "3000"
    ? "/api"
    : "";
}

function defaultBackendBaseUrl() {
  if (typeof window === "undefined") {
    return LOCAL_BACKEND_BASE_URL;
  }

  return isLocalDevelopmentHost(window.location.hostname) && window.location.port !== "3000"
    ? LOCAL_BACKEND_BASE_URL
    : window.location.origin;
}

const importMetaEnv = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};

export const API_BASE_URL = importMetaEnv.VITE_API_BASE_URL ?? defaultApiBaseUrl();
export const BACKEND_BASE_URL = importMetaEnv.VITE_BACKEND_BASE_URL ?? defaultBackendBaseUrl();
