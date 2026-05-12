import { FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  ClothingItem,
  ClothingItemFormValues,
  createClothingItem,
  createCleanPreviewFile,
  createOutfitUpload,
  CreateItemMode,
  emptyClothingItemFormValues,
  fetchOutfitUpload,
  fetchUser,
  formatDisplaySize,
  formatPossessive,
  generateOutfitDetectionCleanImage,
  OutfitDetection,
  OutfitUpload,
  titleize,
  toClothingItemFormValuesFromDetection,
  User,
} from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { AiCleanImageButton } from "./AiCleanImageButton";
import { CreateItemImageMode } from "./create-item/CreateItemImageMode";
import { ItemMetadataFields } from "./ItemMetadataFields";
import { ItemPhotoField } from "./ItemPhotoField";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { UploadWorkspace } from "./UploadWorkspace";
import { useItemPhotoState } from "../lib/useItemPhotoState";

interface CreateItemPageProps {
  userId: number | null;
  initialMode?: CreateItemMode;
  initialUser?: User | null;
  onBack: () => void;
  onItemsCreated: (items: ClothingItem[]) => void;
}

export function CreateItemPage({
  userId,
  initialMode = "manual",
  initialUser,
  onBack,
  onItemsCreated,
}: CreateItemPageProps) {
  const detectionPollControllerRef = useRef<AbortController | null>(null);
  const [formValues, setFormValues] = useState(emptyClothingItemFormValues);
  const [isCreating, setIsCreating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCleaningUploadedPhoto, setIsCleaningUploadedPhoto] = useState(false);
  const [outfitUpload, setOutfitUpload] = useState<OutfitUpload | null>(null);
  const [selectedDetectionIds, setSelectedDetectionIds] = useState<number[]>([]);
  const [editingDetectionIds, setEditingDetectionIds] = useState<number[]>([]);
  const [cleaningDetectionIds, setCleaningDetectionIds] = useState<number[]>([]);
  const [detectionCleanErrors, setDetectionCleanErrors] = useState<Record<number, string>>({});
  const [editedDetections, setEditedDetections] = useState<Record<number, ClothingItemFormValues>>(
    {},
  );
  const photoState = useItemPhotoState();

  const shouldUseInitialUser = Boolean(userId && initialUser?.id === userId);
  const {
    data: user,
    errorMessage,
    isLoading,
    setErrorMessage,
  } = usePageData<User | null>({
    deps: [initialUser, shouldUseInitialUser, userId],
    enabled: Boolean(userId),
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Unable to load this user.",
    initialData: shouldUseInitialUser ? initialUser ?? null : null,
    load: (signal) => fetchUser(userId!, signal),
    shouldUseInitialData: shouldUseInitialUser,
  });

  const isImageMode = initialMode === "image";
  const sourceImageUrl = photoState.imageUrl ?? outfitUpload?.source_photo_url ?? null;
  const detections = outfitUpload?.detections ?? [];
  const selectedDetections = detections.filter((detection) => selectedDetectionIds.includes(detection.id));
  const selectedCount = selectedDetections.length;

  useEffect(() => {
    return () => {
      detectionPollControllerRef.current?.abort();
    };
  }, []);

  function resetDetectionState() {
    setOutfitUpload(null);
    setSelectedDetectionIds([]);
    setEditingDetectionIds([]);
    setCleaningDetectionIds([]);
    setDetectionCleanErrors({});
    setEditedDetections({});
  }

  async function waitForOutfitUpload(uploadId: number, signal: AbortSignal) {
    const startedAt = Date.now();

    while (!signal.aborted) {
      const nextUpload = await fetchOutfitUpload(uploadId, signal);
      setOutfitUpload(nextUpload);

      if (nextUpload.status === "succeeded" || nextUpload.status === "failed") {
        return nextUpload;
      }

      if (Date.now() - startedAt >= 90_000) {
        throw new Error("Detection is taking longer than expected. Please check back in a moment.");
      }

      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(resolve, 1500);
        const abortHandler = () => {
          window.clearTimeout(timeoutId);
          reject(new DOMException("Aborted", "AbortError"));
        };

        signal.addEventListener("abort", abortHandler, { once: true });
      });
    }

    throw new DOMException("Aborted", "AbortError");
  }

  async function detectItems(file: File) {
    if (!userId) {
      setErrorMessage("A user is required before you can upload from an image.");
      return;
    }

    setIsDetecting(true);
    setErrorMessage("");
    resetDetectionState();
    detectionPollControllerRef.current?.abort();

    try {
      const nextUpload = await createOutfitUpload(userId, { photo: file });
      setOutfitUpload(nextUpload);

      if (nextUpload.status === "pending" || nextUpload.status === "processing") {
        const controller = new AbortController();
        detectionPollControllerRef.current = controller;
        const completedUpload = await waitForOutfitUpload(nextUpload.id, controller.signal);

        if (completedUpload.status === "failed" && completedUpload.error_message) {
          setErrorMessage(completedUpload.error_message);
        }
      } else if (nextUpload.status === "failed" && nextUpload.error_message) {
        setErrorMessage(nextUpload.error_message);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "Unable to analyze this item photo.");
    } finally {
      detectionPollControllerRef.current = null;
      setIsDetecting(false);
    }
  }

  function handleImageFileChange(file: File | null) {
    detectionPollControllerRef.current?.abort();
    photoState.updateSelectedFile(file);
    resetDetectionState();
    setErrorMessage("");
  }

  function clearImageSelection() {
    detectionPollControllerRef.current?.abort();
    photoState.clearSelectedFile();
    resetDetectionState();
    setErrorMessage("");
  }

  function toggleDetectionSelection(detection: OutfitDetection) {
    if (!detection.final_box && !detection.refined_box && !detection.coarse_box && !detection.bounding_box) {
      return;
    }

    setSelectedDetectionIds((current) =>
      current.includes(detection.id)
        ? current.filter((id) => id !== detection.id)
        : [...current, detection.id],
    );
  }

  function getDetectionDraft(detection: OutfitDetection) {
    return editedDetections[detection.id] ?? toClothingItemFormValuesFromDetection(detection);
  }

  function toggleDetectionEditing(detection: OutfitDetection) {
    setEditedDetections((current) => {
      if (current[detection.id]) {
        return current;
      }

      return {
        ...current,
        [detection.id]: toClothingItemFormValuesFromDetection(detection),
      };
    });

    setEditingDetectionIds((current) =>
      current.includes(detection.id)
        ? current.filter((id) => id !== detection.id)
        : [...current, detection.id],
    );
  }

  function updateDetectionDraft(detectionId: number, nextValues: ClothingItemFormValues) {
    setEditedDetections((current) => ({
      ...current,
      [detectionId]: nextValues,
    }));
  }

  async function handleCleanUploadedPhoto() {
    if (!photoState.selectedFile) {
      setErrorMessage("Upload a photo before using the AI cleaner.");
      return;
    }

    setIsCleaningUploadedPhoto(true);
    setErrorMessage("");

    try {
      const cleanedFile = await createCleanPreviewFile(photoState.selectedFile);
      photoState.updateSelectedFile(cleanedFile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.",
      );
    } finally {
      setIsCleaningUploadedPhoto(false);
    }
  }

  async function handleCleanDetectionImage(detectionId: number) {
    setCleaningDetectionIds((current) => [...current, detectionId]);
    setDetectionCleanErrors((current) => {
      const next = { ...current };
      delete next[detectionId];
      return next;
    });

    try {
      const updatedDetection = await generateOutfitDetectionCleanImage(detectionId);
      setOutfitUpload((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          detections: current.detections.map((detection) =>
            detection.id === detectionId ? updatedDetection : detection,
          ),
        };
      });
    } catch (error) {
      setDetectionCleanErrors((current) => ({
        ...current,
        [detectionId]:
          error instanceof Error ? error.message : "Unable to create an AI-cleaned detection image.",
      }));
    } finally {
      setCleaningDetectionIds((current) => current.filter((id) => id !== detectionId));
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setErrorMessage("A user is required before you can create an item.");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const createdItem = await createClothingItem(userId, formValues, {
        photo: photoState.selectedFile,
      });
      onItemsCreated([createdItem]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create this clothing item.");
      setIsCreating(false);
    }
  }

  async function handleSaveSelectedItems() {
    if (!userId) {
      setErrorMessage("A user is required before you can save items to the closet.");
      return;
    }

    if (selectedDetections.length === 0) {
      setErrorMessage("Choose at least one verified detected item to add to the closet.");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const createdItems: ClothingItem[] = [];

      for (const detection of selectedDetections) {
        const createdItem = await createClothingItem(userId, getDetectionDraft(detection), {
          sourceOutfitDetectionId: detection.id,
        });
        createdItems.push(createdItem);
      }

      onItemsCreated(createdItems);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save the selected items to the closet.",
      );
      setIsCreating(false);
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

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <PrimitiveButton
          onClick={onBack}
          variant="ghost"
          className="mb-8 h-auto px-0 py-0 text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </PrimitiveButton>
        <div className="border border-destructive/20 bg-destructive/5 p-6">
          <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
            A user is required before you can add an item.
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            {errorMessage || "Pick a valid user and try again."}
          </PrimitiveText>
        </div>
      </div>
    );
  }

  if (isImageMode) {
    return (
      <CreateItemImageMode
        cleaningDetectionIds={cleaningDetectionIds}
        detectionCleanErrors={detectionCleanErrors}
        detections={detections}
        editingDetectionIds={editingDetectionIds}
        errorMessage={errorMessage}
        getDetectionDraft={getDetectionDraft}
        inputRef={photoState.inputRef}
        isCreating={isCreating}
        isDetecting={isDetecting}
        onBack={onBack}
        onClearImageSelection={clearImageSelection}
        onCleanDetectionImage={(detectionId) => void handleCleanDetectionImage(detectionId)}
        onDetectItems={() => photoState.selectedFile && void detectItems(photoState.selectedFile)}
        onDraftChange={updateDetectionDraft}
        onFileChange={handleImageFileChange}
        onSaveSelectedItems={() => void handleSaveSelectedItems()}
        onToggleEdit={toggleDetectionEditing}
        onToggleSelection={toggleDetectionSelection}
        outfitUpload={outfitUpload}
        selectedCount={selectedCount}
        selectedDetectionIds={selectedDetectionIds}
        selectedFileName={photoState.selectedFile?.name}
        sourceImageUrl={sourceImageUrl}
        user={user}
      />
    );
  }

  const previewName = formValues.name.trim() || "Untitled Item";

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <PrimitiveButton
        onClick={onBack}
        variant="ghost"
        className="mb-8 h-auto px-0 py-0 text-muted-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </PrimitiveButton>

      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        onSubmit={handleManualSubmit}
        className="space-y-6"
      >
        <UploadWorkspace
          imageUrl={photoState.imageUrl}
          previewLabel="New Clothing Item"
          previewPrimaryDetail={formatDisplaySize(formValues.size)}
          previewSecondaryDetail={`Adding to ${formatPossessive(titleize(user.username))}`}
          previewTitle={previewName}
        >
          <div>
            <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
              Add Item
            </PrimitiveText>
            <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
              Create New Item
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Add the item details for {titleize(user.username)} and save it to the closet.
            </PrimitiveText>
          </div>

          {errorMessage && (
            <div className="border border-destructive/20 bg-destructive/5 p-4 text-sm" role="alert" aria-live="assertive">
              {errorMessage}
            </div>
          )}

          <div className="border border-border bg-card p-5">
            <ItemPhotoField
              description="Upload a photo to display behind the item title in the closet and detail views."
              inputRef={photoState.inputRef}
              onClearSelection={photoState.clearSelectedFile}
              onFileChange={photoState.updateSelectedFile}
              selectedFileName={photoState.selectedFile?.name}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-border bg-background/40 px-4 py-3">
              <PrimitiveText as="p" variant="bodySm" tone="muted">
                {photoState.selectedFile
                  ? "Use sparkle to turn the uploaded item photo into a cleaner catalog-style PNG before you save."
                  : "Upload a photo first to use the AI cleaner."}
              </PrimitiveText>
              <AiCleanImageButton
                disabled={!photoState.selectedFile}
                isLoading={isCleaningUploadedPhoto}
                onClick={() => void handleCleanUploadedPhoto()}
              />
            </div>
          </div>

          <div className="border border-border bg-card p-5">
            <div className="mb-4">
              <PrimitiveText as="p" variant="overline" tone="muted" className="mb-2">
                Item Details
              </PrimitiveText>
              <PrimitiveText as="p" variant="bodySm" tone="muted">
                Add the core metadata that should be saved with this item.
              </PrimitiveText>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <ItemMetadataFields values={formValues} onChange={setFormValues} />
            </div>
          </div>

          <div className="border-t border-border pt-5 flex items-center justify-end">
            <PrimitiveButton
              type="submit"
              disabled={isCreating}
              className="h-auto bg-foreground px-5 py-3 text-background hover:bg-foreground/90"
            >
              <Plus className="w-4 h-4" />
              {isCreating ? "Creating..." : "Create Item"}
            </PrimitiveButton>
          </div>
        </UploadWorkspace>
      </motion.form>
    </div>
  );
}
