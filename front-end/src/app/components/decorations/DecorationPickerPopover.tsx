import { useEffect, useId, useMemo, useState } from "react";
import { ImagePlus, LoaderCircle, Sticker } from "lucide-react";
import { fetchDecorations, type Decoration } from "../../lib/closet";
import { navigateTo } from "../../lib/routes";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitivePickerPopover } from "../primitives/PrimitivePickerPopover";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { Popover, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface DecorationPickerPopoverProps {
  buttonClassName?: string;
  buttonLabel?: string;
  buttonText?: string;
  onSelect: (decoration: Decoration) => void;
  side?: "bottom" | "left" | "right" | "top";
}

export function DecorationPickerPopover({
  buttonClassName,
  buttonLabel = "Add decoration",
  buttonText,
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
            <PrimitiveButton type="button" variant="outline" size={buttonText ? "default" : "icon"} className={buttonClassName} aria-label={buttonLabel}>
              <Sticker />
              {buttonText}
            </PrimitiveButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>{buttonLabel}</TooltipContent>
      </Tooltip>
      <PrimitivePickerPopover
        side={side}
        align={side === "right" ? "start" : "end"}
        sideOffset={side === "right" ? 12 : 4}
        collisionPadding={side === "right" ? { top: 16, right: 16, bottom: 76, left: 16 } : 16}
        title="Add Decoration"
        searchId={searchId}
        searchLabel="Search decorations"
        searchPlaceholder="Search decorations"
        searchValue={query}
        onSearchValueChange={setQuery}
        footer={(
          <PrimitiveButton type="button" variant="link" size="sm" onClick={() => navigateTo("/decorations")}>
            Manage decorations
          </PrimitiveButton>
        )}
      >
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
              <PrimitiveButton
                key={decoration.id}
                type="button"
                variant="outline"
                className="group aspect-square h-auto w-full overflow-hidden bg-stone-50 p-2 hover:border-foreground hover:bg-stone-50"
                onClick={() => { onSelect(decoration); setIsOpen(false); }}
                aria-label={`Add ${decoration.name}`}
                title={decoration.name}
              >
                <img src={decoration.image_url} alt="" className="h-full w-full object-contain" draggable={false} />
              </PrimitiveButton>
            ))}
          </div>
        )}
      </PrimitivePickerPopover>
    </Popover>
  );
}
