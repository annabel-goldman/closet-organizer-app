import { useCallback, useState } from "react";
import { SquarePen } from "lucide-react";
import { fetchImageFileFromUrl, type Decoration, updateDecoration } from "../../lib/closet";
import { ExpandedImageEditor } from "../ExpandedImageEditor";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

interface DecorationImageEditorProps {
  decoration: Decoration;
  onUpdated: (decoration: Decoration) => void;
}

export function DecorationImageEditor({ decoration, onUpdated }: DecorationImageEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const getEditableFile = useCallback(
    () => fetchImageFileFromUrl(decoration.image_url, `${decoration.name}-edit-source.png`),
    [decoration.image_url, decoration.name],
  );

  async function handleApply(file: File) {
    setIsApplying(true);
    setErrorMessage("");
    try {
      onUpdated(await updateDecoration(decoration.id, { file }));
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this decoration.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isApplying && setIsOpen(open)}>
      <PrimitiveButton type="button" variant="outline" size="icon" onClick={() => setIsOpen(true)} aria-label={`Edit ${decoration.name}`}>
        <SquarePen />
      </PrimitiveButton>
      <DialogContent className="h-[calc(100vh-4rem)] w-[calc(100vw-4rem)] max-w-none overflow-hidden border-none bg-black/95 p-3 shadow-2xl sm:h-[calc(100vh-5rem)] sm:w-[calc(100vw-5rem)] sm:max-w-none sm:p-5 lg:p-6">
        <DialogTitle className="sr-only">Edit {decoration.name}</DialogTitle>
        <DialogDescription className="sr-only">Crop, rotate, or remove background regions from this decoration.</DialogDescription>
        <div className="flex h-full min-h-0 flex-col gap-3">
          {errorMessage ? (
            <div className="shrink-0 border border-rose-300/35 bg-rose-950/35 px-4 py-3" role="alert">
              <PrimitiveText variant="bodySm" className="text-rose-100">{errorMessage}</PrimitiveText>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <ExpandedImageEditor
              getEditableFile={getEditableFile}
              isApplying={isApplying}
              onApply={(file) => handleApply(file)}
              sourceKey={decoration.image_url}
              title={decoration.name}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
