import { useDeferredValue, useMemo, useState } from "react";

import type { ClothingItem } from "./closet";
import {
  buildGroupedTagOptions,
  type ClosetSortOption,
  filterClothingItems,
  getClosetSearchSuggestions,
  hasActiveClosetControls,
} from "./closetFilters";

export function useClosetControls(items: ClothingItem[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOtherTags, setSelectedOtherTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<ClosetSortOption>("name-asc");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const derived = useMemo(() => ({
    filteredItems: filterClothingItems(
      items,
      deferredSearchQuery,
      selectedBrands,
      selectedColors,
      selectedOtherTags,
      sortOption,
    ),
    groupedTagOptions: buildGroupedTagOptions(items),
    hasActiveFilters: hasActiveClosetControls(
      searchQuery,
      selectedBrands,
      selectedColors,
      selectedOtherTags,
      sortOption,
    ),
    suggestions: getClosetSearchSuggestions(
      items,
      searchQuery,
      selectedBrands,
      selectedColors,
      selectedOtherTags,
      sortOption,
      { limit: 8 },
    ),
  }), [
    deferredSearchQuery,
    items,
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    sortOption,
  ]);

  return {
    ...derived,
    clearAll: () => {
      setSearchQuery("");
      setSelectedBrands([]);
      setSelectedColors([]);
      setSelectedOtherTags([]);
      setSortOption("name-asc");
    },
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    setSearchQuery,
    setSortOption: (value: string) => setSortOption(value as ClosetSortOption),
    sortOption,
    toggleBrand: (value: string) => setSelectedBrands((current) => toggleValue(current, value)),
    toggleColor: (value: string) => setSelectedColors((current) => toggleValue(current, value)),
    toggleOtherTag: (value: string) => setSelectedOtherTags((current) => toggleValue(current, value)),
  };
}

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort((left, right) => left.localeCompare(right));
}
