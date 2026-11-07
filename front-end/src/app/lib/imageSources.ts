import {
  BACKEND_BASE_URL,
  isLocalDevelopmentHost,
  LOCAL_BACKEND_BASE_URL,
} from "./apiConfig.ts";

export interface LoadedImageSource {
  cleanup: () => void;
  image: HTMLImageElement;
}

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
    const normalizedBackendOrigin = new URL(BACKEND_BASE_URL, window.location.origin).origin;
    const parsed = new URL(trimmed, normalizedBackendOrigin);
    if (isLocalBackendActiveStorageUrl(parsed, normalizedBackendOrigin)) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function resolveEditableImageFetchUrl(imageUrl: string) {
  const normalizedUrl = normalizeAttachmentUrl(imageUrl) ?? imageUrl;

  return resolveActiveStorageProxyUrl(normalizedUrl);
}

export function resolveActiveStorageProxyUrl(imageUrl: string) {
  try {
    const parsed = new URL(
      imageUrl,
      typeof window === "undefined" ? LOCAL_BACKEND_BASE_URL : window.location.origin,
    );
    if (!parsed.pathname.startsWith("/rails/active_storage/")) {
      return imageUrl;
    }

    const proxiedPathname = parsed.pathname
      .replace("/rails/active_storage/blobs/redirect/", "/rails/active_storage/blobs/proxy/")
      .replace(
        "/rails/active_storage/representations/redirect/",
        "/rails/active_storage/representations/proxy/",
      );

    if (proxiedPathname === parsed.pathname) {
      return imageUrl;
    }

    return /^[a-z][a-z\d+.-]*:/i.test(imageUrl)
      ? `${parsed.origin}${proxiedPathname}${parsed.search}`
      : `${proxiedPathname}${parsed.search}`;
  } catch {
    return imageUrl;
  }
}

export async function fetchImageBlob(imageUrl: string, signal?: AbortSignal) {
  const response = await fetch(resolveEditableImageFetchUrl(imageUrl), {
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Unable to load image: ${response.status}`);
  }

  return response.blob();
}

export async function fetchImageFileFromUrl(
  imageUrl: string,
  filename?: string,
  signal?: AbortSignal,
) {
  const blob = await fetchImageBlob(imageUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("Unable to load the source image for editing.");
  });

  return new File([blob], filename ?? inferFilenameFromUrl(imageUrl), {
    type: blob.type || "image/png",
  });
}

export async function loadImageSource(
  imageUrl: string,
  errorMessage = "Unable to decode image.",
): Promise<LoadedImageSource> {
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return {
      cleanup: () => undefined,
      image: await loadImageElement(imageUrl, errorMessage),
    };
  }

  const objectUrl = URL.createObjectURL(await fetchImageBlob(imageUrl));
  try {
    return {
      cleanup: () => URL.revokeObjectURL(objectUrl),
      image: await loadImageElement(objectUrl, errorMessage),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function isLocalBackendActiveStorageUrl(parsed: URL, normalizedBackendOrigin: string) {
  if (!parsed.pathname.startsWith("/rails/active_storage/")) {
    return false;
  }
  if (parsed.origin === normalizedBackendOrigin) {
    return true;
  }

  const backendUrl = new URL(normalizedBackendOrigin);
  return (
    isLocalDevelopmentHost(parsed.hostname)
    && isLocalDevelopmentHost(backendUrl.hostname)
    && parsed.port === backendUrl.port
  );
}

function loadImageElement(src: string, errorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = src;
  });
}

function inferFilenameFromUrl(imageUrl: string) {
  try {
    const baseUrl = typeof window === "undefined" ? LOCAL_BACKEND_BASE_URL : window.location.origin;
    const url = new URL(imageUrl, baseUrl);
    const lastSegment = url.pathname.split("/").pop()?.trim();
    return lastSegment && lastSegment.includes(".") ? lastSegment : "image.png";
  } catch {
    return "image.png";
  }
}
