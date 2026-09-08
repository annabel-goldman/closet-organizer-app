import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateItemImageMode } from "../../src/app/components/create-item/CreateItemImageMode";
import type { ClothingItemFormValues, OutfitDetection, User } from "../../src/app/lib/closet";

afterEach(cleanup);

const user: User = {
  admin: false,
  clothing_items: [],
  clothing_items_count: 0,
  id: 1,
  username: "annie",
};

const draft: ClothingItemFormValues = {
  brand: "",
  category: "shirt",
  date: "",
  name: "Blue Shirt",
  size: "medium",
  tags: "blue, shirt",
  visualDescription: "",
};

const detection: OutfitDetection = {
  bounding_box: { height: 0.5, width: 0.5, x: 0.1, y: 0.1 },
  category: "shirt",
  confidence: 0.9,
  details: {},
  generated_image_url: "/generated.png",
  id: 12,
  image_url: "/generated.png",
  outfit_upload_id: 4,
  position: 0,
  suggested_name: "Blue Shirt",
};

describe("CreateItemImageMode bulk image actions", () => {
  it("runs generation and background removal for the selected detections", async () => {
    const onGenerateSelectedImages = vi.fn();
    const onRemoveSelectedImageBackgrounds = vi.fn();
    const onToggleSelection = vi.fn();

    render(
      <CreateItemImageMode
        autofillingDetectionId={null}
        canRedoDetectionDraft={() => false}
        canUndoDetectionDraft={() => false}
        cleaningDetectionIds={[]}
        completedFileCount={1}
        detectionCleanErrors={{}}
        detections={[detection]}
        errorMessage=""
        getDetectionDraft={() => draft}
        getDetectionSourceImageUrl={() => "/source.png"}
        hasDetectionDraft={() => true}
        hasOutfitUploads
        inputRef={{ current: null }}
        isCreating={false}
        isDetecting={false}
        isPreparingDetectedMetadata={false}
        onBack={() => undefined}
        onDetectItems={() => undefined}
        onDraftChange={() => undefined}
        onFileChange={() => undefined}
        onGenerateSelectedImages={onGenerateSelectedImages}
        onRedoDetectionDraft={() => undefined}
        onRemoveSelectedImageBackgrounds={onRemoveSelectedImageBackgrounds}
        onRemoveSourceImage={() => undefined}
        onReplaceSourceImage={() => undefined}
        onRequestDetectionAutofill={() => undefined}
        onSaveSelectedItems={() => undefined}
        onSelectSourceImage={() => undefined}
        onToggleSelection={onToggleSelection}
        onUndoDetectionDraft={() => undefined}
        selectedCount={1}
        selectedDetectionIds={[detection.id]}
        selectedFileCount={1}
        selectedFileName="closet.jpg"
        selectedSourceIndex={0}
        sourceImageUrl="/source.png"
        sourceImages={[{ id: "source", imageUrl: "/source.png", label: "closet.jpg" }]}
        user={user}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show source photo 1: closet.jpg" }));

    const generateButton = await screen.findByRole("button", { name: "Generate selected with AI" });
    const removeButton = screen.getByRole("button", { name: "Remove backgrounds" });
    expect(screen.getByText("1 of 1 item selected")).toBeInTheDocument();
    const removeFromSaveButton = screen.getByRole("button", { name: "Remove Blue Shirt from items to save" });
    expect(removeButton).toBeEnabled();

    fireEvent.click(removeFromSaveButton);
    fireEvent.click(generateButton);
    fireEvent.click(removeButton);

    expect(onToggleSelection).toHaveBeenCalledWith(detection);
    expect(onGenerateSelectedImages).toHaveBeenCalledOnce();
    expect(onRemoveSelectedImageBackgrounds).toHaveBeenCalledOnce();
  });

  it("lets users select every detected item from the persistent toolbar", async () => {
    const onToggleSelection = vi.fn();

    render(
      <CreateItemImageMode
        autofillingDetectionId={null}
        canRedoDetectionDraft={() => false}
        canUndoDetectionDraft={() => false}
        cleaningDetectionIds={[]}
        completedFileCount={1}
        detectionCleanErrors={{}}
        detections={[detection]}
        errorMessage=""
        getDetectionDraft={() => draft}
        getDetectionSourceImageUrl={() => "/source.png"}
        hasDetectionDraft={() => true}
        hasOutfitUploads
        inputRef={{ current: null }}
        isCreating={false}
        isDetecting={false}
        isPreparingDetectedMetadata={false}
        onBack={() => undefined}
        onDetectItems={() => undefined}
        onDraftChange={() => undefined}
        onFileChange={() => undefined}
        onGenerateSelectedImages={() => undefined}
        onRedoDetectionDraft={() => undefined}
        onRemoveSelectedImageBackgrounds={() => undefined}
        onRemoveSourceImage={() => undefined}
        onReplaceSourceImage={() => undefined}
        onRequestDetectionAutofill={() => undefined}
        onSaveSelectedItems={() => undefined}
        onSelectSourceImage={() => undefined}
        onToggleSelection={onToggleSelection}
        onUndoDetectionDraft={() => undefined}
        selectedCount={0}
        selectedDetectionIds={[]}
        selectedFileCount={1}
        selectedFileName="closet.jpg"
        selectedSourceIndex={0}
        sourceImageUrl="/source.png"
        sourceImages={[{ id: "source", imageUrl: "/source.png", label: "closet.jpg" }]}
        user={user}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Select all" }));

    expect(onToggleSelection).toHaveBeenCalledWith(detection);
  });
});
