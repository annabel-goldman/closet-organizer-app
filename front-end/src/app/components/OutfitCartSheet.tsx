import { ShoppingBag, Trash2 } from "lucide-react";
import { ClothingItem, buildItemPreviewMetadata } from "../lib/closet";
import { MAX_OUTFIT_NAME, MAX_OUTFIT_NOTES } from "../lib/inputLengthPolicy";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface OutfitCartSheetProps {
  createErrorMessage?: string;
  isCreating: boolean;
  isOpen: boolean;
  items: ClothingItem[];
  onCreateOutfit: () => void;
  onOpenChange: (open: boolean) => void;
  onRemoveItem: (itemId: number) => void;
  onTagInputChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onOutfitNameChange: (value: string) => void;
  notes: string;
  outfitName: string;
  tagInput: string;
}

export function OutfitCartSheet({
  createErrorMessage = "",
  isCreating,
  isOpen,
  items,
  onCreateOutfit,
  onOpenChange,
  onRemoveItem,
  onTagInputChange,
  onNotesChange,
  onOutfitNameChange,
  notes,
  outfitName,
  tagInput,
}: OutfitCartSheetProps) {
  const itemCount = items.length;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-l border-border bg-stone-50 p-0 sm:max-w-md">
        <SheetHeader className="gap-2 border-b border-border px-5 py-4 pr-14">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle asChild>
                <PrimitiveText as="h2" variant="title" font="serif">
                  Outfit Cart
                </PrimitiveText>
              </SheetTitle>
              {itemCount > 0 ? (
                <SheetDescription asChild>
                  <PrimitiveText as="p" variant="bodySm" tone="muted">
                    {itemCount} {itemCount === 1 ? "piece" : "pieces"} ready to turn into an outfit.
                  </PrimitiveText>
                </SheetDescription>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="space-y-2">
              <label htmlFor="outfit-cart-name" className="block">
                <PrimitiveText as="p" variant="bodySm" tone="muted">
                  Outfit name
                </PrimitiveText>
              </label>
              <Input
                id="outfit-cart-name"
                value={outfitName}
                onChange={(event) => onOutfitNameChange(event.target.value)}
                placeholder="Optional now, editable later"
                className="h-10 bg-white"
                maxLength={MAX_OUTFIT_NAME}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="outfit-cart-tags" className="block">
                <PrimitiveText as="span" variant="bodySm" tone="muted">
                  Tags
                </PrimitiveText>
              </label>
              <Input
                id="outfit-cart-tags"
                value={tagInput}
                onChange={(event) => onTagInputChange(event.target.value)}
                placeholder="ex. date night, spring, casual"
                className="h-10 bg-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="outfit-cart-notes" className="block">
                <PrimitiveText as="span" variant="bodySm" tone="muted">
                  Notes
                </PrimitiveText>
              </label>
              <Textarea
                id="outfit-cart-notes"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Add styling notes, occasion ideas, or reminders."
                className="min-h-20 bg-white py-2"
                maxLength={MAX_OUTFIT_NOTES}
              />
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {createErrorMessage ? (
            <div className="mb-3 border border-destructive/20 bg-destructive/5 p-3">
              <PrimitiveText as="p" variant="bodySm" tone="destructive">
                {createErrorMessage}
              </PrimitiveText>
            </div>
          ) : null}

          {itemCount === 0 ? (
            <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 border border-dashed border-border bg-white/70 px-5 text-center">
              <PrimitiveText as="h3" variant="title" font="serif">
                Your cart is empty
              </PrimitiveText>
              <PrimitiveText as="p" variant="bodySm" tone="muted">
                Tap Add to Outfit on any closet card and it will appear here.
              </PrimitiveText>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const metadata = buildItemPreviewMetadata(item.tags);

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border border-border bg-white p-2.5 shadow-sm"
                  >
                    <div className="h-20 w-16 shrink-0 overflow-hidden bg-stone-200">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-end bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 p-3">
                          <PrimitiveText as="span" variant="overline">
                            {item.category || "Closet piece"}
                          </PrimitiveText>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <PrimitiveText as="h3" variant="title" font="serif" className="break-words">
                        {item.name}
                      </PrimitiveText>
                      {metadata ? (
                        <PrimitiveText as="p" variant="bodySm" tone="muted" className="mt-0.5">
                          {metadata}
                        </PrimitiveText>
                      ) : null}
                    </div>

                    <PrimitiveButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.name} from outfit`}
                      onClick={() => onRemoveItem(item.id)}
                      className="mt-0.5 h-8 w-8 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </PrimitiveButton>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border bg-background px-5 py-4">
          <div className="space-y-3">
            <PrimitiveButton
              type="button"
              onClick={onCreateOutfit}
              disabled={itemCount === 0 || isCreating}
              className="h-auto w-full px-5 py-3 text-base"
            >
              {isCreating ? "Creating outfit..." : "Create Outfit"}
            </PrimitiveButton>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
