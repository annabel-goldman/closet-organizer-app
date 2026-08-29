import { FormEvent, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, Search } from "lucide-react";

import {
  generateMagazineMetadataSuggestions,
  type Outfit,
  type OutfitFolder,
} from "../lib/closet";
import { matchesOutfitSearchQuery } from "../lib/closetFilters";
import { resolveModeledWorkflowImageUrl } from "../lib/modeledPreview";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { OutfitCollageCanvas } from "./OutfitCollageCanvas";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export interface MagazineDraft {
  name: string;
  notes: string;
  outfitIds: number[];
}

interface MagazineEditorFormProps {
  folder?: OutfitFolder | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (draft: MagazineDraft) => void;
  outfits: Outfit[];
}

interface AutofillMessage {
  kind: "error" | "success";
  text: string;
}

function initialDraft(folder?: OutfitFolder | null): MagazineDraft {
  return folder ? {
    name: folder.name,
    notes: folder.notes ?? "",
    outfitIds: folder.outfit_ids,
  } : {
    name: "",
    notes: "",
    outfitIds: [],
  };
}

export function MagazineEditorForm({
  folder,
  isSaving,
  onCancel,
  onSave,
  outfits,
}: MagazineEditorFormProps) {
  const [draft, setDraft] = useState<MagazineDraft>(() => initialDraft(folder));
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState<AutofillMessage | null>(null);
  const [outfitSearchQuery, setOutfitSearchQuery] = useState("");

  async function handleAutofill() {
    setIsAutofilling(true);
    setAutofillMessage(null);

    try {
      const suggestion = await generateMagazineMetadataSuggestions({
        folderId: folder?.id,
        name: draft.name,
        notes: draft.notes,
        outfitIds: draft.outfitIds,
      });
      setDraft((current) => ({
        ...current,
        name: suggestion.name,
        notes: suggestion.notes,
        outfitIds: suggestion.outfit_ids,
      }));
      setAutofillMessage({
        kind: "success",
        text: "Magazine concept and outfit selection filled in. Review everything before saving.",
      });
    } catch (error) {
      setAutofillMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to fill magazine details.",
      });
    } finally {
      setIsAutofilling(false);
    }
  }

  function toggleOutfit(outfitId: number, checked: boolean) {
    setDraft((current) => ({
      ...current,
      outfitIds: checked
        ? [...current.outfitIds, outfitId]
        : current.outfitIds.filter((id) => id !== outfitId),
    }));
  }

  function moveOutfit(outfitId: number, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.outfitIds.indexOf(outfitId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.outfitIds.length) return current;

      const outfitIds = [...current.outfitIds];
      [outfitIds[index], outfitIds[nextIndex]] = [outfitIds[nextIndex], outfitIds[index]];
      return { ...current, outfitIds };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAutofilling || !draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
  }

  const selectedOutfits = draft.outfitIds
    .map((outfitId) => outfits.find((outfit) => outfit.id === outfitId))
    .filter((outfit): outfit is Outfit => Boolean(outfit));
  const filteredOutfits = outfits.filter((outfit) =>
    matchesOutfitSearchQuery(outfit, outfitSearchQuery));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <PrimitiveButton type="button" variant="outline" size="icon" onClick={onCancel} aria-label="Back to magazines">
            <ArrowLeft />
          </PrimitiveButton>
          <div className="min-w-0">
            <PrimitiveText as="p" variant="overline" tone="muted">Magazine workspace</PrimitiveText>
            <PrimitiveText as="h1" variant="display" font="serif" className="mt-1 break-words text-4xl sm:text-5xl">
              {folder ? `Edit ${folder.name}` : "Create magazine"}
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted" className="mt-2 max-w-2xl">
              Shape the concept, choose the looks, and arrange the page order in one full-page workspace.
            </PrimitiveText>
          </div>
        </div>

        <AiMetadataAutofillButton
          label="AI fill magazine details and outfits"
          isLoading={isAutofilling}
          disabled={isSaving || outfits.length === 0}
          onClick={() => void handleAutofill()}
          className="h-10 w-10 p-0"
        />
      </header>

      {autofillMessage ? (
        <div
          className={`mb-6 border px-4 py-3 ${
            autofillMessage.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          }`}
          role={autofillMessage.kind === "error" ? "alert" : "status"}
          aria-live={autofillMessage.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <PrimitiveText as="p" variant="caption">{autofillMessage.text}</PrimitiveText>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(17rem,0.68fr)_minmax(0,1.32fr)]">
          <div className="space-y-6 border border-border bg-card p-5 lg:sticky lg:top-6">
            <PrimitiveText as="h2" variant="title" font="serif">Magazine details</PrimitiveText>

            <label className="block space-y-2">
              <PrimitiveText as="span" variant="bodySm" tone="muted">Magazine name</PrimitiveText>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Paris weekend"
                maxLength={120}
                required
              />
            </label>

            <label className="block space-y-2">
              <PrimitiveText as="span" variant="bodySm" tone="muted">Notes</PrimitiveText>
              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="The mood, itinerary, packing notes, or story for this collection"
                maxLength={2000}
                className="min-h-40"
              />
            </label>

            <div className="border-t border-border pt-4">
              <PrimitiveText as="p" variant="bodySm">
                {draft.outfitIds.length} {draft.outfitIds.length === 1 ? "outfit" : "outfits"} selected
              </PrimitiveText>
            </div>
          </div>

          <div className="space-y-8">
            <section className="space-y-3" aria-labelledby="choose-outfits-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <PrimitiveText id="choose-outfits-heading" as="h2" variant="title" font="serif">Choose outfits</PrimitiveText>
                  <PrimitiveText as="p" variant="bodySm" tone="muted" className="mt-1">
                    Modeled previews appear first, with flat lays used when no model is available.
                  </PrimitiveText>
                </div>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={outfitSearchQuery}
                  onChange={(event) => setOutfitSearchQuery(event.target.value)}
                  placeholder="Search outfits"
                  aria-label="Search outfits"
                  className="h-11 pl-9"
                />
              </div>

              <div className="grid max-h-[46rem] grid-cols-2 gap-3 overflow-y-auto border border-border p-3 sm:grid-cols-3">
                {filteredOutfits.map((outfit) => {
                  const checked = draft.outfitIds.includes(outfit.id);
                  return (
                    <PrimitiveButton
                      key={outfit.id}
                      type="button"
                      variant="outline"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Select ${outfit.name}`}
                      onClick={() => toggleOutfit(outfit.id, !checked)}
                      className={`relative h-auto w-full flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal p-0 text-left ${
                        checked ? "border-foreground" : "border-border"
                      }`}
                    >
                      <span className="relative block bg-white">
                        <OutfitPickerPreview outfit={outfit} />
                        <span className="absolute right-2 top-2 flex size-8 items-center justify-center bg-white shadow-sm">
                          <span className={`flex size-4 items-center justify-center rounded-[4px] border ${
                            checked ? "border-foreground bg-foreground text-background" : "border-input bg-background"
                          }`} aria-hidden="true">
                            {checked ? <Check className="size-3" /> : null}
                          </span>
                        </span>
                      </span>
                      <span className="block min-w-0 border-t border-border px-3 py-2.5">
                        <PrimitiveText as="span" variant="bodySm" className="block truncate">{outfit.name}</PrimitiveText>
                        <PrimitiveText as="span" variant="caption" tone="muted">{outfit.items.length} pieces</PrimitiveText>
                      </span>
                    </PrimitiveButton>
                  );
                })}
                {filteredOutfits.length === 0 ? (
                  <div className="col-span-full px-4 py-10 text-center">
                    <PrimitiveText as="p" variant="bodySm" tone="muted">
                      No outfits match “{outfitSearchQuery.trim()}”.
                    </PrimitiveText>
                  </div>
                ) : null}
              </div>
            </section>

            {selectedOutfits.length > 1 ? (
              <section className="space-y-3" aria-labelledby="magazine-order-heading">
                <PrimitiveText id="magazine-order-heading" as="h2" variant="title" font="serif">Magazine order</PrimitiveText>
                <div className="space-y-2">
                  {selectedOutfits.map((outfit, index) => (
                    <div key={outfit.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2">
                      <PrimitiveText as="span" variant="bodySm" className="min-w-0 truncate">
                        {index + 1}. {outfit.name}
                      </PrimitiveText>
                      <div className="flex gap-1">
                        <PrimitiveButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => moveOutfit(outfit.id, -1)}
                          aria-label={`Move ${outfit.name} earlier`}
                        ><ArrowUp /></PrimitiveButton>
                        <PrimitiveButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === selectedOutfits.length - 1}
                          onClick={() => moveOutfit(outfit.id, 1)}
                          aria-label={`Move ${outfit.name} later`}
                        ><ArrowDown /></PrimitiveButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-3 border-t border-border bg-background/95 py-4 backdrop-blur">
          <PrimitiveButton type="button" variant="outline" onClick={onCancel}>Cancel</PrimitiveButton>
          <PrimitiveButton type="submit" disabled={isSaving || isAutofilling || !draft.name.trim()}>
            <BookOpen />
            {isSaving ? "Saving…" : folder ? "Save magazine" : "Create magazine"}
          </PrimitiveButton>
        </div>
      </form>
    </div>
  );
}

function OutfitPickerPreview({ outfit }: { outfit: Outfit }) {
  const modeledImageUrl = resolveModeledWorkflowImageUrl(outfit.modeled_workflow);

  if (modeledImageUrl) {
    return (
      <div className="aspect-[4/5] w-full overflow-hidden bg-white">
        <img
          src={modeledImageUrl}
          alt={`Modeled version of ${outfit.name}`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <OutfitCollageCanvas
      items={outfit.items}
      maxVisibleItems={6}
      className="w-full"
    />
  );
}
