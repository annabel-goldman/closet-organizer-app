export type MagazineImageMode = "flatlay" | "modeled";
export type MagazineEditableElement = "body" | "image" | "title";

export interface MagazineElementLayout {
  text?: string;
  width: number;
  x: number;
  y: number;
}

export interface MagazinePageLayout {
  body?: MagazineElementLayout;
  image?: MagazineElementLayout;
  image_mode?: MagazineImageMode;
  title?: MagazineElementLayout;
}

export type MagazinePageLayouts = Record<string, MagazinePageLayout>;

const COVER_DEFAULTS: Required<Pick<MagazinePageLayout, "body" | "title">> = {
  title: { x: 8, y: 38, width: 84 },
  body: { x: 8, y: 80, width: 70 },
};

const OUTFIT_DEFAULTS: Required<Pick<MagazinePageLayout, "body" | "image" | "title">> = {
  title: { x: 6, y: 5, width: 88 },
  image: { x: 16, y: 20, width: 68 },
  body: { x: 6, y: 90, width: 74 },
};

export function resolveMagazinePageLayout(
  pageKey: string,
  layout: MagazinePageLayout | undefined,
  defaults: { body: string; imageMode?: MagazineImageMode; title: string },
): MagazinePageLayout {
  const fallback: MagazinePageLayout = pageKey === "cover" ? COVER_DEFAULTS : OUTFIT_DEFAULTS;
  return {
    image_mode: layout?.image_mode ?? defaults.imageMode ?? "flatlay",
    ...(fallback.image ? { image: resolveElement(layout?.image, fallback.image) } : {}),
    title: resolveElement(layout?.title, { ...fallback.title!, text: defaults.title }),
    body: resolveElement(layout?.body, { ...fallback.body!, text: defaults.body }),
  };
}

export function updateMagazinePageElement(
  layouts: MagazinePageLayouts,
  pageKey: string,
  element: MagazineEditableElement,
  changes: Partial<MagazineElementLayout>,
  resolvedLayout: MagazinePageLayout,
): MagazinePageLayouts {
  return {
    ...layouts,
    [pageKey]: {
      ...layouts[pageKey],
      [element]: {
        ...resolvedLayout[element],
        ...changes,
      },
    },
  };
}

export function clampMagazineElement(layout: MagazineElementLayout): MagazineElementLayout {
  const width = clamp(layout.width, 8, 100);
  return {
    ...layout,
    width,
    x: clamp(layout.x, -width * 0.5, 100 - width * 0.5),
    y: clamp(layout.y, -10, 98),
  };
}

export function normalizeMagazinePageLayouts(value: unknown): MagazinePageLayouts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([pageKey, pageLayout]) => {
      if (!pageLayout || typeof pageLayout !== "object" || Array.isArray(pageLayout)) return [];
      const raw = pageLayout as Record<string, unknown>;
      const imageMode = raw.image_mode === "modeled" ? "modeled" : raw.image_mode === "flatlay" ? "flatlay" : undefined;
      return [[pageKey, {
        ...(imageMode ? { image_mode: imageMode } : {}),
        ...normalizeElementEntry("image", raw.image),
        ...normalizeElementEntry("title", raw.title),
        ...normalizeElementEntry("body", raw.body),
      } satisfies MagazinePageLayout]];
    }),
  );
}

function resolveElement(
  current: MagazineElementLayout | undefined,
  fallback: MagazineElementLayout,
): MagazineElementLayout {
  return clampMagazineElement({ ...fallback, ...current });
}

function normalizeElementEntry(key: MagazineEditableElement, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const width = finiteNumber(raw.width);
  if (x == null || y == null || width == null) return {};
  return {
    [key]: clampMagazineElement({
      x,
      y,
      width,
      ...(typeof raw.text === "string" ? { text: raw.text } : {}),
    }),
  };
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
