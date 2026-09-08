import { Check, Plus, Shirt, X } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import {
  CollectionCard,
  CollectionCardHoverActions,
  CollectionCardMedia,
  CollectionCardTitleOverlay,
  CollectionImage,
} from "./shared/CollectionCard";

interface ClothingCardProps {
  id: number;
  name: string;
  tags: string[];
  image_url?: string | null;
  isInOutfit?: boolean;
  onSelect?: (id: number) => void;
  onAddToOutfit?: (id: number) => void;
  onRemoveFromOutfit?: (id: number) => void;
}

export function ClothingCard({
  id,
  name,
  image_url,
  isInOutfit,
  onSelect,
  onAddToOutfit,
  onRemoveFromOutfit,
}: ClothingCardProps) {
  const handleSelect = () => onSelect?.(id);

  return (
    <CollectionCard className="group">
      <CollectionCardMedia className="aspect-[5/6] sm:aspect-[3/4]">
          {isInOutfit ? (
            <div className="absolute left-3 top-3 z-20 rounded-full bg-foreground p-1.5 text-background">
              <Check className="h-3 w-3" aria-hidden="true" />
            </div>
          ) : null}
          <CollectionImage
            src={image_url}
            alt={name}
            fit="contain"
            trimEmptySpace
            empty={(
              <div className="flex h-full w-full flex-col items-center justify-center bg-stone-100 px-6 text-center text-muted-foreground">
                <Shirt className="mb-3 h-10 w-10 stroke-[1.25]" aria-hidden="true" />
                <PrimitiveText as="span" variant="overline" tone="muted">
                  Closet item
                </PrimitiveText>
              </div>
            )}
          />
          <CollectionCardTitleOverlay title={name} />
          <button
            type="button"
            className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
            onClick={handleSelect}
            aria-label={`Open ${name}`}
          />
          <CollectionCardHoverActions>
            <PrimitiveButton
              type="button"
              variant={isInOutfit ? "outline" : "default"}
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                if (isInOutfit) {
                  onRemoveFromOutfit?.(id);
                } else {
                  onAddToOutfit?.(id);
                }
              }}
              aria-label={isInOutfit ? `Remove ${name} from outfit` : `Add ${name} to outfit`}
              className="border-background/60 shadow-sm"
            >
              {isInOutfit ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </PrimitiveButton>
          </CollectionCardHoverActions>
      </CollectionCardMedia>
    </CollectionCard>
  );
}
