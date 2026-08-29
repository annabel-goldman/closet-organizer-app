import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, RotateCw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import {
  buildItemPreviewMetadata,
  createCleanPreviewFile,
  ClothingItem,
  ClothingItemFormValues,
  deleteModeledPreview,
  destroyClothingItem,
  fetchImageFileFromUrl,
  fetchClothingItem,
  generateClothingItemCleanImage,
  generateClothingItemMetadataSuggestions,
  mergeMetadataSuggestion,
  parseTagInput,
  previewMetadataSuggestions,
  requestModeledImage,
  saveClothingItem,
  toClothingItemFormValues,
  AiWorkflow,
} from "../lib/closet";
import {
  ClothingItemFormErrors,
  clothingItemFieldElementId,
  firstInvalidClothingItemField,
  hasClothingItemFormErrors,
  validateClothingItemForm,
} from "../lib/itemFormValidation";
import { usePageData } from "../lib/usePageData";
import { AiCleanImageButton } from "./AiCleanImageButton";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { ItemEditorWorkspace } from "./ItemEditorWorkspace";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemMetadataPanel } from "./ItemMetadataPanel";
import { ModeledPreviewPanel } from "./shared/ModeledPreviewPanel";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import type { ExpandedImageEditorApplyContext } from "./ExpandedImageEditor";
import { useUndoRedoShortcuts } from "../lib/useUndoRedoShortcuts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useItemPhotoState } from "../lib/useItemPhotoState";

interface ItemDetailPageProps {
  brandSuggestions?: string[];
  itemId: number;
  initialItem?: ClothingItem | null;
  onBack: () => void;
  onItemDeleted: (itemId: number) => void;
  onItemSaved: (item: ClothingItem) => void;
  tagSuggestions?: string[];
  canUseModeledPreview?: boolean;
  backgroundCleanWorkflow?: AiWorkflow | null;
  backgroundModeledWorkflow?: AiWorkflow | null;
  onGenerationTaskStarted: (workflow: AiWorkflow, label: string) => void;
}

export function ItemDetailPage({
  brandSuggestions = [],
  itemId,
  initialItem,
  onBack,
  onItemDeleted,
  onItemSaved,
  tagSuggestions = [],
  canUseModeledPreview = false,
  backgroundCleanWorkflow,
  backgroundModeledWorkflow,
  onGenerationTaskStarted,
}: ItemDetailPageProps) {
  const shouldUseInitialItem = Boolean(initialItem?.id === itemId);
  const photoState = useItemPhotoState(initialItem?.image_url);
  const originalUploadedPhotoRef = useRef<File | null>(null);
  const [formValues, setFormValues] = useState<ClothingItemFormValues | null>(
    shouldUseInitialItem && initialItem ? toClothingItemFormValues(initialItem) : null,
  );
  const [fieldErrors, setFieldErrors] = useState<ClothingItemFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isCleaningImage, setIsCleaningImage] = useState(false);
  const [isAutofillingMetadata, setIsAutofillingMetadata] = useState(false);
  const [undoHistory, setUndoHistory] = useState<ClothingItem[]>([]);
  const [redoHistory, setRedoHistory] = useState<ClothingItem[]>([]);
  const [selectedImageKind, setSelectedImageKind] =
    useState<ExpandedImageEditorApplyContext["imageKind"]>("base");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [modeledWorkflow, setModeledWorkflow] = useState<AiWorkflow | null>(null);
  const [isRequestingModeledPreview, setIsRequestingModeledPreview] = useState(false);
  const [isDeletingModeledPreview, setIsDeletingModeledPreview] = useState(false);
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
    setModeledWorkflow(null);
    photoState.reset();
    originalUploadedPhotoRef.current = null;
    setSelectedImageKind("base");
  }, [item]);

  useEffect(() => {
    if (backgroundModeledWorkflow) {
      setModeledWorkflow(backgroundModeledWorkflow);
    }
  }, [backgroundModeledWorkflow]);

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
    ? buildItemPreviewMetadata(parseTagInput(formValues.tags))
    : "";
  const isBackgroundCleaning = ["pending", "processing"].includes(backgroundCleanWorkflow?.status ?? "");
  const persistedHistoryDisabled = isSaving || isDeleting || isUndoing || isCleaningImage || isBackgroundCleaning || isAutofillingMetadata;
  const canUndoSavedChange = undoHistory.length > 0;
  const canRedoSavedChange = redoHistory.length > 0;

  useUndoRedoShortcuts({
    canRedo: canRedoSavedChange,
    canUndo: canUndoSavedChange,
    disabled: persistedHistoryDisabled,
    onRedo: () => void handleRedo(),
    onUndo: () => void handleUndo(),
  });

  function handleEditImageFileChange(
    file: File | null,
    context: ExpandedImageEditorApplyContext = { imageKind: "base" },
  ) {
    if (file) {
      if (context.imageKind === "base") {
        originalUploadedPhotoRef.current = file;
      }
      setSelectedImageKind(context.imageKind);
      photoState.updateSelectedFile(file);
    }
  }

  function handlePreviewClear() {
    if (photoState.selectedFile) {
      originalUploadedPhotoRef.current = null;
      setSelectedImageKind("base");
      photoState.clearSelectedFile();
      return;
    }

    if (item?.image_url && !photoState.removeExisting) {
      photoState.markExistingForRemoval();
    }
  }

  function focusFirstInvalidField(errors: ClothingItemFormErrors) {
    const firstField = firstInvalidClothingItemField(errors);
    if (!firstField) {
      return;
    }

    document.getElementById(clothingItemFieldElementId(firstField))?.focus();
  }

  function handleFormValuesChange(nextValues: ClothingItemFormValues) {
    setFormValues(nextValues);
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors(validateClothingItemForm(nextValues));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !formValues) {
      return;
    }

    const validationErrors = validateClothingItemForm(formValues);
    setFieldErrors(validationErrors);

    if (hasClothingItemFormErrors(validationErrors)) {
      focusFirstInvalidField(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const photoOptions = photoState.selectedFile
        ? selectedImageKind === "base"
          ? { photo: photoState.selectedFile }
          : { cleanedPhoto: photoState.selectedFile }
        : {};
      const updatedItem = await saveClothingItem(item.id, item.user_id, formValues, {
        ...photoOptions,
        removePhoto: photoState.removeExisting,
      });
      setUndoHistory((current) => [...current, item]);
      setRedoHistory([]);
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

    setIsDeleting(true);
    setErrorMessage("");

    try {
      await destroyClothingItem(item.id);
      setIsDeleteDialogOpen(false);
      onItemDeleted(item.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete this clothing item.");
      setIsDeleting(false);
    }
  }

  async function handleCleanImage() {
    if (!item || !formValues) {
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
        setSelectedImageKind("cleaned");
        photoState.updateSelectedFile(cleanedFile);
        setSuccessMessage("AI-cleaned preview ready. Save changes to keep it.");
      } else {
        const workflow = await generateClothingItemCleanImage(item.id, formValues);
        onGenerationTaskStarted(workflow, item.name);
        setSuccessMessage("Image cleaning started. You can leave this page while it runs.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.",
      );
    } finally {
      setIsCleaningImage(false);
    }
  }

  async function getPreviewEditorFile() {
    if (photoState.selectedFile) {
      return photoState.selectedFile;
    }

    const sourceUrl = photoState.imageUrl ?? item?.image_url;
    if (!sourceUrl) {
      return null;
    }

    return fetchImageFileFromUrl(
      sourceUrl,
      `${(formValues?.name || item?.name || "closet-item").trim() || "closet-item"}-edit-source.png`,
    );
  }

  async function createItemEditorCleanImage(file: File) {
    return createCleanPreviewFile(file, {
      metadata: formValues ?? undefined,
      originalSourcePhoto: originalUploadedPhotoRef.current,
    });
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

  async function handleRequestModeledPreview() {
    if (!item) {
      return;
    }

    setIsRequestingModeledPreview(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const workflow = await requestModeledImage(item.id);
      setModeledWorkflow(workflow);
      onGenerationTaskStarted(workflow, item.name);
      setSuccessMessage("Modeled preview queued. It will appear here when it is ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create a modeled preview.");
    } finally {
      setIsRequestingModeledPreview(false);
    }
  }

  async function handleDeleteModeledPreview() {
    if (!modeledWorkflow) {
      return;
    }

    setIsDeletingModeledPreview(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const workflow = await deleteModeledPreview(modeledWorkflow.id);
      setModeledWorkflow(workflow);
      onGenerationTaskStarted(workflow, item?.name ?? "modeled item preview");
      setSuccessMessage("Modeled preview deleted.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete the modeled preview.");
    } finally {
      setIsDeletingModeledPreview(false);
    }
  }

  async function restorePersistedSnapshot(snapshot: ClothingItem, message: string) {
    if (!item) {
      return null;
    }

    const [photoFile, cleanedFile] = await Promise.all([
      snapshot.original_image_url
        ? fetchImageFileFromUrl(snapshot.original_image_url, `${snapshot.name || "closet-item"}-original.png`)
        : Promise.resolve<File | undefined>(undefined),
      snapshot.cleaned_image_url
        ? fetchImageFileFromUrl(snapshot.cleaned_image_url, `${snapshot.name || "closet-item"}-cleaned.png`)
        : Promise.resolve<File | undefined>(undefined),
    ]);

    const restoredItem = await saveClothingItem(
      item.id,
      item.user_id,
      toClothingItemFormValues(snapshot),
      {
        photo: photoFile,
        cleanedPhoto: cleanedFile,
        removeCleanedPhoto: !snapshot.cleaned_image_url,
        removePhoto: !snapshot.original_image_url,
      },
    );

    setItem(restoredItem);
    setFormValues(toClothingItemFormValues(restoredItem));
    setSelectedImageKind("base");
    photoState.reset();
    setSuccessMessage(message);
    onItemSaved(restoredItem);
    return restoredItem;
  }

  async function handleUndo() {
    const snapshot = undoHistory[undoHistory.length - 1];
    if (!snapshot || !item) {
      return;
    }

    setIsUndoing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await restorePersistedSnapshot(snapshot, "Last change undone.");
      setUndoHistory((current) => current.slice(0, -1));
      setRedoHistory((current) => [...current, item]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to undo the last change.");
    } finally {
      setIsUndoing(false);
    }
  }

  async function handleRedo() {
    const snapshot = redoHistory[redoHistory.length - 1];
    if (!snapshot || !item) {
      return;
    }

    setIsUndoing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await restorePersistedSnapshot(snapshot, "Last change redone.");
      setRedoHistory((current) => current.slice(0, -1));
      setUndoHistory((current) => [...current, item]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to redo the last change.");
    } finally {
      setIsUndoing(false);
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
        <div className="flex flex-wrap items-center gap-2">
          <PrimitiveButton
            type="button"
            onClick={() => void handleUndo()}
            disabled={!canUndoSavedChange || persistedHistoryDisabled}
            variant="outline"
            size="sm"
            aria-label="Undo last saved change"
          >
            <RotateCcw className="w-4 h-4" />
            Undo
          </PrimitiveButton>
          <PrimitiveButton
            type="button"
            onClick={() => void handleRedo()}
            disabled={!canRedoSavedChange || persistedHistoryDisabled}
            variant="outline"
            size="sm"
            aria-label="Redo last saved change"
          >
            <RotateCw className="w-4 h-4" />
            Redo
          </PrimitiveButton>
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <PrimitiveButton
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </PrimitiveButton>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the item from your closet and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeleting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDelete();
                  }}
                >
                  {isDeleting ? "Deleting..." : "Delete item"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {canUseModeledPreview ? (
            <PrimitiveButton
              type="button"
              onClick={() => void handleRequestModeledPreview()}
              disabled={isRequestingModeledPreview || isCleaningImage || isBackgroundCleaning || !item.image_url}
              variant="outline"
              className="border-foreground/30"
            >
              <Sparkles className="h-4 w-4" />
              {isRequestingModeledPreview ? "Queueing..." : "Model on me"}
            </PrimitiveButton>
          ) : null}
        </div>
      }
      imageUrl={photoState.imageUrl}
      onBack={onBack}
      onPreviewClick={() => photoState.inputRef.current?.click()}
      onPreviewClear={handlePreviewClear}
      onPreviewEdit={() => photoState.inputRef.current?.click()}
      previewEditor={{
        getEditableFile: getPreviewEditorFile,
        imageActions: {
          initialKind: selectedImageKind,
          onClean: createItemEditorCleanImage,
        },
        onApply: handleEditImageFileChange,
        sourceKey: photoState.imageUrl ?? item.image_url ?? `item-${item.id}-no-image`,
      }}
      onSubmit={handleSubmit}
      previewAriaLabel={photoState.imageUrl ? "Preview image" : "Upload photo"}
      previewBackgroundDecoration={
        <Upload
          className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
          strokeWidth={1.1}
        />
      }
      isPreviewProcessing={isCleaningImage || isBackgroundCleaning}
      previewTopAction={
        <AiCleanImageButton
          className="size-11 border border-white/75 shadow-sm bg-white/70 p-0 backdrop-blur-sm hover:bg-white/85"
          disabled={photoState.removeExisting || (!photoState.selectedFile && !item.image_url)}
          iconOnly
          isLoading={isCleaningImage || isBackgroundCleaning}
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
            {isUndoing ? "Restoring change..." : isDirty ? "Unsaved changes" : "All changes saved"}
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

      {canUseModeledPreview && modeledWorkflow && modeledWorkflow.status !== "deleted" ? (
        <ModeledPreviewPanel
          workflow={modeledWorkflow}
          isDeleting={isDeletingModeledPreview}
          onDelete={() => void handleDeleteModeledPreview()}
          onWorkflowUpdated={(workflow) => {
            setModeledWorkflow(workflow);
            onGenerationTaskStarted(workflow, item.name);
            setSuccessMessage("Modeled preview edits saved.");
          }}
        />
      ) : null}

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
            brandSuggestions={brandSuggestions}
            errors={fieldErrors}
            isAutofilling={isAutofillingMetadata}
            onChange={handleFormValuesChange}
            showAutofillButton={false}
            tagSuggestions={tagSuggestions}
            values={formValues}
          />
        </div>
      </ItemMetadataPanel>
    </ItemEditorWorkspace>
  );
}
