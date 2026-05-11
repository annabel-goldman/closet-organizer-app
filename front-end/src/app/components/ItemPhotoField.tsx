import { RefObject } from "react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ItemPhotoFieldProps {
  description: string;
  hasExistingPhoto?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  isRemovingExisting?: boolean;
  onClearSelection: () => void;
  onFileChange: (file: File | null) => void;
  onKeepExisting?: () => void;
  onRemoveExisting?: () => void;
  selectedFileName?: string | null;
}

export function ItemPhotoField({
  description,
  hasExistingPhoto = false,
  inputRef,
  isRemovingExisting = false,
  onClearSelection,
  onFileChange,
  onKeepExisting,
  onRemoveExisting,
  selectedFileName,
}: ItemPhotoFieldProps) {
  const isShowingPhotoRow = (Boolean(selectedFileName) || hasExistingPhoto) && !isRemovingExisting;

  return (
    <label className="space-y-2 sm:col-span-2">
      <PrimitiveText as="span" variant="label">
        Photo
      </PrimitiveText>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        className="w-full border border-border bg-card px-4 py-3 file:mr-4 file:border-0 file:bg-transparent file:font-medium"
      />
      <PrimitiveText as="p" variant="bodySm" tone="muted">
        {description}
      </PrimitiveText>

      {isShowingPhotoRow && (
        <div className="flex items-center justify-between gap-4 border border-border bg-card px-4 py-3">
          <PrimitiveText as="span" variant="bodySm">
            {selectedFileName || "Current photo attached"}
          </PrimitiveText>
          <PrimitiveButton
            type="button"
            onClick={selectedFileName ? onClearSelection : onRemoveExisting}
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-muted-foreground"
          >
            {selectedFileName ? "Clear Selection" : "Remove Photo"}
          </PrimitiveButton>
        </div>
      )}

      {isRemovingExisting && (
        <div className="flex items-center justify-between gap-4 border border-dashed border-border px-4 py-3">
          <PrimitiveText as="span" variant="bodySm" tone="muted">
            The current photo will be removed when you save.
          </PrimitiveText>
          <PrimitiveButton
            type="button"
            onClick={onKeepExisting}
            variant="ghost"
            size="sm"
            className="h-auto px-0 py-0 text-muted-foreground"
          >
            Keep Photo
          </PrimitiveButton>
        </div>
      )}
    </label>
  );
}
