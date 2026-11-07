import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { PrimitiveSearchField } from "./primitives/PrimitiveSearchField";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

interface SearchSuggestionFieldProps<Suggestion> {
  className?: string;
  clearLabel?: string;
  getSuggestionDetail?: (suggestion: Suggestion) => ReactNode;
  getSuggestionKey: (suggestion: Suggestion) => string | number;
  getSuggestionLabel: (suggestion: Suggestion) => string;
  id: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onOpenSuggestion: (suggestion: Suggestion) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  placeholder?: string;
  suggestions: Suggestion[];
  showClear?: boolean;
  value: string;
}

export function SearchSuggestionField<Suggestion>({
  className,
  clearLabel,
  getSuggestionDetail,
  getSuggestionKey,
  getSuggestionLabel,
  id,
  onChange,
  onClear,
  onOpenSuggestion,
  onSelectSuggestion,
  placeholder,
  suggestions,
  showClear,
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
      const target = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (target) {
        onOpenSuggestion(target);
      }
      closeSuggestions();
    }
  }

  return (
    <Popover open={showSuggestions} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div>
          <PrimitiveSearchField
            id={id}
            value={value}
            placeholder={placeholder}
            className={className}
            clearLabel={clearLabel}
            onClear={() => {
              onClear?.();
              closeSuggestions();
            }}
            showClear={showClear}
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
