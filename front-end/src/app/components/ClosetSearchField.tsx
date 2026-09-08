import type { ClothingItem } from "../lib/closet";
import {
  formatClosetSearchSuggestionDetail,
  formatClosetSearchSuggestionLabel,
} from "../lib/closetFilters";
import { SearchSuggestionField } from "./SearchSuggestionField";

interface ClosetSearchFieldProps {
  className?: string;
  id: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenItem: (item: ClothingItem) => void;
  onSelectSuggestion: (item: ClothingItem) => void;
  placeholder?: string;
  suggestions: ClothingItem[];
  showClear: boolean;
  value: string;
}

export function ClosetSearchField({
  className,
  id,
  onChange,
  onClear,
  onOpenItem,
  onSelectSuggestion,
  placeholder,
  suggestions,
  showClear,
  value,
}: ClosetSearchFieldProps) {
  return (
    <SearchSuggestionField
      className={className}
      getSuggestionDetail={formatClosetSearchSuggestionDetail}
      getSuggestionKey={(item) => item.id}
      getSuggestionLabel={formatClosetSearchSuggestionLabel}
      id={id}
      onChange={onChange}
      onClear={onClear}
      onOpenSuggestion={onOpenItem}
      onSelectSuggestion={onSelectSuggestion}
      placeholder={placeholder}
      suggestions={suggestions}
      showClear={showClear}
      clearLabel="Clear closet filters"
      value={value}
    />
  );
}
