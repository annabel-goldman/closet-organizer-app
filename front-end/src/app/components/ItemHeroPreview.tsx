import { ReactNode, useState } from "react";
import { motion } from "motion/react";
import { Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ItemHeroPreviewProps {
  allowExpand?: boolean;
  expandedPreview?: ReactNode;
  imageUrl?: string | null;
  label: string;
  onPreviewClick?: () => void;
  onPreviewClear?: () => void;
  onPreviewEdit?: () => void;
  primaryDetail: string;
  previewAriaLabel?: string;
  previewBackgroundDecoration?: ReactNode;
  previewMedia?: ReactNode;
  previewTopAction?: ReactNode;
  secondaryDetail?: string | null;
  title: string;
}

export function ItemHeroPreview({
  allowExpand = false,
  expandedPreview,
  imageUrl,
  label,
  onPreviewClick,
  onPreviewClear,
  onPreviewEdit,
  primaryDetail,
  previewAriaLabel,
  previewBackgroundDecoration,
  previewMedia,
  previewTopAction,
  secondaryDetail,
  title,
}: ItemHeroPreviewProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const canExpand = Boolean(
    (imageUrl || expandedPreview) && (allowExpand || onPreviewEdit || onPreviewClear),
  );
  const isInteractive = canExpand || Boolean(onPreviewClick);
  const hasPreviewVisual = Boolean(imageUrl || previewMedia);
  const baseBackgroundClass = hasPreviewVisual
    ? "bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-200"
    : "bg-stone-300";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        onClick={() => {
          if (canExpand) {
            setIsImageExpanded(true);
            return;
          }

          if (onPreviewClick) {
            onPreviewClick();
            return;
          }
        }}
        onKeyDown={(event) => {
          if (!isInteractive) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (canExpand) {
              setIsImageExpanded(true);
              return;
            }

            if (onPreviewClick) {
              onPreviewClick();
              return;
            }
          }
        }}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={isInteractive ? (previewAriaLabel ?? `Expand image for ${title}`) : undefined}
        className={`relative aspect-[4/5] w-full overflow-hidden border border-border p-8 flex flex-col justify-between lg:h-full lg:aspect-auto ${baseBackgroundClass} ${canExpand ? "cursor-zoom-in" : ""} ${onPreviewClick ? "cursor-pointer" : ""}`}
      >
        {previewTopAction ? (
          <div
            className="absolute top-6 right-6 z-30"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {previewTopAction}
          </div>
        ) : null}

        {previewBackgroundDecoration ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {previewBackgroundDecoration}
          </div>
        ) : null}

        {previewMedia ? (
          <>
            <div className="absolute inset-0">
              {previewMedia}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          </>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          </>
        ) : null}

        <div className="relative z-20">
          <PrimitiveText
            as="p"
            variant="overline"
            className="mb-4"
            style={{
              color: hasPreviewVisual ? "rgba(255,255,255,0.78)" : undefined,
            }}
          >
            {label}
          </PrimitiveText>
          <PrimitiveText
            as="h1"
            variant="display"
            font="serif"
            className="mb-0 max-w-[12ch] break-words"
            style={{
              color: hasPreviewVisual ? "white" : "rgba(68, 64, 60, 0.85)",
              fontSize: "clamp(2.75rem, 5vw, 4.75rem)",
              lineHeight: "0.95",
            }}
          >
            {title}
          </PrimitiveText>
        </div>

        <div className="relative z-20 space-y-3">
          <PrimitiveText
            as="p"
            style={{
              color: hasPreviewVisual ? "rgba(255,255,255,0.82)" : undefined,
            }}
          >
            {primaryDetail}
          </PrimitiveText>
          {secondaryDetail && (
            <PrimitiveText
              as="p"
              variant="bodySm"
              style={{
                color: hasPreviewVisual ? "rgba(255,255,255,0.82)" : undefined,
              }}
            >
              {secondaryDetail}
            </PrimitiveText>
          )}
        </div>
      </motion.div>

      {canExpand && (
        <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
          <DialogContent className="max-w-[min(88vw,56rem)] border-none bg-black/95 p-4 shadow-2xl sm:p-6">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Larger preview for {title} with options to update or clear the image.
            </DialogDescription>
            <div className="flex max-h-[72vh] items-center justify-center overflow-hidden">
              {expandedPreview ? (
                <div className="max-h-[72vh] w-full overflow-hidden">
                  {expandedPreview}
                </div>
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  className="max-h-[72vh] w-auto max-w-full object-contain"
                />
              ) : null}
            </div>
            {(onPreviewEdit || onPreviewClear) && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {onPreviewEdit ? (
                    <PrimitiveButton
                      type="button"
                      variant="outline"
                      className="border-white/40 bg-white/10 text-white hover:bg-white/18"
                      onClick={() => {
                        setIsImageExpanded(false);
                        onPreviewEdit();
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      Edit image
                    </PrimitiveButton>
                  ) : null}
                </div>

                {onPreviewClear ? (
                  <PrimitiveButton
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-white/40 bg-white/10 text-white hover:bg-white/18"
                    onClick={() => {
                      setIsImageExpanded(false);
                      onPreviewClear();
                    }}
                    aria-label="Clear image"
                    title="Clear image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </PrimitiveButton>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
