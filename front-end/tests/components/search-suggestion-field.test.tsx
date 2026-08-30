import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchSuggestionField } from "../../src/app/components/SearchSuggestionField";

afterEach(cleanup);

interface Suggestion {
  id: number;
  name: string;
}

function SearchHarness({
  onOpenSuggestion,
  onSelectSuggestion,
}: {
  onOpenSuggestion: (suggestion: Suggestion) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <SearchSuggestionField
      id="shared-search"
      value={value}
      onChange={setValue}
      suggestions={[{ id: 1, name: "Gold Evening Look" }]}
      getSuggestionKey={(suggestion) => suggestion.id}
      getSuggestionLabel={(suggestion) => suggestion.name}
      onOpenSuggestion={onOpenSuggestion}
      onSelectSuggestion={(suggestion) => {
        setValue(suggestion.name);
        onSelectSuggestion(suggestion);
      }}
      placeholder="Search"
    />
  );
}

describe("SearchSuggestionField", () => {
  it("uses one plain input and shares keyboard and pointer suggestion behavior", async () => {
    const onOpenSuggestion = vi.fn();
    const onSelectSuggestion = vi.fn();
    render(
      <SearchHarness
        onOpenSuggestion={onOpenSuggestion}
        onSelectSuggestion={onSelectSuggestion}
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input).not.toHaveAttribute("type", "search");
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "gold" } });
    expect(await screen.findByText("Gold Evening Look")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenSuggestion).toHaveBeenCalledWith({ id: 1, name: "Gold Evening Look" });

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "gold" } });
    const suggestion = await screen.findByText("Gold Evening Look");
    fireEvent.mouseDown(suggestion);
    await waitFor(() => {
      expect(onSelectSuggestion).toHaveBeenCalledWith({ id: 1, name: "Gold Evening Look" });
      expect(input).toHaveValue("Gold Evening Look");
    });
  });
});
