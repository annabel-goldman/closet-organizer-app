import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

import {
  isFullImageContentBounds,
  measureImageContentBounds,
  type ImageContentBounds,
} from "../../lib/outfitImageBounds";
import { cn } from "../ui/utils";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface CollectionCardProps extends ComponentProps<"article"> {
  children: ReactNode;
  width?: "full" | "standard";
}

export function CollectionCard({ children, className, width = "full", ...props }: CollectionCardProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden border border-border bg-card",
        width === "standard" && "mx-auto w-full max-w-[22rem]",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

interface CollectionCardMediaProps extends ComponentProps<"div"> {
  children: ReactNode;
  padded?: boolean;
}

export function CollectionCardMedia({ children, className, padded = false, ...props }: CollectionCardMediaProps) {
  return (
    <div className={cn("relative overflow-hidden bg-muted/40", padded && "p-5", className)} {...props}>
      {children}
    </div>
  );
}

interface CollectionCardBodyProps extends ComponentProps<"div"> {
  children: ReactNode;
  density?: "default" | "compact";
}

export function CollectionCardBody({
  children,
  className,
  density = "default",
  ...props
}: CollectionCardBodyProps) {
  return (
    <div
      className={cn(
        "flex-1 border-t border-border",
        density === "default" ? "p-5" : "p-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CollectionCardActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}

export function CollectionCardHoverActions({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-3 top-3 z-20 flex translate-y-1 items-center gap-2 opacity-0 transition-[opacity,transform] duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

interface CollectionCardTitleOverlayProps {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  title?: ReactNode;
}

export function CollectionCardTitleOverlay({
  children,
  className,
  contentClassName,
  title,
}: CollectionCardTitleOverlayProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true" />
      <div className={cn("absolute inset-x-0 bottom-0 p-4 sm:p-5", contentClassName)}>
        {children ?? (
          <PrimitiveText
            as="h3"
            variant="display"
            font="serif"
            className="break-words text-white drop-shadow-sm"
          >
            {title}
          </PrimitiveText>
        )}
      </div>
    </div>
  );
}

export function CollectionCardButton({ className, ...props }: ComponentProps<typeof PrimitiveButton>) {
  return (
    <PrimitiveButton
      variant="outline"
      className={cn(
        "relative h-auto w-full flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal border-border bg-card p-0 text-left",
        className,
      )}
      {...props}
    />
  );
}

interface CollectionImageProps extends Omit<ComponentProps<"img">, "src"> {
  empty?: ReactNode;
  fit?: "cover" | "contain";
  src?: string | null;
  trimEmptySpace?: boolean;
}

export function CollectionImage({
  alt,
  className,
  empty,
  fit = "cover",
  onError,
  onLoad,
  src,
  trimEmptySpace = false,
  ...props
}: CollectionImageProps) {
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [hasLoadedSource, setHasLoadedSource] = useState(false);
  const [contentBounds, setContentBounds] = useState<ImageContentBounds | null>(null);

  useEffect(() => {
    setIsLoading(Boolean(src));
    setHasLoadedSource(false);
    setContentBounds(null);
  }, [src]);

  useEffect(() => {
    if (!src || !trimEmptySpace || !hasLoadedSource) {
      return;
    }

    let cancelled = false;
    void measureImageContentBounds({ imageUrl: src }).then((bounds) => {
      if (!cancelled) {
        setContentBounds(bounds && !isFullImageContentBounds(bounds) ? bounds : null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasLoadedSource, src, trimEmptySpace]);

  if (!src) return <>{empty}</>;

  const trimmedGeometry = contentBounds ? contentBoundsSvgGeometry(contentBounds) : null;

  return (
    <>
      {isLoading ? <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" /> : null}
      {trimmedGeometry ? (
        <svg
          viewBox={trimmedGeometry.viewBox}
          preserveAspectRatio="xMidYMid meet"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
          className={cn(
            "h-full w-full transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className,
          )}
          data-content-aware-image="true"
        >
          <image
            href={src}
            x="0"
            y="0"
            width={trimmedGeometry.sourceAspectRatio}
            height="1"
            preserveAspectRatio="none"
          />
        </svg>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            setIsLoading(false);
            setHasLoadedSource(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setIsLoading(false);
            onError?.(event);
          }}
          className={cn(
            "h-full w-full transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            isLoading ? "opacity-0" : "opacity-100",
            className,
          )}
          {...props}
        />
      )}
    </>
  );
}

function contentBoundsSvgGeometry(bounds: ImageContentBounds) {
  const sourceAspectRatio = (
    bounds.aspectRatio * bounds.heightFraction / Math.max(bounds.widthFraction, Number.EPSILON)
  );
  const viewBoxX = bounds.leftFraction * sourceAspectRatio;
  const viewBoxWidth = bounds.widthFraction * sourceAspectRatio;

  return {
    sourceAspectRatio,
    viewBox: `${viewBoxX} ${bounds.topFraction} ${viewBoxWidth} ${bounds.heightFraction}`,
  };
}
