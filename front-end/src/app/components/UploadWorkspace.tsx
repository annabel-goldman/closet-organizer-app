import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ItemHeroPreview } from "./ItemHeroPreview";

interface UploadWorkspaceProps {
  children: ReactNode;
  expandedPreview?: ReactNode;
  imageUrl?: string | null;
  onPreviewClick?: () => void;
  onPreviewClear?: () => void;
  onPreviewEdit?: () => void;
  previewAriaLabel?: string;
  previewBackgroundDecoration?: ReactNode;
  previewMedia?: ReactNode;
  isPreviewProcessing?: boolean;
  previewTopAction?: ReactNode;
  previewLabel: string;
  previewPrimaryDetail: string;
  previewSecondaryDetail?: string | null;
  previewTitle: string;
}

export function UploadWorkspace({
  children,
  expandedPreview,
  imageUrl,
  onPreviewClick,
  onPreviewClear,
  onPreviewEdit,
  previewAriaLabel,
  previewBackgroundDecoration,
  previewMedia,
  isPreviewProcessing,
  previewTopAction,
  previewLabel,
  previewPrimaryDetail,
  previewSecondaryDetail,
  previewTitle,
}: UploadWorkspaceProps) {
  return (
    <div className="grid gap-10 lg:min-h-[min(46rem,calc(100vh-8rem))] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-stretch">
      <div className="lg:h-full">
        <ItemHeroPreview
          expandedPreview={expandedPreview}
          imageUrl={imageUrl}
          label={previewLabel}
          onPreviewClick={onPreviewClick}
          onPreviewClear={onPreviewClear}
          onPreviewEdit={onPreviewEdit}
          previewAriaLabel={previewAriaLabel}
          previewBackgroundDecoration={previewBackgroundDecoration}
          previewMedia={previewMedia}
          isPreviewProcessing={isPreviewProcessing}
          previewTopAction={previewTopAction}
          primaryDetail={previewPrimaryDetail}
          secondaryDetail={previewSecondaryDetail}
          title={previewTitle}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06 }}
        className="flex h-full min-h-0 flex-col gap-5"
      >
        {children}
      </motion.div>
    </div>
  );
}
