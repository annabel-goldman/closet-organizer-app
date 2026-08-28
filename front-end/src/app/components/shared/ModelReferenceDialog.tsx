import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Trash2, UserRound } from "lucide-react";
import {
  destroyAllModelReferences,
  destroyModelReferenceImage,
  reorderModelReferences,
  saveModelReferences,
  type User,
} from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "../primitives/PrimitiveConfirmationDialog";
import { PrimitiveText } from "../primitives/PrimitiveText";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

const MAX_REFERENCE_PHOTOS = 3;

interface ModelReferenceDialogProps {
  user: User;
  onUserUpdated: (user: User) => void;
}

export function ModelReferenceDialog({ user, onUserUpdated }: ModelReferenceDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const references = user.model_reference_photos ?? [];
  const remainingSlots = Math.max(0, MAX_REFERENCE_PHOTOS - references.length);
  const hasReferences = references.length > 0;
  const isBusy = isSaving || isDeletingAll || deletingId !== null || isReordering;

  function clearSelection() {
    setSelectedPhotos([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      clearSelection();
      setErrorMessage("");
    }
  }

  function handlePhotoSelection(files: FileList | null) {
    const nextPhotos = Array.from(files ?? []);
    setErrorMessage("");

    if (nextPhotos.length > remainingSlots) {
      clearSelection();
      setErrorMessage(`Choose up to ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"}.`);
      return;
    }

    setSelectedPhotos(nextPhotos);
  }

  async function handleSave() {
    if (selectedPhotos.length === 0) {
      setErrorMessage("Choose at least one clear reference photo first.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      onUserUpdated(await saveModelReferences(selectedPhotos));
      clearSelection();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save the reference photos.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setErrorMessage("");
    try {
      onUserUpdated(await destroyModelReferenceImage(id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove the reference photo.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteAll() {
    setIsDeletingAll(true);
    setErrorMessage("");
    try {
      onUserUpdated(await destroyAllModelReferences());
      clearSelection();
      setOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete the reference photos.");
    } finally {
      setIsDeletingAll(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= references.length) {
      return;
    }

    const orderedIds = references.map((reference) => reference.id);
    [orderedIds[index], orderedIds[targetIndex]] = [orderedIds[targetIndex], orderedIds[index]];

    setIsReordering(true);
    setErrorMessage("");
    try {
      onUserUpdated(await reorderModelReferences(orderedIds));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reorder the reference photos.");
    } finally {
      setIsReordering(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <PrimitiveButton variant="outline" aria-label="Manage model reference photos">
          <UserRound className="h-4 w-4" />
          <span className="hidden md:inline">Model photos</span>
        </PrimitiveButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle asChild>
            <PrimitiveText as="h2" variant="display" font="serif">
              Model reference photos
            </PrimitiveText>
          </DialogTitle>
          <DialogDescription asChild>
            <PrimitiveText as="p" tone="muted">
              Save up to three private photos to improve your likeness in modeled item and outfit previews.
            </PrimitiveText>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="border border-border bg-muted/35 px-4 py-4">
            <PrimitiveText as="p" variant="bodySm" weight="medium">
              {hasReferences
                ? `${references.length} of ${MAX_REFERENCE_PHOTOS} private references saved.`
                : "No reference photos saved yet."}
            </PrimitiveText>
            <PrimitiveText as="p" variant="caption" tone="muted" className="mt-1">
              Use a front-facing full-body photo, a three-quarter or side view, and a clear face or upper-body photo. The first image is the primary identity reference.
            </PrimitiveText>
          </div>

          {hasReferences ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {references.map((reference, index) => (
                <div key={reference.id} className="border border-border bg-background p-2">
                  <div className="relative aspect-[3/4] overflow-hidden bg-stone-100">
                    <img
                      src={reference.photo_url}
                      alt={`Private model reference ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-2 top-2 bg-background/90 px-2 py-1 backdrop-blur-sm">
                      <PrimitiveText as="span" variant="caption" weight="medium">
                        {index === 0 ? "Primary" : `Reference ${index + 1}`}
                      </PrimitiveText>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <PrimitiveButton
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={isBusy || index === 0}
                        onClick={() => void handleMove(index, -1)}
                        aria-label={`Move reference ${index + 1} earlier`}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </PrimitiveButton>
                      <PrimitiveButton
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={isBusy || index === references.length - 1}
                        onClick={() => void handleMove(index, 1)}
                        aria-label={`Move reference ${index + 1} later`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </PrimitiveButton>
                    </div>
                    <PrimitiveButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      disabled={isBusy}
                      onClick={() => void handleDelete(reference.id)}
                      aria-label={`Remove reference ${index + 1}`}
                    >
                      {deletingId === reference.id
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </PrimitiveButton>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {remainingSlots > 0 ? (
            <label className="block space-y-2">
              <PrimitiveText as="span" variant="label">
                {hasReferences ? `Add up to ${remainingSlots} more` : "Choose up to three photos"}
              </PrimitiveText>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={isBusy}
                onChange={(event) => handlePhotoSelection(event.target.files)}
                className="block w-full border border-border bg-background px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-sm file:text-background disabled:opacity-50"
              />
              {selectedPhotos.length > 0 ? (
                <PrimitiveText as="p" variant="caption" tone="muted">
                  Ready to add: {selectedPhotos.map((photo) => photo.name).join(", ")}
                </PrimitiveText>
              ) : null}
            </label>
          ) : null}

          {errorMessage ? (
            <PrimitiveText as="p" variant="bodySm" tone="destructive" role="alert">
              {errorMessage}
            </PrimitiveText>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
          {hasReferences ? (
            <PrimitiveConfirmationDialog
              title="Remove all model reference photos?"
              description="This removes every private reference photo and turns off modeled preview consent for your account."
              cancelLabel="Keep photos"
              confirmLabel={isDeletingAll ? "Removing..." : "Remove all"}
              onConfirm={() => void handleDeleteAll()}
            >
              <PrimitiveButton variant="ghost" disabled={isBusy} className="text-destructive hover:text-destructive">
                Remove all
              </PrimitiveButton>
            </PrimitiveConfirmationDialog>
          ) : <span />}
          <PrimitiveButton onClick={() => void handleSave()} disabled={selectedPhotos.length === 0 || isBusy}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {isSaving ? "Saving..." : `Add photo${selectedPhotos.length === 1 ? "" : "s"}`}
          </PrimitiveButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
