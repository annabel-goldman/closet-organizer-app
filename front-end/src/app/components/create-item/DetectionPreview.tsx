interface DetectionPreviewImageProps {
  alt: string;
  cleanedImageUrl?: string | null;
  sourceImageUrl?: string | null;
}

export function DetectionPreviewImage({
  alt,
  cleanedImageUrl = null,
  sourceImageUrl = null,
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

  if (sourceImageUrl) {
    return (
      <img src={sourceImageUrl} alt={alt} className="block h-full w-full object-cover" />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-center text-xs text-muted-foreground">
      Preview unavailable
    </div>
  );
}
