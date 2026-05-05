const LOCAL_BACKEND_BASE_URL = "http://127.0.0.1:3000";

function isLocalDevelopmentHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function defaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "/api";
  }

  return isLocalDevelopmentHost(window.location.hostname) && window.location.port !== "3000" ? "/api" : "";
}

function defaultBackendBaseUrl() {
  if (typeof window === "undefined") {
    return LOCAL_BACKEND_BASE_URL;
  }

  return isLocalDevelopmentHost(window.location.hostname) && window.location.port !== "3000"
    ? LOCAL_BACKEND_BASE_URL
    : window.location.origin;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl();
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? defaultBackendBaseUrl();

export interface UserSummary {
  id: number;
  username: string;
  preferred_style?: string | null;
  admin: boolean;
}

export interface ClothingItem {
  id: number;
  name: string;
  size: string;
  date: string | null;
  user_id: number;
  created_at?: string;
  updated_at?: string;
  tags: string[];
  image_url?: string | null;
  original_image_url?: string | null;
  cleaned_image_url?: string | null;
  clean_image_status?: "idle" | "processing" | "succeeded" | "failed";
  clean_image_error_message?: string | null;
  clean_image_provider?: string | null;
  clean_image_model?: string | null;
  clean_image_generated_at?: string | null;
  user?: UserSummary;
}

export interface User extends UserSummary {
  clothing_items: ClothingItem[];
}

export interface OutfitDetection {
  id: number;
  outfit_upload_id: number;
  category: string;
  confidence: number | null;
  suggested_name?: string | null;
  details: {
    dominant_color?: string;
    material_guess?: string;
    style_guess?: string;
    appearance_summary?: string;
    notes?: string;
  };
  crop_status?: "pending" | "refined" | "verified" | "rejected" | "failed";
  crop_confidence?: number | null;
  crop_quality_score?: number | null;
  crop_notes?: string | null;
  crop_attempts?: number;
  bounding_box?: OutfitDetectionBoundingBox | null;
  coarse_box?: OutfitDetectionBoundingBox | null;
  refined_box?: OutfitDetectionBoundingBox | null;
  final_box?: OutfitDetectionBoundingBox | null;
  cleaned_image_url?: string | null;
  clean_image_status?: "idle" | "processing" | "succeeded" | "failed";
  clean_image_error_message?: string | null;
  clean_image_provider?: string | null;
  clean_image_model?: string | null;
  clean_image_generated_at?: string | null;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export interface OutfitDetectionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OutfitUpload {
  id: number;
  user_id: number;
  status: string;
  provider?: string | null;
  vision_model?: string | null;
  error_message?: string | null;
  detected_at?: string | null;
  source_photo_url?: string | null;
  detections: OutfitDetection[];
  created_at?: string;
  updated_at?: string;
}

export interface Outfit {
  id: number;
  user_id: number;
  name: string;
  tags?: string[] | null;
  notes?: string | null;
  item_ids: number[];
  items: ClothingItem[];
  created_at?: string;
  updated_at?: string;
}

export type CreateItemMode = "manual" | "image";

export interface ClothingItemFormValues {
  name: string;
  size: string;
  date: string;
  tags: string;
}

export interface ClothingItemPhotoOptions {
  photo?: File | null;
  crop?: OutfitDetectionBoundingBox | null;
  sourceOutfitDetectionId?: number | null;
  removePhoto?: boolean;
}

export interface OutfitUploadPhotoOptions {
  photo: File;
}

export interface TemporaryCleanImageResult {
  content_type: string;
  data_url: string;
  filename: string;
}

export interface OutfitDraft {
  name: string;
  notes: string;
  tagInput: string;
  itemIds: number[];
}

export function emptyOutfitDraft(): OutfitDraft {
  return {
    name: "",
    notes: "",
    tagInput: "",
    itemIds: [],
  };
}

function outfitDraftStorageKey(userId: number) {
  return `outfit-draft:${userId}`;
}

function normalizeOutfitDraft(raw: Partial<OutfitDraft> | null | undefined): OutfitDraft {
  const itemIds = Array.isArray(raw?.itemIds)
    ? raw.itemIds
        .map((value) => Number(value))
        .filter((value, index, array) => Number.isInteger(value) && value > 0 && array.indexOf(value) === index)
    : [];

  return {
    name: typeof raw?.name === "string" ? raw.name : "",
    notes: typeof raw?.notes === "string" ? raw.notes : "",
    tagInput: typeof raw?.tagInput === "string" ? raw.tagInput : "",
    itemIds,
  };
}

export function loadOutfitDraft(userId: number): OutfitDraft {
  if (typeof window === "undefined") {
    return emptyOutfitDraft();
  }

  const raw = window.localStorage.getItem(outfitDraftStorageKey(userId));
  if (!raw) {
    return emptyOutfitDraft();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return emptyOutfitDraft();
    }

    return normalizeOutfitDraft(parsed as Partial<OutfitDraft>);
  } catch {
    return emptyOutfitDraft();
  }
}

export function saveOutfitDraft(userId: number, draft: OutfitDraft) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeOutfitDraft(draft);
  const isEmpty =
    normalized.name.trim().length === 0 &&
    normalized.notes.trim().length === 0 &&
    normalized.tagInput.trim().length === 0 &&
    normalized.itemIds.length === 0;

  if (isEmpty) {
    window.localStorage.removeItem(outfitDraftStorageKey(userId));
    return;
  }

  window.localStorage.setItem(outfitDraftStorageKey(userId), JSON.stringify(normalized));
}

export function loadOutfitDraftItemIds(userId: number) {
  return loadOutfitDraft(userId).itemIds;
}

export function saveOutfitDraftItemIds(userId: number, itemIds: number[]) {
  const existing = loadOutfitDraft(userId);
  saveOutfitDraft(userId, {
    ...existing,
    itemIds,
  });
}

export function emptyClothingItemFormValues(): ClothingItemFormValues {
  return {
    name: "",
    size: "medium",
    date: "",
    tags: "",
  };
}

export function titleize(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPossessive(name: string) {
  if (name.endsWith("s") || name.endsWith("S")) {
    return `${name}' Closet`;
  }

  return `${name}'s Closet`;
}

export function formatPreferredStyle(style?: string | null) {
  return style ? titleize(style) : null;
}

export function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function formatTagInput(tags: string[]) {
  return tags.join(", ");
}

export function formatTagLabel(tag: string) {
  return titleize(tag);
}

export function formatDisplaySize(size: string) {
  const normalized = size.trim().toLowerCase();

  if (normalized === "xl" || normalized === "xs") {
    return normalized.toUpperCase();
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function buildPlaceholderLabel(name: string) {
  return name
    .split(" ")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

export function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function toClothingItemFormValues(item: ClothingItem): ClothingItemFormValues {
  return {
    name: item.name,
    size: item.size,
    date: toDateInputValue(item.date),
    tags: formatTagInput(item.tags),
  };
}

export function toClothingItemFormValuesFromDetection(
  detection: OutfitDetection,
): ClothingItemFormValues {
  return {
    name: detection.suggested_name?.trim() || titleize(detection.category),
    size: "medium",
    date: "",
    tags: formatTagInput([
      detection.details.dominant_color?.trim() ?? "",
      detection.details.material_guess?.trim() ?? "",
      detection.details.style_guess?.trim() ?? "",
    ]),
  };
}

export function preferredDetectionBox(detection: OutfitDetection) {
  return detection.final_box ?? detection.refined_box ?? detection.coarse_box ?? detection.bounding_box ?? null;
}

export async function fetchClosetOwner(signal?: AbortSignal) {
  return fetchCurrentUser(signal);
}

export async function fetchCurrentUser(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/me`, {
    credentials: "include",
    signal,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return normalizeUserPayload((await response.json()) as User);
}

export function beginGoogleSignIn() {
  window.location.assign(`${BACKEND_BASE_URL}/auth/google_oauth2`);
}

export async function logoutSession() {
  const response = await fetch(`${API_BASE_URL}/session`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

export async function fetchUsers(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/users`, { credentials: "include", signal });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return ((await response.json()) as User[]).map(normalizeUserPayload);
}

export async function fetchUser(id: number, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, { credentials: "include", signal });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return normalizeUserPayload((await response.json()) as User);
}

export async function fetchClothingItem(id: number, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/clothing_items/${id}`, { credentials: "include", signal });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return normalizeClothingItemPayload((await response.json()) as ClothingItem);
}

export async function saveClothingItem(
  id: number,
  userId: number,
  values: ClothingItemFormValues,
  photoOptions: ClothingItemPhotoOptions = {},
) {
  const response = await fetch(`${API_BASE_URL}/clothing_items/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    body: buildClothingItemFormData(userId, values, photoOptions),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return normalizeClothingItemPayload((await response.json()) as ClothingItem);
}

export async function createClothingItem(
  userId: number,
  values: ClothingItemFormValues,
  photoOptions: ClothingItemPhotoOptions = {},
) {
  const response = await fetch(`${API_BASE_URL}/clothing_items`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    body: buildClothingItemFormData(userId, values, photoOptions),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return normalizeClothingItemPayload((await response.json()) as ClothingItem);
}

export async function createOutfitUpload(
  userId: number,
  photoOptions: OutfitUploadPhotoOptions,
) {
  const formData = new FormData();
  formData.append("outfit_upload[user_id]", String(userId));
  formData.append("outfit_upload[source_photo]", photoOptions.photo);

  const response = await fetch(`${API_BASE_URL}/outfit_uploads`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as OutfitUpload;
}

export async function fetchOutfitUpload(id: number, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/outfit_uploads/${id}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as OutfitUpload;
}

export async function fetchOutfits(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/outfits`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as Outfit[];
}

interface CreateOutfitInput {
  userId: number;
  name: string;
  itemIds: number[];
  notes?: string;
  tags?: string[];
}

export async function createOutfit(input: CreateOutfitInput) {
  const response = await fetch(`${API_BASE_URL}/outfits`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      outfit: {
        user_id: input.userId,
        name: input.name,
        item_ids: input.itemIds,
        notes: input.notes,
        tags: input.tags,
      },
    }),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as Outfit;
}

interface UpdateOutfitInput {
  id: number;
  name: string;
  itemIds: number[];
  notes?: string;
  tags?: string[];
}

export async function updateOutfit(input: UpdateOutfitInput) {
  const response = await fetch(`${API_BASE_URL}/outfits/${input.id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      outfit: {
        name: input.name,
        item_ids: input.itemIds,
        notes: input.notes,
        tags: input.tags,
      },
    }),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as Outfit;
}

export async function destroyOutfit(id: number) {
  const response = await fetch(`${API_BASE_URL}/outfits/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }
}

export async function destroyClothingItem(id: number) {
  const response = await fetch(`${API_BASE_URL}/clothing_items/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }
}

export async function generateClothingItemCleanImage(id: number) {
  const response = await fetch(`${API_BASE_URL}/clothing_items/${id}/generate_clean_image`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as ClothingItem;
}

export async function generateOutfitDetectionCleanImage(id: number) {
  const response = await fetch(`${API_BASE_URL}/outfit_detections/${id}/generate_clean_image`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as OutfitDetection;
}

export async function previewCleanImage(photo: File) {
  const formData = new FormData();
  formData.append("image_variant[source_photo]", photo);

  const response = await fetch(`${API_BASE_URL}/image_variants/preview`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as TemporaryCleanImageResult;
}

export async function createCleanPreviewFile(photo: File) {
  const preview = await previewCleanImage(photo);
  return fileFromDataUrl(preview.data_url, preview.filename, preview.content_type);
}

async function fileFromDataUrl(dataUrl: string, filename: string, contentType?: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: contentType || blob.type || "image/png" });
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

function normalizeTagList(rawTags: unknown): string[] {
  if (Array.isArray(rawTags)) {
    return parseTagInput(rawTags.join(","));
  }

  if (rawTags && typeof rawTags === "object") {
    return parseTagInput(Object.values(rawTags as Record<string, unknown>).join(","));
  }

  if (typeof rawTags === "string") {
    return parseTagInput(rawTags);
  }

  return [];
}

function normalizeClothingItemPayload(item: ClothingItem): ClothingItem {
  return {
    ...item,
    tags: normalizeTagList((item as ClothingItem & { tags?: unknown }).tags),
  };
}

function normalizeUserPayload(user: User): User {
  return {
    ...user,
    clothing_items: (user.clothing_items ?? []).map(normalizeClothingItemPayload),
  };
}

function buildClothingItemFormData(
  userId: number,
  values: ClothingItemFormValues,
  photoOptions: ClothingItemPhotoOptions,
) {
  const formData = new FormData();

  formData.append("clothing_item[name]", values.name);
  formData.append("clothing_item[user_id]", String(userId));
  formData.append("clothing_item[size]", values.size);
  formData.append("clothing_item[date]", values.date);
  parseTagInput(values.tags).forEach((tag) => {
    formData.append("clothing_item[tags][]", tag);
  });

  if (photoOptions.photo) {
    formData.append("clothing_item[photo]", photoOptions.photo);
  }

  if (photoOptions.sourceOutfitDetectionId) {
    formData.append(
      "clothing_item[source_outfit_detection_id]",
      String(photoOptions.sourceOutfitDetectionId),
    );
  }

  if (photoOptions.crop) {
    formData.append("clothing_item[crop_x]", String(photoOptions.crop.x));
    formData.append("clothing_item[crop_y]", String(photoOptions.crop.y));
    formData.append("clothing_item[crop_width]", String(photoOptions.crop.width));
    formData.append("clothing_item[crop_height]", String(photoOptions.crop.height));
  }

  if (photoOptions.removePhoto) {
    formData.append("clothing_item[remove_photo]", "true");
  }

  return formData;
}
