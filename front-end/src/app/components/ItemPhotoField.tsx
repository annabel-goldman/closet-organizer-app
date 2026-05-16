import { RefObject } from "react";
import { Upload } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ItemPhotoFieldProps {
  description?: string;
  hasExistingPhoto?: boolean;
  hidePickerTrigger?: boolean;
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
  hidePickerTrigger = false,
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        className="sr-only"
      />
      {hidePickerTrigger ? null : (
        <PrimitiveButton
          type="button"
          variant="outline"
          size="icon"
          className="size-12"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload photo"
        >
          <Upload className="w-5 h-5" />
        </PrimitiveButton>
      )}
      {description ? (
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          {description}
        </PrimitiveText>
      ) : null}

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
