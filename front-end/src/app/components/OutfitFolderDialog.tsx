import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen } from "lucide-react";
import type { Outfit, OutfitFolder } from "../lib/closet";
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
import type { OutfitFolderDraft } from "./outfits/useOutfitMagazines";

interface OutfitFolderDialogProps {
  folder?: OutfitFolder | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: OutfitFolderDraft) => void;
  open: boolean;
  outfits: Outfit[];
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

  useEffect(() => {
    if (!open) return;

    setDraft(folder ? {
      name: folder.name,
      notes: folder.notes ?? "",
      outfitIds: folder.outfit_ids,
    } : EMPTY_DRAFT);
  }, [folder, open]);

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
    if (!draft.name.trim()) return;
    onSave({ ...draft, name: draft.name.trim() });
  }

  const selectedOutfits = draft.outfitIds
    .map((outfitId) => outfits.find((outfit) => outfit.id === outfitId))
    .filter((outfit): outfit is Outfit => Boolean(outfit));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-3xl">
        <DialogHeader>
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
            <PrimitiveButton type="submit" disabled={isSaving || !draft.name.trim()}>
              <BookOpen />
              {isSaving ? "Saving…" : folder ? "Save magazine" : "Create magazine"}
            </PrimitiveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
