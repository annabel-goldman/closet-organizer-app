import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, Trash2, Upload } from "lucide-react";
import {
  buildItemPreviewMetadata,
  createCleanPreviewFile,
  ClothingItem,
  ClothingItemFormValues,
  destroyClothingItem,
  fetchClothingItem,
  generateClothingItemCleanImage,
  generateClothingItemMetadataSuggestions,
  mergeMetadataSuggestion,
  parseTagInput,
  previewMetadataSuggestions,
  saveClothingItem,
  toClothingItemFormValues,
} from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { AiCleanImageButton } from "./AiCleanImageButton";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { ItemEditorWorkspace } from "./ItemEditorWorkspace";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemMetadataPanel } from "./ItemMetadataPanel";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
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
  const originalUploadedPhotoRef = useRef<File | null>(null);
  const [formValues, setFormValues] = useState<ClothingItemFormValues | null>(
    shouldUseInitialItem && initialItem ? toClothingItemFormValues(initialItem) : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCleaningImage, setIsCleaningImage] = useState(false);
  const [isAutofillingMetadata, setIsAutofillingMetadata] = useState(false);
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
      originalUploadedPhotoRef.current = null;
      return;
    }

    setFormValues(toClothingItemFormValues(item));
    photoState.reset();
    originalUploadedPhotoRef.current = null;
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
  const previewMetadata = formValues
    ? buildItemPreviewMetadata(formValues.size, parseTagInput(formValues.tags))
    : "";

  function handleEditImageFileChange(file: File | null) {
    if (file) {
      originalUploadedPhotoRef.current = file;
      photoState.updateSelectedFile(file);
    }
  }

  function handlePreviewClear() {
    if (photoState.selectedFile) {
      originalUploadedPhotoRef.current = null;
      photoState.clearSelectedFile();
      return;
    }

    if (item.image_url && !photoState.removeExisting) {
      photoState.markExistingForRemoval();
    }
  }

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
        const cleanedFile = await createCleanPreviewFile(photoState.selectedFile, {
          metadata: formValues,
          originalSourcePhoto: originalUploadedPhotoRef.current,
        });
        photoState.updateSelectedFile(cleanedFile);
        setSuccessMessage("AI-cleaned preview ready. Save changes to keep it.");
      } else {
        const updatedItem = await generateClothingItemCleanImage(item.id, formValues);
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

  async function handleAutofillMetadata() {
    if (!item || !formValues) {
      return;
    }

    setIsAutofillingMetadata(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const suggestion = photoState.selectedFile
        ? await previewMetadataSuggestions(photoState.selectedFile, undefined, {
            metadata: formValues,
            originalSourcePhoto: originalUploadedPhotoRef.current,
          })
        : await generateClothingItemMetadataSuggestions(item.id, formValues);

      setFormValues((current) => (current ? mergeMetadataSuggestion(current, suggestion) : current));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to autofill this item's metadata.",
      );
    } finally {
      setIsAutofillingMetadata(false);
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
        <PrimitiveButton
          onClick={onBack}
          variant="ghost"
          className="mb-8 h-auto px-0 py-0 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to closet
        </PrimitiveButton>
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
    <ItemEditorWorkspace
      backLabel="Back to closet"
      formLabel="Edit Item"
      formTopAction={
        <PrimitiveButton
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          variant="outline"
          className="border-destructive/30 text-destructive hover:bg-destructive/5"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? "Deleting..." : "Delete"}
        </PrimitiveButton>
      }
      imageUrl={photoState.imageUrl}
      onBack={onBack}
      onPreviewClick={() => photoState.inputRef.current?.click()}
      onPreviewClear={handlePreviewClear}
      onPreviewEdit={() => photoState.inputRef.current?.click()}
      onSubmit={handleSubmit}
      previewAriaLabel={photoState.imageUrl ? "Preview image" : "Upload photo"}
      previewBackgroundDecoration={
        <Upload
          className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
          strokeWidth={1.1}
        />
      }
      isPreviewProcessing={isCleaningImage}
      previewTopAction={
        <AiCleanImageButton
          className="size-11 border border-white/75 shadow-sm bg-white/70 p-0 backdrop-blur-sm hover:bg-white/85"
          disabled={photoState.removeExisting || (!photoState.selectedFile && !item.image_url)}
          iconOnly
          isLoading={isCleaningImage}
          label="AI clean PNG"
          onClick={() => void handleCleanImage()}
        />
      }
      previewLabel="Clothing Item"
      previewPrimaryDetail={previewMetadata}
      previewTitle={previewName}
      footer={
        <div className="mt-auto pt-2 flex items-center justify-between gap-4">
          <PrimitiveText as="div" variant="bodySm" tone="muted">
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </PrimitiveText>

          <PrimitiveButton
            type="submit"
            disabled={isSaving || !isDirty}
            className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimitiveButton>
        </div>
      }
    >
      <input
        ref={photoState.inputRef}
        type="file"
        accept="image/*"
        onChange={(event) => handleEditImageFileChange(event.target.files?.[0] ?? null)}
        className="sr-only"
      />

      {errorMessage && (
        <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="border border-emerald-300/40 bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}

      <ItemMetadataPanel
        action={
          <AiMetadataAutofillButton
            className="mt-0.5 h-9 w-9 shrink-0 self-start"
            disabled={photoState.removeExisting || (!photoState.selectedFile && !item.image_url)}
            isLoading={isAutofillingMetadata}
            label="AI autofill type, name, brand, and tags"
            onClick={() => void handleAutofillMetadata()}
          />
        }
        category={formValues.category}
        title={previewName}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ItemMetadataFields
            isAutofilling={isAutofillingMetadata}
            onChange={setFormValues}
            showAutofillButton={false}
            values={formValues}
          />
        </div>
      </ItemMetadataPanel>
    </ItemEditorWorkspace>
  );
}
