import { useState } from "react";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

interface ItemHeroPreviewProps {
  allowExpand?: boolean;
  imageUrl?: string | null;
  label: string;
  primaryDetail: string;
  secondaryDetail?: string | null;
  title: string;
}

export function ItemHeroPreview({
  allowExpand = false,
  imageUrl,
  label,
  primaryDetail,
  secondaryDetail,
  title,
}: ItemHeroPreviewProps) {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const canExpand = Boolean(allowExpand && imageUrl);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        onClick={() => canExpand && setIsImageExpanded(true)}
        onKeyDown={(event) => {
          if (!canExpand) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsImageExpanded(true);
          }
        }}
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : undefined}
        aria-label={canExpand ? `Expand image for ${title}` : undefined}
        className={`relative aspect-[4/5] overflow-hidden border border-border p-8 flex flex-col justify-between bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-200 ${canExpand ? "cursor-zoom-in" : ""}`}
      >
        {imageUrl && (
          <>
            <img
              src={imageUrl}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          </>
        )}

        <div>
          <p
            className="relative uppercase tracking-[0.3em] text-xs mb-4"
            style={{
              color: imageUrl ? "rgba(255,255,255,0.78)" : undefined,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {label}
          </p>
          <h1
            className="relative mb-0 max-w-[12ch] break-words"
            style={{
              color: imageUrl ? "white" : "rgba(68, 64, 60, 0.85)",
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "clamp(2.75rem, 5vw, 4.75rem)",
              lineHeight: "0.95",
            }}
          >
            {title}
          </h1>
        </div>

        <div className="relative space-y-3">
          <p
            style={{
              color: imageUrl ? "rgba(255,255,255,0.82)" : undefined,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {primaryDetail}
          </p>
          {secondaryDetail && (
            <p
              className="text-sm"
              style={{
                color: imageUrl ? "rgba(255,255,255,0.82)" : undefined,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {secondaryDetail}
            </p>
          )}
        </div>
      </motion.div>

      {canExpand && (
        <Dialog open={isImageExpanded} onOpenChange={setIsImageExpanded}>
          <DialogContent className="max-w-[min(92vw,72rem)] border-none bg-black/95 p-4 shadow-2xl sm:p-6">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">
              Full uncropped image preview for {title}.
            </DialogDescription>
            <div className="flex max-h-[85vh] items-center justify-center overflow-hidden">
              <img
                src={imageUrl}
                alt={title}
                className="max-h-[85vh] w-auto max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
