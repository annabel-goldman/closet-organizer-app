import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, RotateCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  buildItemPreviewMetadata,
  ClothingItem,
  ClothingItemFormValues,
  createCleanPreviewFile,
  createTransparentPreviewFile,
  destroyClothingItem,
  fetchImageFileFromUrl,
  fetchClothingItem,
  generateClothingItemMetadataSuggestions,
  mergeMetadataSuggestion,
  parseTagInput,
  previewMetadataSuggestions,
  saveClothingItem,
  toClothingItemFormValues,
} from "../lib/closet";
import {
  ClothingItemFormErrors,
  validateClothingItemForm,
  hasClothingItemFormErrors,
} from "../lib/itemFormValidation";
import { usePageData } from "../lib/usePageData";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { ItemEditorWorkspace } from "./ItemEditorWorkspace";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemMetadataPanel } from "./ItemMetadataPanel";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { cn } from "./ui/utils";
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
import { useUndoRedoShortcuts } from "../lib/useUndoRedoShortcuts";
import { useAiActionState } from "../lib/useAiActionState";
import type { ExpandedImageEditorApplyContext } from "./ExpandedImageEditor";

const AUTOSAVE_DELAY_MS = 700;

interface ItemDetailPageProps {
  brandSuggestions?: string[];
  itemId: number;
  initialItem?: ClothingItem | null;
  onBack: () => void;
  onItemDeleted: (itemId: number) => void;
  onItemSaved: (item: ClothingItem) => void;
  tagSuggestions?: string[];
}

export function ItemDetailPage({
  brandSuggestions = [],
  itemId,
  initialItem,
  onBack,
  onItemDeleted,
  onItemSaved,
  tagSuggestions = [],
}: ItemDetailPageProps) {
  const shouldUseInitialItem = Boolean(initialItem?.id === itemId);
  const photoState = useItemPhotoState(initialItem?.image_url);
  const [formValues, setFormValues] = useState<ClothingItemFormValues | null>(
    shouldUseInitialItem && initialItem ? toClothingItemFormValues(initialItem) : null,
  );
  const [fieldErrors, setFieldErrors] = useState<ClothingItemFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [undoHistory, setUndoHistory] = useState<ClothingItem[]>([]);
  const [redoHistory, setRedoHistory] = useState<ClothingItem[]>([]);
  const autosaveBlockedSignatureRef = useRef<string | null>(null);
  const saveInFlightSignatureRef = useRef<string | null>(null);
  const itemRef = useRef<ClothingItem | null>(shouldUseInitialItem ? initialItem ?? null : null);
  const formValuesRef = useRef<ClothingItemFormValues | null>(formValues);
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
  const metadataAutofillAction = useAiActionState();

  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  useEffect(() => {
    formValuesRef.current = formValues;
  }, [formValues]);

  useEffect(() => {
    if (!item) {
      setFormValues(null);
      photoState.reset();
      setUndoHistory([]);
      setRedoHistory([]);
      return;
    }

    setFormValues(toClothingItemFormValues(item));
    photoState.reset();
  }, [item]);

  useEffect(() => {
    setUndoHistory([]);
    setRedoHistory([]);
    setSuccessMessage("");
  }, [item?.id]);

  function showRequestError(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    setErrorMessage("");
    toast.error(message);
  }

  const metadataIsDirty = useMemo(() => {
    if (!item || !formValues) {
      return false;
    }

    return JSON.stringify(toClothingItemFormValues(item)) !== JSON.stringify(formValues);
  }, [formValues, item]);

  const hasPendingImageChange = Boolean(photoState.selectedFile) || photoState.removeExisting;
  const isBusy =
    isSaving
    || metadataAutofillAction.isRunning
    || isUndoing;
  const previewName = formValues?.name.trim() || item?.name?.trim() || "Untitled Item";
  const previewMetadata = formValues
    ? buildItemPreviewMetadata(formValues.size, parseTagInput(formValues.tags))
    : "";
  const footerStatusMessage = successMessage
    || (isUndoing
      ? "Undoing last change..."
      : isBusy
        ? "Saving changes..."
        : metadataIsDirty || hasPendingImageChange
          ? "Changes pending..."
          : "All changes saved");
  const canRunAiActions = Boolean(item && !photoState.removeExisting && !photoState.selectedFile && item.image_url);
  const currentFormSignature = JSON.stringify(formValues ?? {});

  useEffect(() => {
    if (!item || !formValues || isBusy || hasPendingImageChange || !metadataIsDirty) {
      return;
    }

    if (autosaveBlockedSignatureRef.current === currentFormSignature) {
      return;
    }

    if (saveInFlightSignatureRef.current === currentFormSignature) {
      return;
    }

    const validationErrors = validateClothingItemForm(formValues);
    setFieldErrors(validationErrors);

    if (hasClothingItemFormErrors(validationErrors)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistMetadataChange(formValues, {
        successMessage: "",
        trackUndo: true,
        autosaveSignature: currentFormSignature,
      });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [currentFormSignature, formValues, hasPendingImageChange, isBusy, item, metadataIsDirty]);

  function applyPersistedItem(nextItem: ClothingItem, previousItem: ClothingItem | null, trackUndo: boolean) {
    if (trackUndo && previousItem) {
      setUndoHistory((current) => [...current, previousItem]);
      setRedoHistory([]);
    }

    setItem(nextItem);
    onItemSaved(nextItem);
  }

  async function persistMetadataChange(
    nextValues: ClothingItemFormValues,
    options: { successMessage: string; trackUndo: boolean; autosaveSignature?: string },
  ) {
    const currentItem = itemRef.current;
    if (!currentItem) {
      return;
    }

    const saveSignature = JSON.stringify(nextValues);
    if (saveInFlightSignatureRef.current === saveSignature) {
      return;
    }

    setIsSaving(true);
    saveInFlightSignatureRef.current = saveSignature;
    setErrorMessage("");
    if (options.successMessage) {
      setSuccessMessage("");
    }

    try {
      const updatedItem = await saveClothingItem(currentItem.id, currentItem.user_id, nextValues);
      autosaveBlockedSignatureRef.current = null;
      applyPersistedItem(updatedItem, currentItem, options.trackUndo);
      setSuccessMessage(options.successMessage);
    } catch (error) {
      if (options.autosaveSignature) {
        autosaveBlockedSignatureRef.current = options.autosaveSignature;
      }
      showRequestError(error, "Unable to save this clothing item.");
      if (!options.trackUndo && currentItem) {
        setFormValues(toClothingItemFormValues(currentItem));
      }
    } finally {
      if (saveInFlightSignatureRef.current === saveSignature) {
        saveInFlightSignatureRef.current = null;
      }
      setIsSaving(false);
    }
  }

  function handleMetadataCommit(nextValues: ClothingItemFormValues) {
    const currentItem = itemRef.current;
    if (!currentItem || isBusy || hasPendingImageChange) {
      return;
    }

    const nextSignature = JSON.stringify(nextValues);
    if (JSON.stringify(toClothingItemFormValues(currentItem)) === nextSignature) {
      return;
    }

    const validationErrors = validateClothingItemForm(nextValues);
    setFieldErrors(validationErrors);

    if (hasClothingItemFormErrors(validationErrors)) {
      return;
    }

    if (autosaveBlockedSignatureRef.current === nextSignature) {
      return;
    }

    void persistMetadataChange(nextValues, {
      successMessage: "",
      trackUndo: true,
      autosaveSignature: nextSignature,
    });
  }

  async function persistImageChange(
    photoOptions: Parameters<typeof saveClothingItem>[3],
    options: { revertLocalPreview: () => void; successMessage: string },
  ) {
    const currentItem = itemRef.current;
    const nextValues = formValuesRef.current;
    if (!currentItem || !nextValues) {
      return;
    }

    const validationErrors = validateClothingItemForm(nextValues);
    setFieldErrors(validationErrors);
    if (hasClothingItemFormErrors(validationErrors)) {
      options.revertLocalPreview();
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedItem = await saveClothingItem(currentItem.id, currentItem.user_id, nextValues, photoOptions);
      applyPersistedItem(updatedItem, currentItem, true);
      setSuccessMessage(options.successMessage);
    } catch (error) {
      options.revertLocalPreview();
      showRequestError(error, "Unable to update this clothing item image.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleFormValuesChange(nextValues: ClothingItemFormValues) {
    setFormValues(nextValues);
    setSuccessMessage("");

    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors(validateClothingItemForm(nextValues));
    }
  }

  async function handleEditImageFileChange(
    file: File | null,
    context: ExpandedImageEditorApplyContext = { imageKind: "base" },
  ) {
    if (!file || !item) {
      return;
    }

    photoState.updateSelectedFile(file);
    const photoOptions =
      context.imageKind === "base"
        ? { photo: file, removeCleanedPhoto: Boolean(item.cleaned_image_url) }
        : { cleanedPhoto: file };

    void persistImageChange(
      photoOptions,
      {
        revertLocalPreview: () => photoState.reset(),
        successMessage: "Image saved.",
      },
    );
  }

  async function getPreviewEditorFile() {
    if (photoState.selectedFile) {
      return photoState.selectedFile;
    }

    const sourceUrl = photoState.imageUrl ?? itemRef.current?.image_url;
    if (!sourceUrl) {
      return null;
    }

    return fetchImageFileFromUrl(
      sourceUrl,
      `${(formValuesRef.current?.name || itemRef.current?.name || "closet-item").trim() || "closet-item"}-edit-source.png`,
    );
  }

  async function createItemEditorCleanImage(file: File) {
    return createCleanPreviewFile(file, {
      metadata: formValuesRef.current ?? undefined,
    });
  }

  async function createItemEditorTransparentPng(file: File) {
    return createTransparentPreviewFile(file);
  }

  function handlePreviewClear() {
    if (!item?.image_url) {
      return;
    }

    photoState.markExistingForRemoval();
    void persistImageChange(
      { removePhoto: true },
      {
        revertLocalPreview: () => photoState.keepExistingPhoto(),
        successMessage: "Image removed.",
      },
    );
  }

  async function handleAutofillMetadata() {
    const currentItem = itemRef.current;
    const currentValues = formValuesRef.current;
    if (!currentItem || !currentValues) {
      return;
    }

    metadataAutofillAction.start();
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const suggestion = photoState.selectedFile
        ? await previewMetadataSuggestions(photoState.selectedFile, undefined, {
            metadata: currentValues,
          })
        : await generateClothingItemMetadataSuggestions(currentItem.id, currentValues);
      const nextValues = mergeMetadataSuggestion(currentValues, suggestion);
      setFormValues(nextValues);
      await persistMetadataChange(nextValues, {
        successMessage: "AI autofill saved.",
        trackUndo: true,
        autosaveSignature: undefined,
      });
      metadataAutofillAction.succeed();
    } catch (error) {
      metadataAutofillAction.fail(
        error instanceof Error ? error.message : "Unable to autofill this item's metadata.",
      );
      showRequestError(error, "Unable to autofill this item's metadata.");
    }
  }

  async function handleUndo() {
    const snapshot = undoHistory[undoHistory.length - 1];
    const currentItem = itemRef.current;
    if (!snapshot || !currentItem) {
      return;
    }

    setIsUndoing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const [photoFile, cleanedFile] = await Promise.all([
        snapshot.original_image_url
          ? fetchImageFileFromUrl(snapshot.original_image_url, `${snapshot.name || "closet-item"}-original.png`)
          : Promise.resolve<File | undefined>(undefined),
        snapshot.cleaned_image_url
          ? fetchImageFileFromUrl(snapshot.cleaned_image_url, `${snapshot.name || "closet-item"}-cleaned.png`)
          : Promise.resolve<File | undefined>(undefined),
      ]);

      const restoredItem = await saveClothingItem(
        currentItem.id,
        currentItem.user_id,
        toClothingItemFormValues(snapshot),
        {
          photo: photoFile,
          cleanedPhoto: cleanedFile,
          removeCleanedPhoto: !snapshot.cleaned_image_url,
          removePhoto: !snapshot.original_image_url,
        },
      );

      setUndoHistory((current) => current.slice(0, -1));
      setRedoHistory((current) => [...current, currentItem]);
      applyPersistedItem(restoredItem, null, false);
      setSuccessMessage("Last change undone.");
    } catch (error) {
      showRequestError(error, "Unable to undo the last change.");
    } finally {
      setIsUndoing(false);
    }
  }

  async function handleRedo() {
    const snapshot = redoHistory[redoHistory.length - 1];
    const currentItem = itemRef.current;
    if (!snapshot || !currentItem) {
      return;
    }

    setIsUndoing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const [photoFile, cleanedFile] = await Promise.all([
        snapshot.original_image_url
          ? fetchImageFileFromUrl(snapshot.original_image_url, `${snapshot.name || "closet-item"}-original.png`)
          : Promise.resolve<File | undefined>(undefined),
        snapshot.cleaned_image_url
          ? fetchImageFileFromUrl(snapshot.cleaned_image_url, `${snapshot.name || "closet-item"}-cleaned.png`)
          : Promise.resolve<File | undefined>(undefined),
      ]);

      const restoredItem = await saveClothingItem(
        currentItem.id,
        currentItem.user_id,
        toClothingItemFormValues(snapshot),
        {
          photo: photoFile,
          cleanedPhoto: cleanedFile,
          removeCleanedPhoto: !snapshot.cleaned_image_url,
          removePhoto: !snapshot.original_image_url,
        },
      );

      setRedoHistory((current) => current.slice(0, -1));
      setUndoHistory((current) => [...current, currentItem]);
      applyPersistedItem(restoredItem, null, false);
      setSuccessMessage("Last change redone.");
    } catch (error) {
      showRequestError(error, "Unable to redo the last change.");
    } finally {
      setIsUndoing(false);
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
      showRequestError(error, "Unable to delete this clothing item.");
      setIsDeleting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const persistedHistoryDisabled = isBusy || metadataIsDirty || hasPendingImageChange;
  const canUndoSavedChange = undoHistory.length > 0;
  const canRedoSavedChange = redoHistory.length > 0;

  useUndoRedoShortcuts({
    canRedo: canRedoSavedChange,
    canUndo: canUndoSavedChange,
    disabled: persistedHistoryDisabled,
    onRedo: () => void handleRedo(),
    onUndo: () => void handleUndo(),
  });

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
                This removes the item from your closet, and any saved outfits using it will lose
                this piece. This cannot be undone.
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
      }
      imageUrl={photoState.imageUrl}
      onBack={onBack}
      onPreviewClick={() => photoState.inputRef.current?.click()}
      onPreviewClear={handlePreviewClear}
      onPreviewEdit={() => photoState.inputRef.current?.click()}
      previewEditor={{
        getEditableFile: getPreviewEditorFile,
        imageActions: {
          initialKind: "base",
          onClean: createItemEditorCleanImage,
          onMakeTransparent: createItemEditorTransparentPng,
        },
        onApply: handleEditImageFileChange,
      }}
      onSubmit={handleSubmit}
      previewAriaLabel={photoState.imageUrl ? "Preview image" : "Upload photo"}
      previewBackgroundDecoration={
        <Upload
          className="h-40 w-40 text-stone-700/18 sm:h-52 sm:w-52"
          strokeWidth={1.1}
        />
      }
      isPreviewProcessing={false}
      previewLabel="Clothing Item"
      previewPrimaryDetail={previewMetadata}
      previewTitle={previewName}
      footer={
        <div className="mt-auto pt-2 flex items-center justify-between gap-4">
          <PrimitiveText
            as="div"
            variant="bodySm"
            tone={successMessage ? "default" : "muted"}
            role="status"
            aria-live="polite"
            className={cn(
              successMessage && "rounded-none border border-emerald-300/40 bg-emerald-50 px-4 py-2 text-emerald-900",
            )}
          >
            {footerStatusMessage}
          </PrimitiveText>
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
      <ItemMetadataPanel
        action={(
          <div className="mt-0.5 flex items-center gap-2 self-start">
            <PrimitiveButton
              type="button"
              variant="outline"
              size="sm"
              disabled={!canUndoSavedChange || persistedHistoryDisabled}
              onClick={() => void handleUndo()}
              aria-label="Undo last saved change"
            >
              <RotateCcw className="h-4 w-4" />
              Undo
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              variant="outline"
              size="sm"
              disabled={!canRedoSavedChange || persistedHistoryDisabled}
              onClick={() => void handleRedo()}
              aria-label="Redo last saved change"
            >
              <RotateCw className="h-4 w-4" />
              Redo
            </PrimitiveButton>
            <AiMetadataAutofillButton
              className="mt-0 h-9 w-9 shrink-0"
              disabled={!canRunAiActions}
              isLoading={metadataAutofillAction.isRunning}
              label="AI autofill type, name, brand, and tags"
              onClick={() => void handleAutofillMetadata()}
            />
          </div>
        )}
        category={formValues.category}
        title={previewName}
      >
        <div className="grid gap-5 sm:grid-cols-2">
            <ItemMetadataFields
              brandSuggestions={brandSuggestions}
              errors={fieldErrors}
              isAutofilling={metadataAutofillAction.isRunning}
              onChange={handleFormValuesChange}
              onFieldCommit={handleMetadataCommit}
              showAutofillButton={false}
              tagSuggestions={tagSuggestions}
              values={formValues}
          />
        </div>
      </ItemMetadataPanel>
    </ItemEditorWorkspace>
  );
}
