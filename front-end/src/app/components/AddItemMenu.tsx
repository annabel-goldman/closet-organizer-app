import { Camera, ChevronDown, PencilLine, Plus } from "lucide-react";
import {
  PrimitiveDropdownMenu,
  PrimitiveDropdownMenuContent,
  PrimitiveDropdownMenuItem,
  PrimitiveDropdownMenuTrigger,
} from "./primitives/PrimitiveDropdownMenu";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface AddItemMenuProps {
  disabled?: boolean;
  onSelectImage: () => void;
  onSelectManual: () => void;
}

export function AddItemMenu({
  disabled = false,
  onSelectImage,
  onSelectManual,
}: AddItemMenuProps) {
  return (
    <PrimitiveDropdownMenu>
      <PrimitiveDropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center justify-center gap-3 px-5 py-3 border border-border hover:border-foreground transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <PrimitiveText as="span" variant="bodySm">
            Add Item
          </PrimitiveText>
          <ChevronDown className="w-4 h-4" />
        </button>
      </PrimitiveDropdownMenuTrigger>

      <PrimitiveDropdownMenuContent align="end" className="w-56">
        <PrimitiveDropdownMenuItem onSelect={onSelectImage}>
          <Camera className="w-4 h-4" />
          <div className="flex flex-col">
            <PrimitiveText as="span" variant="bodySm">
              Upload image
            </PrimitiveText>
            <PrimitiveText as="span" variant="caption" tone="muted">
              Choose a photo in the next step before reviewing detected items.
            </PrimitiveText>
          </div>
        </PrimitiveDropdownMenuItem>
        <PrimitiveDropdownMenuItem onSelect={onSelectManual}>
          <PencilLine className="w-4 h-4" />
          <div className="flex flex-col">
            <PrimitiveText as="span" variant="bodySm">
              Upload manually
            </PrimitiveText>
            <PrimitiveText as="span" variant="caption" tone="muted">
              Enter the item details yourself.
            </PrimitiveText>
          </div>
        </PrimitiveDropdownMenuItem>
      </PrimitiveDropdownMenuContent>
    </PrimitiveDropdownMenu>
  );
}
