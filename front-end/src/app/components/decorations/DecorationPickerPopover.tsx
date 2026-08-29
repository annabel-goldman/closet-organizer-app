import { useEffect, useId, useMemo, useState } from "react";
import { ImagePlus, LoaderCircle, Search, Sticker } from "lucide-react";
import { fetchDecorations, type Decoration } from "../../lib/closet";
import { navigateTo } from "../../lib/routes";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface DecorationPickerPopoverProps {
  buttonClassName?: string;
  buttonLabel?: string;
  onSelect: (decoration: Decoration) => void;
  side?: "bottom" | "left" | "right" | "top";
}

export function DecorationPickerPopover({
  buttonClassName,
  buttonLabel = "Add decoration",
  onSelect,
  side = "bottom",
}: DecorationPickerPopoverProps) {
  const searchId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen || decorations.length > 0) return;
    const controller = new AbortController();
    setIsLoading(true);
    fetchDecorations(controller.signal)
      .then(setDecorations)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load decorations.");
        }
      })
      .finally(() => !controller.signal.aborted && setIsLoading(false));
    return () => controller.abort();
  }, [decorations.length, isOpen]);

  const filteredDecorations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? decorations.filter((decoration) => decoration.name.toLowerCase().includes(normalizedQuery))
      : decorations;
  }, [decorations, query]);

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setQuery(""); }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PrimitiveButton type="button" variant="outline" size="icon" className={buttonClassName} aria-label={buttonLabel}>
              <Sticker />
            </PrimitiveButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>{buttonLabel}</TooltipContent>
      </Tooltip>
      <PopoverContent side={side} align="end" collisionPadding={16} className="w-[19rem] border-border p-0 shadow-xl">
        <div className="border-b border-border p-3">
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">Add Decoration</PrimitiveText>
          <label className="relative block" htmlFor={searchId}>
            <span className="sr-only">Search decorations</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input id={searchId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search decorations" className="h-9 pl-8" />
          </label>
        </div>
        <div className="max-h-72 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex h-28 items-center justify-center" role="status"><LoaderCircle className="animate-spin" /><span className="sr-only">Loading decorations</span></div>
          ) : errorMessage ? (
            <PrimitiveText as="p" variant="bodySm" className="text-destructive">{errorMessage}</PrimitiveText>
          ) : decorations.length === 0 ? (
            <div className="py-5 text-center">
              <ImagePlus className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <PrimitiveText as="p" variant="bodySm" tone="muted">Your decoration library is empty.</PrimitiveText>
              <PrimitiveButton type="button" variant="link" className="mt-1" onClick={() => navigateTo("/decorations")}>Open My Decorations</PrimitiveButton>
            </div>
          ) : filteredDecorations.length === 0 ? (
            <PrimitiveText as="p" variant="bodySm" tone="muted" className="py-6 text-center">No decorations match this search.</PrimitiveText>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredDecorations.map((decoration) => (
                <button
                  key={decoration.id}
                  type="button"
                  className="group aspect-square overflow-hidden border border-border bg-stone-50 p-2 hover:border-foreground"
                  onClick={() => { onSelect(decoration); setIsOpen(false); }}
                  aria-label={`Add ${decoration.name}`}
                  title={decoration.name}
                >
                  <img src={decoration.image_url} alt="" className="h-full w-full object-contain transition-transform group-hover:scale-105" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-right">
          <PrimitiveButton type="button" variant="link" size="sm" onClick={() => navigateTo("/decorations")}>Manage decorations</PrimitiveButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
