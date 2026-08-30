import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { PrimitiveText } from "./primitives/PrimitiveText";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

interface SearchSuggestionFieldProps<Suggestion> {
  className?: string;
  getSuggestionDetail?: (suggestion: Suggestion) => ReactNode;
  getSuggestionKey: (suggestion: Suggestion) => string | number;
  getSuggestionLabel: (suggestion: Suggestion) => string;
  id: string;
  onChange: (value: string) => void;
  onOpenSuggestion: (suggestion: Suggestion) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  placeholder?: string;
  suggestions: Suggestion[];
  value: string;
}

export function SearchSuggestionField<Suggestion>({
  className,
  getSuggestionDetail,
  getSuggestionKey,
  getSuggestionLabel,
  id,
  onChange,
  onOpenSuggestion,
  onSelectSuggestion,
  placeholder,
  suggestions,
  value,
}: SearchSuggestionFieldProps<Suggestion>) {
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
      const target = suggestions[activeIndex >= 0 ? activeIndex : 0];
      if (target) {
        onOpenSuggestion(target);
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
              if (value.trim().length > 0 && suggestions.length > 0) setOpen(true);
            }}
            onBlur={() => {
              window.setTimeout(closeSuggestions, 150);
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
              {suggestions.map((suggestion, index) => {
                const detail = getSuggestionDetail?.(suggestion);
                return (
                  <CommandItem
                    key={getSuggestionKey(suggestion)}
                    value={String(getSuggestionKey(suggestion))}
                    data-selected={index === activeIndex ? true : undefined}
                    className="flex flex-col items-start gap-0.5 py-2"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectSuggestion(suggestion);
                      closeSuggestions();
                    }}
                  >
                    <PrimitiveText as="span" variant="bodySm">
                      {getSuggestionLabel(suggestion)}
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
