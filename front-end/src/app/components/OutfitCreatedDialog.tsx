import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface OutfitCreatedDialogProps {
  isOpen: boolean;
  onBackToCloset: () => void;
  onGoToOutfits: () => void;
  onOpenChange: (open: boolean) => void;
}

export function OutfitCreatedDialog({
  isOpen,
  onBackToCloset,
  onGoToOutfits,
  onOpenChange,
}: OutfitCreatedDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-border p-8">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle asChild>
            <PrimitiveText as="h2" variant="display" font="serif" className="text-center">
              Outfit created
            </PrimitiveText>
          </DialogTitle>
          <DialogDescription asChild>
            <PrimitiveText as="p" tone="muted" className="text-center">
              Your selected pieces were saved as a new outfit.
            </PrimitiveText>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 flex-col gap-3 sm:flex-col sm:justify-stretch">
          <PrimitiveButton type="button" onClick={onBackToCloset} className="h-auto w-full py-3">
            Back to Closet
          </PrimitiveButton>
          <PrimitiveButton
            type="button"
            variant="outline"
            onClick={onGoToOutfits}
            className="h-auto w-full py-3"
          >
            Outfits
          </PrimitiveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
