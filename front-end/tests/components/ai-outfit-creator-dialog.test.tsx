import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiOutfitCreatorDialog } from "../../src/app/components/AiOutfitCreatorDialog";
import * as closet from "../../src/app/lib/closet";

const item: closet.ClothingItem = {
  id: 4,
  user_id: 1,
  name: "Burgundy Cardigan",
  category: "top",
  size: "na",
  date: null,
  tags: ["burgundy", "fall"],
  image_url: "/burgundy-cardigan.png",
};

const results: closet.OutfitRecommendationResponse = {
  id: 22,
  status: "succeeded",
  prompt: "Early-2000s fall apple picking look",
  constraints: {},
  brief: {
    summary: "A warm early-2000s orchard look.",
    structure: "separates",
    required_categories: ["top", "bottom", "shoes"],
    optional_categories: [],
    preferred_colors: ["burgundy", "brown"],
    excluded_colors: [],
    style_terms: ["y2k"],
    material_terms: [],
    seasons: ["fall"],
    formality: 2,
  },
  models: { planner: "test/brief", embedding: "test/embedding" },
  recommendations: [{
    id: 101,
    title: "Orchard Walk",
    summary: "A warm early-2000s orchard look.",
    item_ids: [4],
    items: [item],
    score: 0.92,
    reasons: ["Matches the burgundy and brown palette"],
  }],
};

afterEach(cleanup);

describe("AiOutfitCreatorDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(closet, "fetchWardrobeAnalysisStatus").mockResolvedValue({
      total: 12,
      ready: 12,
      pending: 0,
      processing: 0,
      failed: 0,
      stale: 0,
      missing_image: 0,
      enriched: 12,
      enrichment_pending: 0,
      enrichment_processing: 0,
      enrichment_failed: 0,
      complete: true,
      workflow: null,
    });
  });

  it("generates options and preserves a kept piece when trying again", async () => {
    const generate = vi.spyOn(closet, "generateOutfitRecommendations").mockResolvedValue(results);
    vi.spyOn(closet, "recordOutfitRecommendationFeedback").mockResolvedValue({ id: 1, event_type: "keep" });

    render(
      <AiOutfitCreatorDialog
        open
        onOpenChange={vi.fn()}
        onOutfitCreated={vi.fn()}
        onGenerationTaskStarted={vi.fn()}
        userId={1}
      />,
    );

    fireEvent.change(screen.getByLabelText("What do you want to wear?"), {
      target: { value: "Early-2000s fall apple picking look" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Create three looks" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Create three looks" }));

    expect(await screen.findByText("Orchard Walk")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep Burgundy Cardigan" }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(generate).toHaveBeenLastCalledWith({
        prompt: "Early-2000s fall apple picking look",
        lockedItemIds: [4],
        excludedItemIds: [],
        parentRunId: 22,
      });
    });
  });

  it("shows the visual enrichment count during one-time closet setup", async () => {
    vi.mocked(closet.fetchWardrobeAnalysisStatus).mockResolvedValue({
      total: 625,
      ready: 625,
      pending: 0,
      processing: 0,
      failed: 0,
      stale: 0,
      missing_image: 0,
      enriched: 0,
      enrichment_pending: 625,
      enrichment_processing: 0,
      enrichment_failed: 0,
      complete: false,
      workflow: null,
    });

    render(
      <AiOutfitCreatorDialog
        open
        onOpenChange={vi.fn()}
        onOutfitCreated={vi.fn()}
        onGenerationTaskStarted={vi.fn()}
        userId={1}
      />,
    );

    expect(await screen.findByText(/625 items need a one-time analysis/)).toBeInTheDocument();
  });
});
