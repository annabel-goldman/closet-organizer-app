import { useEffect, useRef } from "react";
import { OutfitDetectionBoundingBox } from "../../lib/closet";

interface DetectionPreviewImageProps {
  alt: string;
  cleanedImageUrl?: string | null;
  cropBox?: OutfitDetectionBoundingBox | null;
  sourceImageUrl?: string | null;
  variant?: "detail" | "thumbnail";
}

export function DetectionPreviewImage({
  alt,
  cleanedImageUrl = null,
  cropBox = null,
  sourceImageUrl = null,
  variant = "detail",
}: DetectionPreviewImageProps) {
  if (cleanedImageUrl) {
    return (
      <img
        src={cleanedImageUrl}
        alt={alt}
        className="block h-full w-full object-cover"
      />
    );
  }

  if (cropBox && sourceImageUrl) {
    return (
      <DetectionCropCanvas
        alt={alt}
        cropBox={cropBox}
        sourceImageUrl={sourceImageUrl}
        variant={variant}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-center text-xs text-muted-foreground">
      Preview unavailable
    </div>
  );
}

function DetectionCropCanvas({
  alt,
  cropBox,
  sourceImageUrl,
  variant,
}: {
  alt: string;
  cropBox: OutfitDetectionBoundingBox;
  sourceImageUrl: string;
  variant: "detail" | "thumbnail";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      const sourceX = image.naturalWidth * cropBox.x;
      const sourceY = image.naturalHeight * cropBox.y;
      const sourceWidth = Math.max(1, image.naturalWidth * cropBox.width);
      const sourceHeight = Math.max(1, image.naturalHeight * cropBox.height);
      if (variant === "thumbnail") {
        const outputSize = 160;
        const scale = Math.max(outputSize / sourceWidth, outputSize / sourceHeight);
        const destinationWidth = sourceWidth * scale;
        const destinationHeight = sourceHeight * scale;
        const destinationX = (outputSize - destinationWidth) / 2;
        const destinationY = (outputSize - destinationHeight) / 2;

        canvas.width = outputSize;
        canvas.height = outputSize;
        context.clearRect(0, 0, outputSize, outputSize);
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          destinationX,
          destinationY,
          destinationWidth,
          destinationHeight,
        );
        return;
      }

      const outputWidth = 720;
      const outputHeight = Math.max(1, Math.round(outputWidth * (sourceHeight / sourceWidth)));

      canvas.width = outputWidth;
      canvas.height = outputHeight;
      context.clearRect(0, 0, outputWidth, outputHeight);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
    };
    image.src = sourceImageUrl;
  }, [cropBox, sourceImageUrl, variant]);

  return <canvas ref={canvasRef} aria-label={alt} className="block h-full w-full object-cover" />;
}
