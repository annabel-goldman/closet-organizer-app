import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreateItemPage } from "../../src/app/components/CreateItemPage";
import type { User } from "../../src/app/lib/closet";

const user: User = {
  admin: false,
  clothing_items: [],
  clothing_items_count: 0,
  id: 1,
  username: "annie",
};

describe("CreateItemPage multi-photo source editing", () => {
  it("focuses and replaces one source without removing the rest of the batch", async () => {
    const { container } = render(
      <CreateItemPage
        initialMode="image"
        initialUser={user}
        onBack={() => undefined}
        onGenerationTaskStarted={() => undefined}
        onItemsCreated={() => undefined}
        userId={user.id}
      />,
    );
    const batchInput = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    expect(batchInput).not.toBeNull();

    const front = new File(["front"], "front.jpg", { type: "image/jpeg" });
    const back = new File(["back"], "back.jpg", { type: "image/jpeg" });
    fireEvent.change(batchInput!, { target: { files: [front, back] } });

    const secondSource = await screen.findByRole("button", {
      name: "Show source photo 2: back.jpg",
    });
    fireEvent.click(secondSource);
    expect(await screen.findByAltText("back.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit image" })).toBeEnabled();

    const replacementInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]:not([multiple])',
    );
    expect(replacementInput).not.toBeNull();
    const replacement = new File(["replacement"], "back-new.jpg", { type: "image/jpeg" });
    fireEvent.change(replacementInput!, { target: { files: [replacement] } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show source photo 1: front.jpg" }))
        .toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show source photo 2: back-new.jpg" }))
        .toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit image" }));
    expect(await screen.findByText("Crop Ratio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear image" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show source photo 1: front.jpg" }))
        .toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show source photo 2: back-new.jpg" }))
        .not.toBeInTheDocument();
    });
  });
});
