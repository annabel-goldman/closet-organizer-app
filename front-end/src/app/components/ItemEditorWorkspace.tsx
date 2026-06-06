import { FormEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import type {
  ExpandedImageEditorApplyContext,
  ExpandedImageEditorImageActions,
} from "./ExpandedImageEditor";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { UploadWorkspace } from "./UploadWorkspace";

interface ItemEditorWorkspaceProps {
  backLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  formLabel: string;
  formTopAction?: ReactNode;
  imageUrl?: string | null;
  onBack: () => void;
  onPreviewClear?: () => void;
  onPreviewClick?: () => void;
  onPreviewEdit?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  previewEditor?: {
    getEditableFile: () => Promise<File | null>;
    imageActions?: ExpandedImageEditorImageActions;
    onApply: (file: File, context: ExpandedImageEditorApplyContext) => Promise<void> | void;
  };
  previewAriaLabel?: string;
  previewBackgroundDecoration?: ReactNode;
  isPreviewProcessing?: boolean;
  previewLabel: string;
  previewPrimaryDetail: string;
  previewSecondaryDetail?: string | null;
  previewFooter?: ReactNode;
  previewTitle: string;
  previewTopAction?: ReactNode;
}

export function ItemEditorWorkspace({
  backLabel = "Back",
  children,
  footer,
  formLabel,
  formTopAction,
  imageUrl,
  onBack,
  onPreviewClear,
  onPreviewClick,
  onPreviewEdit,
  onSubmit,
  previewEditor,
  previewAriaLabel,
  previewBackgroundDecoration,
  isPreviewProcessing,
  previewLabel,
  previewPrimaryDetail,
  previewSecondaryDetail,
  previewFooter,
  previewTitle,
  previewTopAction,
}: ItemEditorWorkspaceProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <PrimitiveButton
          onClick={onBack}
          variant="outline"
          className="h-auto px-5 py-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </PrimitiveButton>

        {formTopAction ? (
          <div className="flex items-center justify-end gap-4">
            <PrimitiveText as="p" variant="overline" tone="muted">
              {formLabel}
            </PrimitiveText>
            {formTopAction}
          </div>
        ) : (
          <PrimitiveText as="p" variant="overline" tone="muted">
            {formLabel}
          </PrimitiveText>
        )}
      </div>

      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        onSubmit={onSubmit}
        className="space-y-6"
      >
        <UploadWorkspace
          imageUrl={imageUrl}
          onPreviewClick={onPreviewClick}
          onPreviewClear={onPreviewClear}
          onPreviewEdit={onPreviewEdit}
          previewEditor={previewEditor}
          previewAriaLabel={previewAriaLabel}
          previewBackgroundDecoration={previewBackgroundDecoration}
          isPreviewProcessing={isPreviewProcessing}
          previewTopAction={previewTopAction}
          previewLabel={previewLabel}
          previewPrimaryDetail={previewPrimaryDetail}
          previewSecondaryDetail={previewSecondaryDetail}
          previewFooter={previewFooter}
          previewTitle={previewTitle}
        >
          {children}
          {footer}
        </UploadWorkspace>
      </motion.form>
    </div>
  );
}
