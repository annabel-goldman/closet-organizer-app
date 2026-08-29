import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
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
import { PrimitiveText } from "./primitives/PrimitiveText";
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

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <PrimitiveText as="h1" variant="display" font="serif">My Decorations</PrimitiveText>
          <PrimitiveText as="p" tone="muted" className="mt-2">
            {decorations.length} reusable {decorations.length === 1 ? "decoration" : "decorations"}
          </PrimitiveText>
        </div>
        <input ref={inputRef} type="file" accept="image/png,.png" multiple className="sr-only" onChange={(event) => void handleFilesSelected(event)} />
        <PrimitiveButton type="button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
          {isUploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          {isUploading ? `Uploading ${uploadProgress?.finished ?? 0} of ${uploadProgress?.total ?? 0}` : "Add PNGs"}
        </PrimitiveButton>
      </div>

      {errorMessage ? <div className="mb-6 border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{errorMessage}</div> : null}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center" role="status"><LoaderCircle className="animate-spin" /><span className="sr-only">Loading decorations</span></div>
      ) : decorations.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-72 w-full flex-col items-center justify-center border border-dashed border-border bg-stone-50 px-6 text-center">
          <ImagePlus className="mb-4 h-8 w-8" />
          <PrimitiveText as="span" variant="title" font="serif">Add your first PNG decorations</PrimitiveText>
          <PrimitiveText as="span" tone="muted" className="mt-2">Select several files at once; each one appears as soon as it finishes uploading.</PrimitiveText>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {decorations.map((decoration) => (
            <article key={decoration.id} className="border border-border bg-card">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#f3f3f3_25%,transparent_25%),linear-gradient(-45deg,#f3f3f3_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f3f3_75%),linear-gradient(-45deg,transparent_75%,#f3f3f3_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-4">
                <img src={decoration.image_url} alt="" className="max-h-full max-w-full object-contain" />
              </div>
              <div className="border-t border-border p-3">
                <Input
                  defaultValue={decoration.name}
                  aria-label={`Name for ${decoration.name}`}
                  className="mb-3 h-8"
                  onBlur={(event) => void renameDecoration(decoration, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <div className="flex justify-end gap-2">
                  <DecorationImageEditor decoration={decoration} onUpdated={replaceDecoration} />
                  <PrimitiveConfirmationDialog
                    title="Delete decoration?"
                    description="This removes the decoration from your library and from every flat lay or magazine where it is used."
                    confirmLabel="Delete decoration"
                    onConfirm={() => void removeDecoration(decoration)}
                  >
                    <PrimitiveButton type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" aria-label={`Delete ${decoration.name}`}><Trash2 /></PrimitiveButton>
                  </PrimitiveConfirmationDialog>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
