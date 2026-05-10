import { Camera, ChevronDown, PencilLine, Plus } from "lucide-react";
import {
  PrimitiveDropdownMenu,
  PrimitiveDropdownMenuContent,
  PrimitiveDropdownMenuItem,
  PrimitiveDropdownMenuTrigger,
} from "./primitives/PrimitiveDropdownMenu";

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
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          <Plus className="w-4 h-4" />
          Add Item
          <ChevronDown className="w-4 h-4" />
        </button>
      </PrimitiveDropdownMenuTrigger>

      <PrimitiveDropdownMenuContent align="end" className="w-56">
        <PrimitiveDropdownMenuItem onSelect={onSelectImage}>
          <Camera className="w-4 h-4" />
          <div className="flex flex-col">
            <span>Upload image</span>
            <span className="text-xs text-muted-foreground">Choose a photo in the next step before reviewing detected items.</span>
          </div>
        </PrimitiveDropdownMenuItem>
        <PrimitiveDropdownMenuItem onSelect={onSelectManual}>
          <PencilLine className="w-4 h-4" />
          <div className="flex flex-col">
            <span>Upload manually</span>
            <span className="text-xs text-muted-foreground">Enter the item details yourself.</span>
          </div>
        </PrimitiveDropdownMenuItem>
      </PrimitiveDropdownMenuContent>
    </PrimitiveDropdownMenu>
  );
}
