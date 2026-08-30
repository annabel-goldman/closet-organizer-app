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
  onOpenItem: (item: ClothingItem) => void;
  onSelectSuggestion: (item: ClothingItem) => void;
  placeholder?: string;
  suggestions: ClothingItem[];
  value: string;
}

export function ClosetSearchField({
  className,
  id,
  onChange,
  onOpenItem,
  onSelectSuggestion,
  placeholder,
  suggestions,
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
      onOpenSuggestion={onOpenItem}
      onSelectSuggestion={onSelectSuggestion}
      placeholder={placeholder}
      suggestions={suggestions}
      value={value}
    />
  );
}
