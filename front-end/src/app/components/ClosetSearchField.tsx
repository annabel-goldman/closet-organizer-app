import { KeyboardEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ClothingItem } from "../lib/closet";
import {
  formatClosetSearchSuggestionDetail,
  formatClosetSearchSuggestionLabel,
} from "../lib/closetFilters";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ClosetSearchFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: ClothingItem[];
  onSelectSuggestion: (item: ClothingItem) => void;
  onOpenItem: (item: ClothingItem) => void;
  placeholder?: string;
  className?: string;
}

export function ClosetSearchField({
  id,
  value,
  onChange,
  suggestions,
  onSelectSuggestion,
  onOpenItem,
  placeholder,
  className,
}: ClosetSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const showSuggestions = open && value.trim().length > 0 && suggestions.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, suggestions]);

  function closeSuggestions() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
      return;
    }

    if (!showSuggestions) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const targetIndex = activeIndex >= 0 ? activeIndex : 0;
      const targetItem = suggestions[targetIndex];
      if (targetItem) {
        onOpenItem(targetItem);
        closeSuggestions();
      }
    }
  }

  return (
    <Popover open={showSuggestions} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            value={value}
            placeholder={placeholder}
            className={className}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? `${id}-suggestions` : undefined}
            aria-autocomplete="list"
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(event.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (value.trim().length > 0 && suggestions.length > 0) {
                setOpen(true);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => closeSuggestions(), 150);
            }}
            onKeyDown={handleInputKeyDown}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={`${id}-suggestions`}
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup>
              {suggestions.map((item, index) => {
                const detail = formatClosetSearchSuggestionDetail(item);
                return (
                  <CommandItem
                    key={item.id}
                    value={String(item.id)}
                    data-selected={index === activeIndex ? true : undefined}
                    className="flex flex-col items-start gap-0.5 py-2"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectSuggestion(item);
                      closeSuggestions();
                    }}
                  >
                    <PrimitiveText as="span" variant="bodySm">
                      {formatClosetSearchSuggestionLabel(item)}
                    </PrimitiveText>
                    {detail ? (
                      <PrimitiveText as="span" variant="bodySm" tone="muted">
                        {detail}
                      </PrimitiveText>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
