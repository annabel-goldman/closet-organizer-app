import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen } from "lucide-react";
import {
  generateMagazineMetadataSuggestions,
  type Outfit,
  type OutfitFolder,
} from "../lib/closet";
import { Checkbox } from "./ui/checkbox";
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

  useEffect(() => {
    if (!open) return;

    setDraft(folder ? {
      name: folder.name,
      notes: folder.notes ?? "",
      outfitIds: folder.outfit_ids,
    } : EMPTY_DRAFT);
    setIsAutofilling(false);
    setAutofillMessage(null);
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
            <div className="grid max-h-56 gap-2 overflow-y-auto border border-border p-3 sm:grid-cols-2">
              {outfits.map((outfit) => {
                const checked = draft.outfitIds.includes(outfit.id);
                return (
                  <label key={outfit.id} className="flex cursor-pointer items-center gap-3 border border-border/70 p-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleOutfit(outfit.id, value === true)}
                    />
                    <span className="min-w-0">
                      <PrimitiveText as="span" variant="bodySm" className="block truncate">{outfit.name}</PrimitiveText>
                      <PrimitiveText as="span" variant="caption" tone="muted">{outfit.items.length} pieces</PrimitiveText>
                    </span>
                  </label>
                );
              })}
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
