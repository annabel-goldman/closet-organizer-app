import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import type { AiWorkflow } from "../../lib/closet";
import { resolveModeledWorkflowImageUrl } from "../../lib/modeledPreview";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "../primitives/PrimitiveConfirmationDialog";
import { ModeledPreviewImageEditor } from "./ModeledPreviewImageEditor";

interface ModeledPreviewPanelProps {
  workflow: AiWorkflow;
  onDelete?: () => void;
  isDeleting?: boolean;
  onWorkflowUpdated: (workflow: AiWorkflow) => void;
}

export function ModeledPreviewPanel({
  workflow,
  onDelete,
  isDeleting = false,
  onWorkflowUpdated,
}: ModeledPreviewPanelProps) {
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const imageUrl = resolveModeledWorkflowImageUrl(workflow);

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="relative border border-border bg-muted/20 p-3" aria-live="polite">
      <img src={imageUrl} alt="Modeled version of this item" className="mx-auto max-h-[30rem] w-full object-contain" />
      {["review", "succeeded"].includes(workflow.status) ? (
        <div className="absolute right-5 top-5 flex gap-2">
          <ModeledPreviewImageEditor
            workflow={workflow}
            imageUrl={imageUrl}
            onWorkflowUpdated={onWorkflowUpdated}
            title="modeled item preview"
            buttonClassName="bg-background/90 shadow-lg backdrop-blur-sm"
          />
          {onDelete ? (
            <PrimitiveConfirmationDialog
              open={isDeleteConfirmationOpen}
              onOpenChange={setIsDeleteConfirmationOpen}
              title="Delete modeled preview?"
              description="This permanently removes the generated image. Your saved clothing item will not be changed."
              cancelLabel="Keep preview"
              confirmLabel={isDeleting ? "Deleting..." : "Delete preview"}
              onConfirm={onDelete}
            >
              <PrimitiveButton
                type="button"
                variant="outline"
                size="icon"
                className="bg-background/90 text-destructive shadow-lg backdrop-blur-sm hover:text-destructive"
                disabled={isDeleting}
                aria-label="Delete modeled item preview"
              >
                {isDeleting
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </PrimitiveButton>
            </PrimitiveConfirmationDialog>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
