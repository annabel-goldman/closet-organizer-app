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

export function matchesSearchQuery(item: ClothingItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [item.name, item.size, ...item.tags]
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
  const uniqueTags = buildTagOptions(items);

  const grouped = uniqueTags.reduce<Pick<GroupedTagOptions, "colors" | "other">>(
    (result, tag) => {
      const normalizedTag = tag.trim().toLowerCase();

      if (COLOR_TAGS.has(normalizedTag)) {
        result.colors.push(tag);
      } else {
        result.other.push(tag);
      }

      return result;
    },
    { colors: [], other: [] },
  );

  return {
    brands: [],
    colors: grouped.colors.sort((left, right) => left.localeCompare(right)),
    other: grouped.other.sort((left, right) => left.localeCompare(right)),
  };
}

export function filterClothingItems(
  items: ClothingItem[],
  searchQuery: string,
  selectedTags: string[],
  sortOption: ClosetSortOption,
) {
  return sortClothingItems(
    items.filter((item) => {
      if (selectedTags.length > 0 && !selectedTags.some((tag) => item.tags.includes(tag))) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    sortOption,
  );
}

export function hasActiveClosetControls(
  searchQuery: string,
  selectedTags: string[],
  sortOption: ClosetSortOption,
) {
  return searchQuery.trim().length > 0 || selectedTags.length > 0 || sortOption !== "name-asc";
}
