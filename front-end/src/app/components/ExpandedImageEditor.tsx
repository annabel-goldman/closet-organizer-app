import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  convertToPixelCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./ExpandedImageEditor.css";
import {
  Crop as CropIcon,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useAiActionState } from "../lib/useAiActionState";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { cn } from "./ui/utils";

type EditorTool = "crop" | "wand";
export type ExpandedImageEditorImageKind = "base" | "cleaned" | "transparent";

interface WandDragState {
  seedX: number;
  seedY: number;
  pointerId: number;
}

interface WandImageSource {
  file: File;
  imageData: ImageData;
  name: string;
}

interface EditorHistoryEntry {
  file: File;
  imageKind: ExpandedImageEditorImageKind;
}

export interface ExpandedImageEditorApplyContext {
  imageKind: ExpandedImageEditorImageKind;
}

export interface ExpandedImageEditorImageActions {
  initialKind?: ExpandedImageEditorImageKind;
  onClean?: (file: File) => Promise<File>;
  onMakeTransparent?: (file: File) => Promise<File>;
}

interface ExpandedImageEditorProps {
  getEditableFile: () => Promise<File | null>;
  imageActions?: ExpandedImageEditorImageActions;
  isApplying?: boolean;
  onApply: (file: File, context: ExpandedImageEditorApplyContext) => Promise<void> | void;
  title: string;
}

export function ExpandedImageEditor({
  getEditableFile,
  imageActions,
  isApplying = false,
  onApply,
  title,
}: ExpandedImageEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tool, setTool] = useState<EditorTool>("crop");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentImageKind, setCurrentImageKind] = useState<ExpandedImageEditorImageKind>(
    imageActions?.initialKind ?? "base",
  );
  const [history, setHistory] = useState<EditorHistoryEntry[]>([]);
  const [redoHistory, setRedoHistory] = useState<EditorHistoryEntry[]>([]);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [selectionMask, setSelectionMask] = useState<Uint8Array | null>(null);
  const [tolerance, setTolerance] = useState(26);
  const [isSelecting, setIsSelecting] = useState(false);
  const [mediaNaturalSize, setMediaNaturalSize] = useState({ height: 0, width: 0 });
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });
  const cleanImageAction = useAiActionState();
  const transparentPngAction = useAiActionState();
  const imageViewportRef = useRef<HTMLDivElement | null>(null);
  const wandDragStateRef = useRef<WandDragState | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const wandBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wandOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wandImageSourceRef = useRef<WandImageSource | null>(null);
  const imageUrl = useObjectUrl(currentFile);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setLoadError("");

      try {
        const file = await getEditableFile();
        if (!isMounted) {
          return;
        }

        if (!file) {
          setLoadError("Unable to prepare this image for editing.");
          setCurrentFile(null);
          return;
        }

        setCurrentFile(file);
        setCurrentImageKind(imageActions?.initialKind ?? "base");
        setHistory([]);
        setRedoHistory([]);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Unable to prepare this image for editing.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [getEditableFile, imageActions?.initialKind]);

  useEffect(() => {
    setSelectionMask(null);
    setCrop(undefined);
    setCompletedCrop(null);
  }, [currentFile, tool]);

  useEffect(() => {
    const element = imageViewportRef.current;
    if (!element) {
      return;
    }

    const updateViewportSize = (width: number, height: number) => {
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));
      setViewportSize((current) => (
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { height: nextHeight, width: nextWidth }
      ));
    };

    const bounds = element.getBoundingClientRect();
    updateViewportSize(bounds.width, bounds.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      updateViewportSize(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [imageUrl, isLoading, loadError, tool]);

  useEffect(() => {
    if (tool !== "wand") {
      return;
    }

    const baseCanvas = wandBaseCanvasRef.current;
    const overlayCanvas = wandOverlayCanvasRef.current;
    if (!baseCanvas || !overlayCanvas || !imageUrl || !currentFile) {
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) {
        return;
      }

      setMediaNaturalSize({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
      baseCanvas.width = image.naturalWidth;
      baseCanvas.height = image.naturalHeight;
      overlayCanvas.width = image.naturalWidth;
      overlayCanvas.height = image.naturalHeight;
      const baseContext = baseCanvas.getContext("2d");
      const overlayContext = overlayCanvas.getContext("2d");
      if (!baseContext || !overlayContext) {
        return;
      }

      baseContext.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseContext.drawImage(image, 0, 0);
      const sourceImageData = baseContext.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
      wandImageSourceRef.current = {
        file: currentFile,
        imageData: sourceImageData,
        name: currentFile.name,
      };
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (selectionMask) {
        overlaySelectionMask(overlayContext, selectionMask, overlayCanvas.width, overlayCanvas.height);
      }
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [currentFile, imageUrl, tool]);

  useEffect(() => {
    if (tool !== "wand") {
      return;
    }

    const overlayCanvas = wandOverlayCanvasRef.current;
    const overlayContext = overlayCanvas?.getContext("2d");
    if (!overlayCanvas || !overlayContext) {
      return;
    }

    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (selectionMask) {
      overlaySelectionMask(overlayContext, selectionMask, overlayCanvas.width, overlayCanvas.height);
    }
  }, [selectionMask, tool]);

  const canUndo = history.length > 0;
  const canRedo = redoHistory.length > 0;
  const canApplyCrop = Boolean(completedCrop && completedCrop.width > 0 && completedCrop.height > 0);
  const canApplyWand = Boolean(selectionMask);
  const canRunClean = Boolean(currentFile && imageActions?.onClean);
  const canRunTransparent = Boolean(
    currentFile
    && imageActions?.onMakeTransparent
    && currentImageKind === "cleaned",
  );
  const editorBusy =
    isLoading
    || isApplying
    || isSelecting
    || cleanImageAction.isRunning
    || transparentPngAction.isRunning;

  async function pushNextFile(
    nextFile: File,
    options: { imageKind?: ExpandedImageEditorImageKind } = {},
  ) {
    if (!currentFile) {
      setCurrentFile(nextFile);
      setCurrentImageKind(options.imageKind ?? currentImageKind);
      return;
    }

    const nextImageKind = options.imageKind ?? currentImageKind;

    setHistory((current) => [...current, { file: currentFile, imageKind: currentImageKind }]);
    setRedoHistory([]);
    setCurrentFile(nextFile);
    setCurrentImageKind(nextImageKind);
  }

  function handleUndo() {
    if (!currentFile) {
      return;
    }

    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) {
        return current;
      }

      setRedoHistory((nextRedoHistory) => [
        ...nextRedoHistory,
        { file: currentFile, imageKind: currentImageKind },
      ]);
      setCurrentFile(previous.file);
      setCurrentImageKind(previous.imageKind);
      return current.slice(0, -1);
    });
  }

  function handleRedo() {
    if (!currentFile) {
      return;
    }

    setRedoHistory((current) => {
      const nextFile = current[current.length - 1];
      if (!nextFile) {
        return current;
      }

      setHistory((nextHistory) => [
        ...nextHistory,
        { file: currentFile, imageKind: currentImageKind },
      ]);
      setCurrentFile(nextFile.file);
      setCurrentImageKind(nextFile.imageKind);
      return current.slice(0, -1);
    });
  }

  function handleCropImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setMediaNaturalSize({
      height: event.currentTarget.naturalHeight,
      width: event.currentTarget.naturalWidth,
    });
  }

  async function handleApplyCrop() {
    if (!currentFile || !completedCrop || !imageRef.current) {
      return;
    }

    const nextFile = await cropImageFile(currentFile, imageRef.current, completedCrop);
    await pushNextFile(nextFile);
  }

  function pointerPositionFromEvent(
    canvas: HTMLCanvasElement,
    event: Pick<React.PointerEvent<HTMLCanvasElement>, "clientX" | "clientY">,
  ) {
    const bounds = canvas.getBoundingClientRect();
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;

    return {
      x: Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - bounds.left) * scaleX))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - bounds.top) * scaleY))),
    };
  }

  function runWandSelection(seedX: number, seedY: number, nextTolerance: number) {
    const overlayCanvas = wandOverlayCanvasRef.current;
    const overlayContext = overlayCanvas?.getContext("2d");
    const source = wandImageSourceRef.current;
    if (!overlayCanvas || !overlayContext || !source) {
      return;
    }

    const mask = floodFillMask(source.imageData, seedX, seedY, nextTolerance);
    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlaySelectionMask(overlayContext, mask, overlayCanvas.width, overlayCanvas.height);
    setSelectionMask(mask);
  }

  function handleWandPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!currentFile || tool !== "wand" || isLoading || isApplying) {
      return;
    }

    const canvas = wandOverlayCanvasRef.current;
    if (!canvas) {
      return;
    }

    const { x, y } = pointerPositionFromEvent(canvas, event);
    wandDragStateRef.current = { seedX: x, seedY: y, pointerId: event.pointerId };
    setTolerance(18);
    setIsSelecting(true);
    canvas.setPointerCapture(event.pointerId);
    runWandSelection(x, y, 18);
  }

  function handleWandPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = wandOverlayCanvasRef.current;
    const dragState = wandDragStateRef.current;
    if (!canvas || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const { x, y } = pointerPositionFromEvent(canvas, event);
    const dragDistance = Math.hypot(x - dragState.seedX, y - dragState.seedY);
    const nextTolerance = Math.max(6, Math.min(96, Math.round(10 + (dragDistance / 6))));
    setTolerance(nextTolerance);
    runWandSelection(dragState.seedX, dragState.seedY, nextTolerance);
  }

  function finishWandSelection(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = wandOverlayCanvasRef.current;
    const dragState = wandDragStateRef.current;
    if (!canvas || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    wandDragStateRef.current = null;
    setIsSelecting(false);
  }

  async function handleApplyWand() {
    if (!currentFile || !selectionMask) {
      return;
    }

    const nextFile = await eraseSelectionFromFile(currentFile, selectionMask);
    await pushNextFile(nextFile);
  }

  async function handleDeleteCropSelection() {
    if (!currentFile || !completedCrop || !imageRef.current) {
      return;
    }

    const nextFile = await eraseCropSelectionFromFile(currentFile, imageRef.current, completedCrop);
    await pushNextFile(nextFile);
  }

  async function handleRotateImage(degrees: 90 | 180 | 270) {
    if (!currentFile) {
      return;
    }

    const nextFile = await rotateImageFile(currentFile, degrees);
    await pushNextFile(nextFile);
  }

  async function handleApplyEdits() {
    if (!currentFile) {
      return;
    }

    await onApply(currentFile, { imageKind: currentImageKind });
  }

  async function handleRunClean() {
    if (!currentFile || !imageActions?.onClean) {
      return;
    }

    cleanImageAction.start();
    try {
      const cleanedFile = await imageActions.onClean(currentFile);
      await pushNextFile(cleanedFile, { imageKind: "cleaned" });
      cleanImageAction.succeed();
    } catch (error) {
      cleanImageAction.fail(
        error instanceof Error ? error.message : "Unable to create an AI-cleaned item image.",
      );
    }
  }

  async function handleRunTransparent() {
    if (!currentFile || !imageActions?.onMakeTransparent || currentImageKind !== "cleaned") {
      return;
    }

    transparentPngAction.start();
    try {
      const transparentFile = await imageActions.onMakeTransparent(currentFile);
      await pushNextFile(transparentFile, { imageKind: "transparent" });
      transparentPngAction.succeed();
    } catch (error) {
      transparentPngAction.fail(
        error instanceof Error ? error.message : "Unable to make a transparent PNG for this item image.",
      );
    }
  }

  useEffect(() => {
    function handleEditorKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const targetTagName = target instanceof HTMLElement ? target.tagName : null;
      const isTypingTarget = Boolean(
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      );
      const isButtonTarget = targetTagName === "BUTTON";

      if (event.defaultPrevented || editorBusy || event.altKey) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (isTypingTarget) {
          return;
        }

        if (event.shiftKey) {
          if (!canRedo) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          handleRedo();
          return;
        }

        if (!canUndo) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        handleUndo();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        return;
      }

      if (isTypingTarget) {
        return;
      }

      if (event.key === "Enter" && tool === "crop" && canApplyCrop) {
        if (isButtonTarget) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        void handleApplyCrop();
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace")) {
        if (tool === "crop" && canApplyCrop) {
          event.preventDefault();
          event.stopPropagation();
          void handleDeleteCropSelection();
          return;
        }

        if (tool === "wand" && canApplyWand) {
          event.preventDefault();
          event.stopPropagation();
          void handleApplyWand();
        }
      }
    }

    window.addEventListener("keydown", handleEditorKeyDown, true);
    return () => window.removeEventListener("keydown", handleEditorKeyDown, true);
  }, [canApplyCrop, canApplyWand, canRedo, canUndo, editorBusy, tool, handleApplyCrop, handleApplyWand, handleDeleteCropSelection, handleRedo, handleUndo]);

  const toolbarButtonClass =
    "h-9 border-white/20 bg-white/8 px-3 text-white hover:bg-white/14 data-[active=true]:bg-white data-[active=true]:text-stone-950";
  const editorViewportClass =
    "relative h-full min-h-0 w-full overflow-hidden bg-black/60";
  const fittedMediaSize = containSize(mediaNaturalSize, viewportSize);
  const editorMediaBoxStyle = fittedMediaSize
    ? ({
        height: `${Math.max(1, fittedMediaSize.height)}px`,
        width: `${Math.max(1, fittedMediaSize.width)}px`,
      } as const)
    : undefined;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden lg:flex-row">
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-stretch overflow-hidden border border-white/12 bg-black/40">
        {isLoading ? (
          <div className="flex h-full min-h-[28rem] items-center justify-center text-white">
            <LoaderCircle className="h-6 w-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex h-full min-h-[28rem] items-center justify-center px-6 text-center">
            <PrimitiveText className="text-white/80">{loadError}</PrimitiveText>
          </div>
        ) : tool === "crop" && imageUrl ? (
          <div
            ref={imageViewportRef}
            className={editorViewportClass}
          >
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="max-h-full max-w-full shrink-0 overflow-hidden" style={editorMediaBoxStyle}>
                <ReactCrop
                  crop={crop}
                  onChange={(nextCrop, nextPercentCrop) => {
                    setCrop(nextPercentCrop);
                  }}
                  onComplete={(nextCrop) => setCompletedCrop(nextCrop)}
                  className="expanded-image-editor-crop"
                  style={editorMediaBoxStyle}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={title}
                    className="block max-h-full max-w-full"
                    onLoad={handleCropImageLoad}
                  />
                </ReactCrop>
              </div>
            </div>
          </div>
        ) : imageUrl ? (
          <div
            ref={imageViewportRef}
            className={editorViewportClass}
          >
            <div className="flex h-full w-full items-center justify-center p-4">
              <div className="relative max-h-full max-w-full shrink-0 overflow-hidden" style={editorMediaBoxStyle}>
                <canvas
                  ref={wandBaseCanvasRef}
                  className="absolute inset-0 block h-full w-full"
                />
                <canvas
                  ref={wandOverlayCanvasRef}
                  className="absolute inset-0 block h-full w-full cursor-crosshair"
                  onPointerDown={handleWandPointerDown}
                  onPointerMove={handleWandPointerMove}
                  onPointerUp={finishWandSelection}
                  onPointerCancel={finishWandSelection}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex h-full max-h-full w-full shrink-0 flex-col gap-5 overflow-y-auto border border-white/12 bg-black/45 p-5 text-white lg:w-[24rem] xl:w-[26rem] xl:p-6">
        <PrimitiveText as="h2" variant="title" className="text-white">
          {title}
        </PrimitiveText>

        {imageActions?.onClean || imageActions?.onMakeTransparent ? (
          <div className="space-y-3">
            <PrimitiveText variant="overline" className="text-white/60">
              Image Actions
            </PrimitiveText>
            <div className="flex flex-col gap-2">
              {imageActions?.onClean ? (
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  className="w-full justify-start border-white/20 bg-white/8 px-4 text-white hover:bg-white/14"
                  disabled={!canRunClean || editorBusy}
                  onClick={() => void handleRunClean()}
                >
                  {cleanImageAction.isRunning ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  AI clean image
                </PrimitiveButton>
              ) : null}
              {imageActions?.onMakeTransparent ? (
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  className="w-full justify-start border-white/20 bg-white/8 px-4 text-white hover:bg-white/14"
                  disabled={!canRunTransparent || editorBusy}
                  onClick={() => void handleRunTransparent()}
                >
                  {transparentPngAction.isRunning ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="h-4 w-4" />
                  )}
                  Make transparent PNG
                </PrimitiveButton>
              ) : null}
              {cleanImageAction.errorMessage || transparentPngAction.errorMessage ? (
                <PrimitiveText variant="bodySm" className="text-rose-200/90">
                  {cleanImageAction.errorMessage || transparentPngAction.errorMessage}
                </PrimitiveText>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <PrimitiveButton
            type="button"
            variant="outline"
            className={cn(toolbarButtonClass)}
            data-active={tool === "crop"}
            onClick={() => setTool("crop")}
          >
            <CropIcon className="h-4 w-4" />
            Crop
          </PrimitiveButton>
          <PrimitiveButton
            type="button"
            variant="outline"
            className={cn(toolbarButtonClass)}
            data-active={tool === "wand"}
            onClick={() => setTool("wand")}
          >
            <WandSparkles className="h-4 w-4" />
            Magic wand
          </PrimitiveButton>
        </div>

        <div className="space-y-3">
          <PrimitiveText variant="overline" className="text-white/60">
            Rotate
          </PrimitiveText>
          <div className="flex flex-wrap gap-2">
            <PrimitiveButton
              type="button"
              variant="outline"
              className={cn(toolbarButtonClass)}
              disabled={!currentFile || editorBusy}
              onClick={() => void handleRotateImage(270)}
            >
              <RotateCcw className="h-4 w-4" />
              Left
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              variant="outline"
              className={cn(toolbarButtonClass)}
              disabled={!currentFile || editorBusy}
              onClick={() => void handleRotateImage(180)}
            >
              180
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              variant="outline"
              className={cn(toolbarButtonClass)}
              disabled={!currentFile || editorBusy}
              onClick={() => void handleRotateImage(90)}
            >
              <RotateCw className="h-4 w-4" />
              Right
            </PrimitiveButton>
          </div>
        </div>

        {tool === "crop" ? (
          <div className="space-y-3">
            <PrimitiveButton
              type="button"
              variant="outline"
              className="w-full border-white/20 bg-white/8 text-white hover:bg-white/14"
              disabled={!canApplyCrop || editorBusy}
              onClick={() => void handleApplyCrop()}
            >
              <CropIcon className="h-4 w-4" />
              Apply crop
            </PrimitiveButton>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <PrimitiveButton
                type="button"
                variant="outline"
                className="flex-1 border-white/20 bg-white/8 text-white hover:bg-white/14"
                disabled={!selectionMask || editorBusy}
                onClick={() => setSelectionMask(null)}
              >
                Clear selection
              </PrimitiveButton>
              <PrimitiveButton
                type="button"
                variant="outline"
                className="flex-1 border-white/20 bg-white/8 text-white hover:bg-white/14"
                disabled={!canApplyWand || editorBusy}
                onClick={() => void handleApplyWand()}
              >
                <Sparkles className="h-4 w-4" />
                Erase selection
              </PrimitiveButton>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
          <div className="flex gap-2">
            <PrimitiveButton
              type="button"
              variant="outline"
              className="flex-1 border-white/20 bg-white/8 text-white hover:bg-white/14"
              disabled={!canUndo || editorBusy}
              onClick={handleUndo}
            >
              <RotateCcw className="h-4 w-4" />
              Undo edit
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              variant="outline"
              className="flex-1 border-white/20 bg-white/8 text-white hover:bg-white/14"
              disabled={!canRedo || editorBusy}
              onClick={handleRedo}
            >
              <RotateCw className="h-4 w-4" />
              Redo edit
            </PrimitiveButton>
          </div>
          <PrimitiveButton
            type="button"
            className="w-full bg-white text-stone-950 hover:bg-white/90"
            disabled={!currentFile || editorBusy}
            onClick={() => void handleApplyEdits()}
          >
            {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Apply edited image
          </PrimitiveButton>
        </div>
      </div>
    </div>
  );
}

function containSize(
  naturalSize: { height: number; width: number },
  viewportSize: { height: number; width: number },
) {
  if (
    naturalSize.width <= 0 ||
    naturalSize.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    viewportSize.width / naturalSize.width,
    viewportSize.height / naturalSize.height,
  );

  return {
    height: Math.max(1, naturalSize.height * scale),
    width: Math.max(1, naturalSize.width * scale),
  };
}

function useObjectUrl(file: File | null) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return objectUrl;
}

async function cropImageFile(sourceFile: File, image: HTMLImageElement, crop: PixelCrop) {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(crop.width * scaleX));
  canvas.height = Math.max(1, Math.floor(crop.height * scaleY));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to apply this crop.");
  }

  context.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvasToPngFile(canvas, cropFilename(sourceFile.name, "crop"));
}

async function eraseCropSelectionFromFile(sourceFile: File, image: HTMLImageElement, crop: PixelCrop) {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to erase this cropped selection.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.clearRect(
    Math.floor(crop.x * scaleX),
    Math.floor(crop.y * scaleY),
    Math.max(1, Math.floor(crop.width * scaleX)),
    Math.max(1, Math.floor(crop.height * scaleY)),
  );

  return canvasToPngFile(canvas, cropFilename(sourceFile.name, "crop-delete"));
}

async function eraseSelectionFromFile(sourceFile: File, selectionMask: Uint8Array) {
  const image = await loadImageFromFile(sourceFile);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to erase this image selection.");
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < selectionMask.length; index += 1) {
    if (!selectionMask[index]) {
      continue;
    }

    const alphaIndex = (index * 4) + 3;
    data[alphaIndex] = 0;
  }

  context.putImageData(imageData, 0, 0);
  return canvasToPngFile(canvas, cropFilename(sourceFile.name, "wand"));
}

async function rotateImageFile(sourceFile: File, degrees: 90 | 180 | 270) {
  const image = await loadImageFromFile(sourceFile);
  const canvas = document.createElement("canvas");
  const turnsQuarter = degrees === 90 || degrees === 270;
  canvas.width = turnsQuarter ? image.naturalHeight : image.naturalWidth;
  canvas.height = turnsQuarter ? image.naturalWidth : image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to rotate this image.");
  }

  context.save();
  switch (degrees) {
    case 90:
      context.translate(canvas.width, 0);
      break;
    case 180:
      context.translate(canvas.width, canvas.height);
      break;
    case 270:
      context.translate(0, canvas.height);
      break;
  }
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
  context.restore();

  const suffix = degrees === 180 ? "rotate-180" : degrees === 90 ? "rotate-right" : "rotate-left";
  return canvasToPngFile(canvas, cropFilename(sourceFile.name, suffix));
}

function overlaySelectionMask(
  context: CanvasRenderingContext2D,
  selectionMask: Uint8Array,
  width: number,
  height: number,
) {
  const overlay = context.createImageData(width, height);
  const { data } = overlay;

  for (let index = 0; index < selectionMask.length; index += 1) {
    if (!selectionMask[index]) {
      continue;
    }

    const pixelIndex = index * 4;
    data[pixelIndex] = 255;
    data[pixelIndex + 1] = 59;
    data[pixelIndex + 2] = 92;
    data[pixelIndex + 3] = 112;
  }

  context.putImageData(overlay, 0, 0);
}

function floodFillMask(imageData: ImageData, startX: number, startY: number, tolerance: number) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const seedIndex = (startY * width) + startX;
  const queue = [seedIndex];
  const baseOffset = seedIndex * 4;
  const seedRed = data[baseOffset];
  const seedGreen = data[baseOffset + 1];
  const seedBlue = data[baseOffset + 2];
  const seedAlpha = data[baseOffset + 3];
  const threshold = tolerance * tolerance;

  while (queue.length > 0) {
    const index = queue.pop();
    if (index == null || visited[index]) {
      continue;
    }

    visited[index] = 1;
    const x = index % width;
    const y = Math.floor(index / width);
    const pixelOffset = index * 4;
    const delta =
      ((data[pixelOffset] - seedRed) ** 2) +
      ((data[pixelOffset + 1] - seedGreen) ** 2) +
      ((data[pixelOffset + 2] - seedBlue) ** 2) +
      (((data[pixelOffset + 3] - seedAlpha) / 2) ** 2);

    if (delta > threshold) {
      continue;
    }

    mask[index] = 1;

    if (x > 0) {
      queue.push(index - 1);
    }
    if (x < width - 1) {
      queue.push(index + 1);
    }
    if (y > 0) {
      queue.push(index - width);
    }
    if (y < height - 1) {
      queue.push(index + width);
    }
  }

  return mask;
}

async function loadImageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to load this image for editing."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToPngFile(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("Unable to prepare the edited image."));
        return;
      }

      resolve(nextBlob);
    }, "image/png");
  });

  return new File([blob], filename, { type: blob.type || "image/png" });
}

function cropFilename(filename: string, suffix: string) {
  const extIndex = filename.lastIndexOf(".");
  if (extIndex === -1) {
    return `${filename}-${suffix}.png`;
  }

  return `${filename.slice(0, extIndex)}-${suffix}.png`;
}
