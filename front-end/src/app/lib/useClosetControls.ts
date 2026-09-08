import { useDeferredValue, useMemo, useState } from "react";

import type { ClothingItem } from "./closet";
import {
  buildClosetFilterOptions,
  type ClosetSortOption,
  filterClothingItems,
  getClosetSearchSuggestions,
  hasActiveClosetControls,
} from "./closetFilters";
import { CANONICAL_CLOTHING_CATEGORIES } from "./wardrobeTaxonomy";

export function useClosetControls(items: ClothingItem[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<ClosetSortOption>("name-asc");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const derived = useMemo(() => ({
    filteredItems: filterClothingItems(
      items,
      deferredSearchQuery,
      selectedBrands,
      selectedColors,
      selectedTypes,
      sortOption,
    ),
    filterOptions: buildClosetFilterOptions(items),
    hasActiveFilters: hasActiveClosetControls(
      searchQuery,
      selectedBrands,
      selectedColors,
      selectedTypes,
      sortOption,
    ),
    suggestions: getClosetSearchSuggestions(
      items,
      searchQuery,
      selectedBrands,
      selectedColors,
      selectedTypes,
      sortOption,
      { limit: 8 },
    ),
  }), [
    deferredSearchQuery,
    items,
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedTypes,
    sortOption,
  ]);

  return {
    ...derived,
    clearAll: () => {
      setSearchQuery("");
      setSelectedBrands([]);
      setSelectedColors([]);
      setSelectedTypes([]);
      setSortOption("name-asc");
    },
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedTypes,
    setSearchQuery,
    setSortOption: (value: string) => setSortOption(value as ClosetSortOption),
    sortOption,
    toggleBrand: (value: string) => setSelectedBrands((current) => toggleValue(current, value)),
    toggleColor: (value: string) => setSelectedColors((current) => toggleValue(current, value)),
    toggleType: (value: string) => setSelectedTypes((current) => toggleValue(current, value)),
    typeOptions: [...CANONICAL_CLOTHING_CATEGORIES],
  };
}

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort((left, right) => left.localeCompare(right));
}
