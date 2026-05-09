import { ClothingItem } from "./closet";

export type ClosetSortOption = "name-asc" | "newest-added" | "oldest-added" | "recent-purchase";

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

export function filterClothingItems(
  items: ClothingItem[],
  searchQuery: string,
  selectedTag: string,
  sortOption: ClosetSortOption,
) {
  return sortClothingItems(
    items.filter((item) => {
      if (selectedTag !== "all" && !item.tags.includes(selectedTag)) {
        return false;
      }

      return matchesSearchQuery(item, searchQuery);
    }),
    sortOption,
  );
}

export function hasActiveClosetControls(
  searchQuery: string,
  selectedTag: string,
  sortOption: ClosetSortOption,
) {
  return searchQuery.trim().length > 0 || selectedTag !== "all" || sortOption !== "name-asc";
}
