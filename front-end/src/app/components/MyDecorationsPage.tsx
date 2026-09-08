import { ChangeEvent, useEffect, useRef, useState } from "react";
import { CircleAlert, ImagePlus, LoaderCircle, SearchX, Trash2 } from "lucide-react";
import {
  createDecoration,
  destroyDecoration,
  fetchDecorations,
  type Decoration,
  updateDecoration,
} from "../lib/closet";
import { DecorationImageEditor } from "./decorations/DecorationImageEditor";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "./primitives/PrimitiveConfirmationDialog";
import { PrimitiveSearchField } from "./primitives/PrimitiveSearchField";
import { PrimitiveText } from "./primitives/PrimitiveText";
import {
  CollectionCard,
  CollectionCardHoverActions,
  CollectionCardMedia,
  CollectionCardTitleOverlay,
  CollectionImage,
} from "./shared/CollectionCard";
import {
  CollectionGrid,
  CollectionGridSkeleton,
  CollectionPageHeader,
  CollectionPageShell,
  CollectionToolbar,
} from "./shared/CollectionLayout";
import { CollectionNotice } from "./shared/CollectionNotice";
import { VisualStatePanel } from "./shared/VisualStatePanel";
import { Input } from "./ui/input";
import { mapWithConcurrency } from "../lib/asyncPool";

interface UploadProgress {
  failed: number;
  finished: number;
  total: number;
}

interface MyDecorationsPageProps {
  onDecorationDeleted?: (decorationId: number) => void;
  onDecorationUpdated?: (decoration: Decoration) => void;
}

export function MyDecorationsPage({
  onDecorationDeleted,
  onDecorationUpdated,
}: MyDecorationsPageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchDecorations(controller.signal)
      .then(setDecorations)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load decorations.");
        }
      })
      .finally(() => !controller.signal.aborted && setIsLoading(false));
    return () => controller.abort();
  }, []);

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const pngFiles = files.filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
    setErrorMessage(pngFiles.length === files.length ? "" : "Only PNG files were added to your decoration library.");
    setUploadProgress({ failed: files.length - pngFiles.length, finished: files.length - pngFiles.length, total: files.length });

    await mapWithConcurrency(pngFiles, 3, async (file) => {
      try {
        const decoration = await createDecoration({ file });
        setDecorations((current) => [decoration, ...current]);
        setUploadProgress((current) => current ? { ...current, finished: current.finished + 1 } : current);
        return decoration;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : `Unable to upload ${file.name}.`);
        setUploadProgress((current) => current ? { ...current, failed: current.failed + 1, finished: current.finished + 1 } : current);
        throw error;
      }
    });
    window.setTimeout(() => setUploadProgress(null), 1800);
  }

  function replaceDecoration(nextDecoration: Decoration) {
    setDecorations((current) => current.map((entry) => entry.id === nextDecoration.id ? nextDecoration : entry));
    onDecorationUpdated?.(nextDecoration);
  }

  async function renameDecoration(decoration: Decoration, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === decoration.name) return;
    try {
      replaceDecoration(await updateDecoration(decoration.id, { name: trimmedName }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to rename this decoration.");
    }
  }

  async function removeDecoration(decoration: Decoration) {
    try {
      await destroyDecoration(decoration.id);
      setDecorations((current) => current.filter((entry) => entry.id !== decoration.id));
      onDecorationDeleted?.(decoration.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete this decoration.");
    }
  }

  const isUploading = Boolean(uploadProgress && uploadProgress.finished < uploadProgress.total);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredDecorations = normalizedSearchQuery
    ? decorations.filter((decoration) => decoration.name.toLocaleLowerCase().includes(normalizedSearchQuery))
    : decorations;

  return (
    <CollectionPageShell>
      <CollectionPageHeader
        title="My Decorations"
        description={isLoading
          ? "Loading your decorations…"
          : `${decorations.length} reusable ${decorations.length === 1 ? "decoration" : "decorations"}`}
        actions={(
          <>
            <input ref={inputRef} type="file" accept="image/png,.png" multiple className="sr-only" onChange={(event) => void handleFilesSelected(event)} />
            <PrimitiveButton type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
              {isUploading ? `Uploading ${uploadProgress?.finished ?? 0} of ${uploadProgress?.total ?? 0}` : "Add PNGs"}
            </PrimitiveButton>
          </>
        )}
      />

      {errorMessage && decorations.length > 0 ? (
        <CollectionNotice tone="destructive" className="mb-6">{errorMessage}</CollectionNotice>
      ) : null}

      {!isLoading && decorations.length > 0 ? (
        <CollectionToolbar>
          <div className="max-w-xl">
            <label htmlFor="decoration-search" className="sr-only">Search decorations</label>
            <PrimitiveSearchField
              id="decoration-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search decorations by name"
            />
            {searchQuery.trim() ? (
              <PrimitiveText as="p" variant="caption" tone="muted" className="mt-2" aria-live="polite">
                {filteredDecorations.length} of {decorations.length} decorations match
              </PrimitiveText>
            ) : null}
          </div>
        </CollectionToolbar>
      ) : null}

      {isLoading ? (
        <CollectionGridSkeleton count={6} label="Loading decorations" mediaClassName="aspect-square" variant="dense" />
      ) : errorMessage && decorations.length === 0 ? (
        <VisualStatePanel
          icon={CircleAlert}
          overline="Unable to load"
          title="Decorations could not be loaded"
          description={errorMessage}
          tone="destructive"
        >
          <PrimitiveButton type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            Choose PNGs
          </PrimitiveButton>
        </VisualStatePanel>
      ) : decorations.length === 0 ? (
        <VisualStatePanel
          icon={ImagePlus}
          overline="Your decorations"
          title="Add your first PNG decorations"
          description="Select several files at once; each one appears as soon as it finishes uploading."
        >
          <PrimitiveButton type="button" onClick={() => inputRef.current?.click()}>
            <ImagePlus />
            Add PNGs
          </PrimitiveButton>
        </VisualStatePanel>
      ) : filteredDecorations.length === 0 ? (
        <VisualStatePanel
          icon={SearchX}
          overline="No results"
          title="No matching decorations"
          description="Try another decoration name or clear the search to see the full library."
        >
          <PrimitiveButton type="button" variant="outline" onClick={() => setSearchQuery("")}>Clear search</PrimitiveButton>
        </VisualStatePanel>
      ) : (
        <CollectionGrid variant="dense">
          {filteredDecorations.map((decoration) => (
            <CollectionCard key={decoration.id} className="group">
              <CollectionCardMedia className="flex aspect-square items-center justify-center bg-white p-4">
                <CollectionImage src={decoration.image_url} alt={decoration.name} fit="contain" />
                <CollectionCardTitleOverlay contentClassName="pointer-events-auto p-3 sm:p-4">
                  <Input
                    key={decoration.name}
                    type="text"
                    defaultValue={decoration.name}
                    aria-label={`Name for ${decoration.name}`}
                    className="pointer-events-auto h-auto w-full rounded-none border-0 border-b border-transparent bg-transparent p-0 text-lg leading-snug text-white drop-shadow-sm outline-none transition-colors placeholder:text-white/70 hover:border-white/40 focus-visible:border-white/80 focus-visible:ring-0 md:text-lg"
                    style={{ fontFamily: "Cormorant Garamond, serif" }}
                    onBlur={(event) => void renameDecoration(decoration, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        event.currentTarget.value = decoration.name;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </CollectionCardTitleOverlay>
                <CollectionCardHoverActions>
                  <DecorationImageEditor
                    decoration={decoration}
                    onUpdated={replaceDecoration}
                    triggerClassName="border-background/60 bg-background/90 shadow-sm backdrop-blur-sm"
                  />
                  <PrimitiveConfirmationDialog
                    title="Delete decoration?"
                    description="This removes the decoration from your library and from every flat lay or magazine where it is used."
                    confirmLabel="Delete decoration"
                    onConfirm={() => void removeDecoration(decoration)}
                  >
                    <PrimitiveButton type="button" variant="outline" size="icon" className="border-background/60 bg-background/90 text-destructive shadow-sm backdrop-blur-sm hover:border-destructive hover:text-destructive" aria-label={`Delete ${decoration.name}`}><Trash2 /></PrimitiveButton>
                  </PrimitiveConfirmationDialog>
                </CollectionCardHoverActions>
              </CollectionCardMedia>
            </CollectionCard>
          ))}
        </CollectionGrid>
      )}
    </CollectionPageShell>
  );
}
