import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import {
  createCleanPreviewFile,
  ClothingItem,
  ClothingItemFormValues,
  destroyClothingItem,
  fetchClothingItem,
  formatDisplaySize,
  formatTagLabel,
  generateClothingItemCleanImage,
  parseTagInput,
  saveClothingItem,
  toClothingItemFormValues,
} from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { AiCleanImageButton } from "./AiCleanImageButton";
import { ItemHeroPreview } from "./ItemHeroPreview";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemPhotoField } from "./ItemPhotoField";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { useItemPhotoState } from "../lib/useItemPhotoState";

interface ItemDetailPageProps {
  itemId: number;
  initialItem?: ClothingItem | null;
  onBack: () => void;
  onItemSaved: (item: ClothingItem) => void;
  onItemDeleted: (itemId: number) => void;
}

export function ItemDetailPage({
  itemId,
  initialItem,
  onBack,
  onItemSaved,
  onItemDeleted,
}: ItemDetailPageProps) {
  const shouldUseInitialItem = Boolean(initialItem?.id === itemId);
  const photoState = useItemPhotoState(initialItem?.image_url);
  const [formValues, setFormValues] = useState<ClothingItemFormValues | null>(
    shouldUseInitialItem && initialItem ? toClothingItemFormValues(initialItem) : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCleaningImage, setIsCleaningImage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const {
    data: item,
    errorMessage,
    isLoading,
    setData: setItem,
    setErrorMessage,
  } = usePageData<ClothingItem | null>({
    deps: [initialItem, itemId, shouldUseInitialItem],
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Unable to load this clothing item.",
    initialData: shouldUseInitialItem ? initialItem ?? null : null,
    load: (signal) => fetchClothingItem(itemId, signal),
    shouldUseInitialData: shouldUseInitialItem,
  });

  useEffect(() => {
    if (!item) {
      setFormValues(null);
      return;
    }

    setFormValues(toClothingItemFormValues(item));
    photoState.reset();
  }, [item]);

  const isDirty = useMemo(() => {
    if (!item || !formValues) {
      return false;
    }

    const metadataHasChanged =
      JSON.stringify(toClothingItemFormValues(item)) !== JSON.stringify(formValues);

    return metadataHasChanged || Boolean(photoState.selectedFile) || photoState.removeExisting;
  }, [formValues, item, photoState.removeExisting, photoState.selectedFile]);

  const previewName = formValues?.name.trim() || item?.name?.trim() || "Untitled Item";
  const previewTags = formValues ? parseTagInput(formValues.tags).slice(0, 2) : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !formValues) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedItem = await saveClothingItem(item.id, item.user_id, formValues, {
        photo: photoState.selectedFile,
        removePhoto: photoState.removeExisting,
      });
      setItem(updatedItem);
      setSuccessMessage("Item details saved.");
      onItemSaved(updatedItem);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this clothing item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) {
      return;
    }

    const confirmed = window.confirm(`Delete ${item.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");

    try {
      await destroyClothingItem(item.id);
      onItemDeleted(item.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete this clothing item.");
      setIsDeleting(false);
    }
  }

  async function handleCleanImage() {
    if (!item) {
      return;
    }

    setIsCleaningImage(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (photoState.selectedFile) {
        const cleanedFile = await createCleanPreviewFile(photoState.selectedFile);
        photoState.updateSelectedFile(cleanedFile);
        setSuccessMessage("AI-cleaned preview ready. Save changes to keep it.");
      } else {
        const updatedItem = await generateClothingItemCleanImage(item.id);
        setItem(updatedItem);
        setSuccessMessage("AI-cleaned image saved to this item.");
        onItemSaved(updatedItem);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.",
      );
    } finally {
      setIsCleaningImage(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="animate-pulse grid lg:grid-cols-[1.1fr_1fr] gap-10">
          <div className="aspect-[4/5] bg-muted" />
          <div className="space-y-4">
            <div className="h-12 bg-muted w-2/3" />
            <div className="h-4 bg-muted w-1/3" />
            <div className="h-48 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!item || !formValues) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to closet
        </button>
        <div className="border border-destructive/20 bg-destructive/5 p-6">
          <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
            This item could not be loaded.
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            {errorMessage || "The requested item may have been deleted."}
          </PrimitiveText>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to closet
      </button>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] items-start">
        <ItemHeroPreview
          allowExpand
          imageUrl={photoState.imageUrl}
          label="Clothing Item"
          primaryDetail={formatDisplaySize(formValues.size)}
          secondaryDetail={previewTags.length > 0 ? previewTags.map(formatTagLabel).join(" · ") : null}
          title={previewName}
        />

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
                Item Details
              </PrimitiveText>
              <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
                Edit Item
              </PrimitiveText>
              <PrimitiveText as="p" tone="muted">
                Update the metadata shown in the closet and save it back to Rails.
              </PrimitiveText>
            </div>

            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {errorMessage && (
            <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="border border-emerald-300/40 bg-emerald-50 p-4 text-sm text-emerald-900">
              {successMessage}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-4 sm:col-span-2">
              <ItemPhotoField
                description="Upload a photo to display behind the item title throughout the closet."
                hasExistingPhoto={Boolean(item.image_url)}
                inputRef={photoState.inputRef}
                isRemovingExisting={photoState.removeExisting}
                onClearSelection={photoState.clearSelectedFile}
                onFileChange={photoState.updateSelectedFile}
                onKeepExisting={photoState.keepExistingPhoto}
                onRemoveExisting={photoState.markExistingForRemoval}
                selectedFileName={photoState.selectedFile?.name}
              />

              <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-card px-4 py-3">
                <PrimitiveText as="p" variant="bodySm" tone="muted">
                  {photoState.selectedFile
                    ? "Run the AI cleaner on the newly selected image before saving."
                    : item.image_url
                      ? "Generate a cleaner catalog-style PNG from the current saved image."
                      : "Upload a photo first to use the AI cleaner."}
                </PrimitiveText>
                <AiCleanImageButton
                  disabled={photoState.removeExisting || (!photoState.selectedFile && !item.image_url)}
                  isLoading={isCleaningImage}
                  onClick={() => void handleCleanImage()}
                />
              </div>
            </div>
            <ItemMetadataFields values={formValues} onChange={setFormValues} />
          </div>

          <div className="border-t border-border pt-5 flex items-center justify-between gap-4">
            <PrimitiveText as="div" variant="bodySm" tone="muted">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </PrimitiveText>

            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 px-5 py-3 bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
