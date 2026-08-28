import { useCallback, useState } from "react";
import { SquarePen } from "lucide-react";
import {
  fetchImageFileFromUrl,
  type AiWorkflow,
  updateModeledPreview,
} from "../../lib/closet";
import { ExpandedImageEditor } from "../ExpandedImageEditor";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";

interface ModeledPreviewImageEditorProps {
  buttonClassName?: string;
  imageUrl: string;
  onWorkflowUpdated: (workflow: AiWorkflow) => void;
  title: string;
  workflow: AiWorkflow;
}

export function ModeledPreviewImageEditor({
  buttonClassName,
  imageUrl,
  onWorkflowUpdated,
  title,
  workflow,
}: ModeledPreviewImageEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const getEditableFile = useCallback(
    () => fetchImageFileFromUrl(imageUrl, `${title.trim() || "modeled-preview"}-edit-source.png`),
    [imageUrl, title],
  );

  async function handleApply(file: File) {
    setIsApplying(true);
    setErrorMessage("");

    try {
      const nextWorkflow = await updateModeledPreview(workflow.id, file);
      onWorkflowUpdated(nextWorkflow);
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save the edited modeled preview.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (isApplying) {
          return;
        }

        setIsOpen(open);
        if (open) {
          setErrorMessage("");
        }
      }}
    >
      <PrimitiveButton
        type="button"
        variant="outline"
        size="icon"
        className={buttonClassName}
        onClick={() => setIsOpen(true)}
        aria-label="Edit modeled preview"
      >
        <SquarePen className="h-4 w-4" />
      </PrimitiveButton>

      <DialogContent className="h-[calc(100vh-4rem)] w-[calc(100vw-4rem)] max-w-none overflow-hidden border-none bg-black/95 p-3 shadow-2xl outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:h-[calc(100vh-5rem)] sm:w-[calc(100vw-5rem)] sm:max-w-none sm:p-5 lg:p-6">
        <DialogTitle className="sr-only">Edit {title}</DialogTitle>
        <DialogDescription className="sr-only">
          Crop, rotate, or remove regions from this modeled preview.
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-col gap-3">
          {errorMessage ? (
            <div className="shrink-0 border border-rose-300/35 bg-rose-950/35 px-4 py-3" role="alert">
              <PrimitiveText variant="bodySm" className="text-rose-100">
                {errorMessage}
              </PrimitiveText>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <ExpandedImageEditor
              getEditableFile={getEditableFile}
              isApplying={isApplying}
              onApply={(file) => handleApply(file)}
              title={title}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
