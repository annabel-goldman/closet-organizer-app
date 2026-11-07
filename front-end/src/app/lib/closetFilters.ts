import type { ClothingItem, Outfit, OutfitFolder } from "./closet.ts";

export type ClosetSortOption = "name-asc" | "newest-added" | "oldest-added";

const COLOR_TAGS = new Set([
  "beige",
  "black",
  "blue",
  "brown",
  "burgundy",
  "charcoal",
  "cream",
  "dark blue",
  "gold",
  "gray",
  "green",
  "grey",
  "indigo",
  "ivory",
  "khaki",
  "maroon",
  "navy",
  "oatmeal",
  "olive",
  "orange",
  "pink",
  "purple",
  "red",
  "sand",
  "silver",
  "tan",
  "teal",
  "white",
  "yellow",
]);

export interface ClosetFilterOptions {
  brands: string[];
  colors: string[];
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

interface SearchField {
  value?: string | null;
  weight: number;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueBrandOptions(items: ClothingItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const raw = item.brand?.trim();
    if (!raw) {
      continue;
    }
    const key = normalizeKey(raw);
    if (!seen.has(key)) {
      seen.set(key, raw);
    }
  }
  return Array.from(seen.values()).sort((left, right) => left.localeCompare(right));
}

function itemMatchesSelectedBrand(item: ClothingItem, selectedBrand: string): boolean {
  const itemBrand = item.brand?.trim();
  if (!itemBrand) {
    return false;
  }
  return normalizeKey(itemBrand) === normalizeKey(selectedBrand);
}

export function buildClothingItemSearchHaystack(item: ClothingItem): string {
  return normalizeSearchText([item.name, item.category, item.brand, item.style_notes, ...item.tags]
    .filter(Boolean)
    .join(" "));
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function maxFuzzyDistance(term: string, candidate: string): number {
  const shortest = Math.min(term.length, candidate.length);
  if (shortest <= 3) {
    return 0;
  }
  if (shortest <= 6) {
    return 1;
  }
  return 2;
}

function termMatchQuality(term: string, candidate: string): number | null {
  if (term === candidate) {
    return 1;
  }

  if (term.length >= 2 && candidate.startsWith(term)) {
    return 0.86;
  }

  if (term.length >= 3 && candidate.includes(term)) {
    return 0.78;
  }

  if (candidate.length >= 4 && term.startsWith(candidate) && term.length - candidate.length <= 2) {
    return 0.8;
  }

  const allowedDistance = maxFuzzyDistance(term, candidate);
  if (allowedDistance === 0) {
    return null;
  }

  const distance = levenshteinDistance(term, candidate);
  if (distance > allowedDistance || distance / Math.max(term.length, candidate.length) > 0.28) {
    return null;
  }

  return distance === 1 ? 0.72 : 0.56;
}

function scoreSearchFields(fields: SearchField[], query: string): number | null {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const preparedFields = fields
    .map((field) => ({ ...field, normalizedValue: normalizeSearchText(field.value ?? "") }))
    .filter((field) => field.normalizedValue.length > 0);
  let score = 0;

  for (const term of terms) {
    let bestTermScore = 0;

    for (const field of preparedFields) {
      const tokens = field.normalizedValue.split(/\s+/).filter(Boolean);
      const quality = tokens.reduce<number | null>((best, token) => {
        const next = termMatchQuality(term, token);
        if (next === null) return best;
        return best === null ? next : Math.max(best, next);
      }, null);

      if (quality !== null) {
        bestTermScore = Math.max(bestTermScore, field.weight * quality);
      }
    }

    if (bestTermScore === 0) {
      return null;
    }

    score += bestTermScore;
  }

  for (const field of preparedFields) {
    if (field.normalizedValue === normalizedQuery) {
      score += field.weight;
    } else if (normalizedQuery.length >= 3 && field.normalizedValue.includes(normalizedQuery)) {
      score += field.weight * 0.5;
    }
  }

  return score;
}

function rankSearchResults<T>(items: T[], query: string, scorer: (item: T, query: string) => number | null): T[] {
  if (!normalizeSearchText(query)) {
    return items;
  }

  return items
    .map((item, index) => ({ index, item, score: scorer(item, query) }))
    .filter((entry): entry is { index: number; item: T; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

export function termMatchesInHaystack(term: string, haystack: string): boolean {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) {
    return true;
  }

  return scoreSearchFields([{ value: haystack, weight: 1 }], normalizedTerm) !== null;
}

export function scoreClothingItemSearch(item: ClothingItem, query: string): number | null {
  return scoreSearchFields([
    { value: item.name, weight: 100 },
    { value: item.brand, weight: 75 },
    { value: item.category, weight: 65 },
    ...item.tags.map((tag) => ({ value: tag, weight: 60 })),
    { value: item.style_notes, weight: 25 },
  ], query);
}

export function matchesSearchQuery(item: ClothingItem, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return scoreClothingItemSearch(item, normalizedQuery) !== null;
}

export function buildOutfitSearchHaystack(outfit: Outfit): string {
  return normalizeSearchText([
    outfit.name,
    outfit.notes,
    ...(outfit.tags ?? []),
    ...outfit.items.flatMap((item) => [
      item.name,
      item.category,
      item.brand,
      item.style_notes,
      ...item.tags,
    ]),
  ]
    .filter(Boolean)
    .join(" "));
}

export function scoreOutfitSearch(outfit: Outfit, query: string): number | null {
  return scoreSearchFields([
    { value: outfit.name, weight: 100 },
    { value: outfit.notes, weight: 30 },
    ...(outfit.tags ?? []).map((tag) => ({ value: tag, weight: 65 })),
    ...outfit.items.flatMap((item) => [
      { value: item.name, weight: 55 },
      { value: item.brand, weight: 42 },
      { value: item.category, weight: 36 },
      ...item.tags.map((tag) => ({ value: tag, weight: 34 })),
      { value: item.style_notes, weight: 18 },
    ]),
  ], query);
}

export function matchesOutfitSearchQuery(outfit: Outfit, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return scoreOutfitSearch(outfit, normalizedQuery) !== null;
}

export function searchOutfits(outfits: Outfit[], query: string): Outfit[] {
  return rankSearchResults(outfits, query, scoreOutfitSearch);
}

export function getOutfitSearchSuggestions(
  outfits: Outfit[],
  searchQuery: string,
  options: { limit?: number } = {},
): Outfit[] {
  if (!searchQuery.trim()) return [];
  return searchOutfits(outfits, searchQuery).slice(0, options.limit ?? 8);
}

export function formatOutfitSearchSuggestionDetail(outfit: Outfit, searchQuery = ""): string | null {
  const queryTerms = normalizeSearchText(searchQuery).split(/\s+/).filter(Boolean);
  const matchingItemNames = outfit.items
    .filter((item) => {
      const itemHaystack = buildClothingItemSearchHaystack(item);
      return queryTerms.some((term) => termMatchesInHaystack(term, itemHaystack));
    })
    .map((item) => item.name)
    .slice(0, 2);
  const parts = [
    ...matchingItemNames,
    ...(matchingItemNames.length === 0 ? (outfit.tags ?? []).slice(0, 2) : []),
    `${outfit.items.length} ${outfit.items.length === 1 ? "piece" : "pieces"}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function matchesMagazineSearchQuery(folder: OutfitFolder, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return scoreMagazineSearch(folder, normalizedQuery) !== null;
}

export function scoreMagazineSearch(folder: OutfitFolder, query: string): number | null {
  return scoreSearchFields([
    { value: folder.name, weight: 100 },
    { value: folder.occasion, weight: 75 },
    { value: folder.notes, weight: 30 },
    ...folder.outfits.flatMap((outfit) => [
      { value: outfit.name, weight: 48 },
      { value: outfit.notes, weight: 18 },
      ...(outfit.tags ?? []).map((tag) => ({ value: tag, weight: 30 })),
      ...outfit.items.flatMap((item) => [
        { value: item.name, weight: 24 },
        { value: item.brand, weight: 18 },
        { value: item.category, weight: 16 },
        ...item.tags.map((tag) => ({ value: tag, weight: 15 })),
        { value: item.style_notes, weight: 10 },
      ]),
    ]),
  ], query);
}

export function searchMagazines(folders: OutfitFolder[], query: string): OutfitFolder[] {
  return rankSearchResults(folders, query, scoreMagazineSearch);
}

export function getMagazineSearchSuggestions(
  folders: OutfitFolder[],
  searchQuery: string,
  options: { limit?: number } = {},
): OutfitFolder[] {
  if (!searchQuery.trim()) return [];
  return searchMagazines(folders, searchQuery).slice(0, options.limit ?? 8);
}

export function formatMagazineSearchSuggestionDetail(folder: OutfitFolder): string {
  const count = folder.outfits.length;
  return `${count} ${count === 1 ? "outfit" : "outfits"}${folder.occasion ? ` · ${folder.occasion}` : ""}`;
}

export function sortClothingItems(items: ClothingItem[], sortOption: ClosetSortOption) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (sortOption === "name-asc") {
      return left.name.localeCompare(right.name);
    }

    if (sortOption === "oldest-added") {
      return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
    }

    return new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
  });

  return sorted;
}

export function buildTagOptions(items: ClothingItem[]) {
  return Array.from(new Set(items.flatMap((item) => item.tags))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function buildClosetFilterOptions(items: ClothingItem[]): ClosetFilterOptions {
  const brands = uniqueBrandOptions(items);
  const colorSet = new Set<string>();

  for (const item of items) {
    for (const tag of item.tags) {
      const normalizedTag = normalizeKey(tag);

      if (COLOR_TAGS.has(normalizedTag)) {
        colorSet.add(tag);
      }
    }
  }

  return {
    brands,
    colors: Array.from(colorSet).sort((left, right) => left.localeCompare(right)),
  };
}

export function passesClothingItemFilters(
  item: ClothingItem,
  selectedBrands: string[],
  selectedColors: string[],
  selectedTypes: string[],
): boolean {
  if (selectedColors.length > 0 && !selectedColors.some((tag) => item.tags.includes(tag))) {
    return false;
  }

  if (selectedBrands.length > 0 && !selectedBrands.some((brand) => itemMatchesSelectedBrand(item, brand))) {
    return false;
  }

  if (selectedTypes.length > 0 && !selectedTypes.some((type) => normalizeKey(item.category ?? "") === normalizeKey(type))) {
    return false;
  }

  return true;
}

export function filterClothingItems(
  items: ClothingItem[],
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedTypes: string[],
  sortOption: ClosetSortOption,
) {
  const filteredItems = sortClothingItems(
    items.filter((item) => passesClothingItemFilters(item, selectedBrands, selectedColors, selectedTypes)),
    sortOption,
  );

  return rankSearchResults(filteredItems, searchQuery, scoreClothingItemSearch);
}

export function getClosetSearchSuggestions(
  items: ClothingItem[],
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedTypes: string[],
  sortOption: ClosetSortOption,
  options: { limit?: number } = {},
): ClothingItem[] {
  const limit = options.limit ?? 8;
  if (!searchQuery.trim()) {
    return [];
  }

  return filterClothingItems(
    items,
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedTypes,
    sortOption,
  ).slice(0, limit);
}

export function formatClosetSearchSuggestionLabel(item: ClothingItem): string {
  return item.name.trim();
}

export function formatClosetSearchSuggestionDetail(item: ClothingItem): string | null {
  const parts = [item.brand?.trim(), item.category?.trim(), ...item.tags.slice(0, 2)].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function hasActiveClosetControls(
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedTypes: string[],
  sortOption: ClosetSortOption,
) {
  return (
    searchQuery.trim().length > 0 ||
    selectedBrands.length > 0 ||
    selectedColors.length > 0 ||
    selectedTypes.length > 0 ||
    sortOption !== "name-asc"
  );
}
