import { ClothingItem } from "./closet";

export type ClosetSortOption = "name-asc" | "newest-added" | "oldest-added" | "recent-purchase";

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

export function matchesSearchQuery(item: ClothingItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [item.name, item.size, item.brand, ...item.tags]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
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

    if (sortOption === "recent-purchase") {
      return new Date(right.date ?? 0).getTime() - new Date(left.date ?? 0).getTime();
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

export function filterClothingItems(
  items: ClothingItem[],
  searchQuery: string,
  selectedBrands: string[],
  selectedColors: string[],
  selectedOtherTags: string[],
  sortOption: ClosetSortOption,
) {
  const selectedTagTokens = [...selectedColors, ...selectedOtherTags];

  return sortClothingItems(
    items.filter((item) => {
      if (selectedTagTokens.length > 0 && !selectedTagTokens.some((tag) => item.tags.includes(tag))) {
        return false;
      }

      if (selectedBrands.length > 0 && !selectedBrands.some((brand) => itemMatchesSelectedBrand(item, brand))) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    sortOption,
  );
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
