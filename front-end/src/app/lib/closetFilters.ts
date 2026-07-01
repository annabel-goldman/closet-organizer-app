import type { ClothingItem } from "./closet.ts";

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

export interface GroupedTagOptions {
  brands: string[];
  colors: string[];
  other: string[];
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
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
  return [item.name, item.category, item.brand, ...item.tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

export function termMatchesInHaystack(term: string, haystack: string): boolean {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return true;
  }

  if (haystack.includes(normalizedTerm)) {
    return true;
  }

  if (normalizedTerm.length < 3) {
    return false;
  }

  const tokens = haystack.split(/\s+/).filter(Boolean);
  return tokens.some((token) => {
    if (token.includes(normalizedTerm) || normalizedTerm.includes(token)) {
      return true;
    }

    const allowedDistance = maxFuzzyDistance(normalizedTerm, token);
    if (allowedDistance === 0) {
      return false;
    }

    return levenshteinDistance(normalizedTerm, token) <= allowedDistance;
  });
}

export function matchesSearchQuery(item: ClothingItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = buildClothingItemSearchHaystack(item);
  return normalizedQuery.split(/\s+/).every((term) => termMatchesInHaystack(term, haystack));
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

export function buildGroupedTagOptions(items: ClothingItem[]): GroupedTagOptions {
  const brands = uniqueBrandOptions(items);
  const colorSet = new Set<string>();
  const otherSet = new Set<string>();

  for (const item of items) {
    const brandNorm = normalizeKey(item.brand ?? "");

    for (const tag of item.tags) {
      const normalizedTag = normalizeKey(tag);

      if (COLOR_TAGS.has(normalizedTag)) {
        colorSet.add(tag);
      } else if (brandNorm && normalizedTag === brandNorm) {
        // Omit tag that duplicates the explicit brand field from the Tags filter list.
      } else {
        otherSet.add(tag);
      }
    }
  }

  return {
    brands,
    colors: Array.from(colorSet).sort((left, right) => left.localeCompare(right)),
    other: Array.from(otherSet).sort((left, right) => left.localeCompare(right)),
  };
}

export function passesClothingItemFilters(
  item: ClothingItem,
  selectedBrands: string[],
  selectedColors: string[],
  selectedOtherTags: string[],
): boolean {
  const selectedTagTokens = [...selectedColors, ...selectedOtherTags];

  if (selectedTagTokens.length > 0 && !selectedTagTokens.some((tag) => item.tags.includes(tag))) {
    return false;
  }

  if (selectedBrands.length > 0 && !selectedBrands.some((brand) => itemMatchesSelectedBrand(item, brand))) {
    return false;
  }

  return true;
}

export function filterClothingItems(
  items: ClothingItem[],
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedOtherTags: string[],
  sortOption: ClosetSortOption,
) {
  return sortClothingItems(
    items.filter((item) => {
      if (!passesClothingItemFilters(item, selectedBrands, selectedColors, selectedOtherTags)) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    sortOption,
  );
}

export function getClosetSearchSuggestions(
  items: ClothingItem[],
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedOtherTags: string[],
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
    selectedOtherTags,
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
  selectedOtherTags: string[],
  sortOption: ClosetSortOption,
) {
  return (
    searchQuery.trim().length > 0 ||
    selectedBrands.length > 0 ||
    selectedColors.length > 0 ||
    selectedOtherTags.length > 0 ||
    sortOption !== "name-asc"
  );
}
