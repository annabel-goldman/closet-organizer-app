import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, Search } from "lucide-react";
import {
  generateMagazineMetadataSuggestions,
  type Outfit,
  type OutfitFolder,
} from "../lib/closet";
import { matchesOutfitSearchQuery } from "../lib/closetFilters";
import { resolveModeledWorkflowImageUrl } from "../lib/modeledPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { OutfitCollageCanvas } from "./OutfitCollageCanvas";
import type { OutfitFolderDraft } from "./outfits/useOutfitMagazines";

interface OutfitFolderDialogProps {
  folder?: OutfitFolder | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: OutfitFolderDraft) => void;
  open: boolean;
  outfits: Outfit[];
}

interface AutofillMessage {
  kind: "error" | "success";
  text: string;
}

const EMPTY_DRAFT: OutfitFolderDraft = {
  name: "",
  notes: "",
  outfitIds: [],
};

export function OutfitFolderDialog({
  folder,
  isSaving,
  onOpenChange,
  onSave,
  open,
  outfits,
}: OutfitFolderDialogProps) {
  const [draft, setDraft] = useState<OutfitFolderDraft>(EMPTY_DRAFT);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState<AutofillMessage | null>(null);
  const [outfitSearchQuery, setOutfitSearchQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    setDraft(folder ? {
      name: folder.name,
      notes: folder.notes ?? "",
      outfitIds: folder.outfit_ids,
    } : EMPTY_DRAFT);
    setIsAutofilling(false);
    setAutofillMessage(null);
    setOutfitSearchQuery("");
  }, [folder, open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-3xl"
        headerActions={(
          <AiMetadataAutofillButton
            label="AI fill magazine details and outfits"
            isLoading={isAutofilling}
            disabled={isSaving || outfits.length === 0}
            onClick={() => void handleAutofill()}
            className="h-9 w-9 p-0"
          />
        )}
      >
        <DialogHeader className="pr-24">
          <DialogTitle asChild>
            <PrimitiveText as="h2" variant="display" font="serif">
              {folder ? "Edit magazine" : "Create magazine"}
            </PrimitiveText>
          </DialogTitle>
          <DialogDescription asChild>
            <PrimitiveText as="p" tone="muted">
              Group looks for a trip, occasion, season, or any story you want to turn into a magazine.
            </PrimitiveText>
          </DialogDescription>
        </DialogHeader>

        {autofillMessage ? (
          <div
            className={`border px-3 py-2 ${
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
              className="min-h-24"
            />
          </label>

          <div className="space-y-3">
            <PrimitiveText as="h3" variant="title" font="serif">Choose outfits</PrimitiveText>
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
                className="pl-9"
              />
            </div>
            <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-y-auto border border-border p-3 sm:grid-cols-3">
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
          </div>

          {selectedOutfits.length > 1 ? (
            <div className="space-y-3">
              <PrimitiveText as="h3" variant="title" font="serif">Magazine order</PrimitiveText>
              <div className="space-y-2">
                {selectedOutfits.map((outfit, index) => (
                  <div key={outfit.id} className="flex items-center justify-between border border-border px-3 py-2">
                    <PrimitiveText as="span" variant="bodySm">{index + 1}. {outfit.name}</PrimitiveText>
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
            </div>
          ) : null}

          <DialogFooter>
            <PrimitiveButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </PrimitiveButton>
            <PrimitiveButton type="submit" disabled={isSaving || isAutofilling || !draft.name.trim()}>
              <BookOpen />
              {isSaving ? "Saving…" : folder ? "Save magazine" : "Create magazine"}
            </PrimitiveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
