import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Pencil, Shirt, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  ClothingItem,
  destroyOutfit,
  generateOutfit,
  OutfitDraft,
  Outfit,
  parseTagInput,
  updateOutfit,
  User,
} from "../lib/closet";
import { OutfitCollageCanvas } from "./OutfitCollageCanvas";
import { OutfitCollageLayersPanel } from "./OutfitCollageLayersPanel";
import {
  OutfitCollageLayout,
  reorderCollageLayers,
  resolveOutfitCollageLayouts,
} from "../lib/outfitCollage";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { MAX_OUTFIT_NAME, MAX_OUTFIT_NOTES } from "../lib/inputLengthPolicy";

interface MyOutfitsPageProps {
  isLoading: boolean;
  loadErrorMessage: string;
  onOutfitDeleted: (outfitId: number) => void;
  onOutfitGenerated: (outfit: Outfit) => void;
  onOutfitUpdated: (outfit: Outfit) => void;
  outfits: Outfit[];
  user: User;
}

interface FlashState {
  kind: "success" | "error";
  message: string;
}

function outfitToFormState(outfit: Outfit): OutfitDraft {
  return {
    name: outfit.name,
    notes: outfit.notes ?? "",
    tagInput: outfit.tags?.join(", ") ?? "",
    itemIds: outfit.item_ids ?? outfit.items.map((item) => item.id),
  };
}

export function MyOutfitsPage({
  isLoading,
  loadErrorMessage,
  onOutfitDeleted,
  onOutfitGenerated,
  onOutfitUpdated,
  outfits,
  user,
}: MyOutfitsPageProps) {
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [editingOutfitId, setEditingOutfitId] = useState<number | null>(null);
  const [formState, setFormState] = useState<OutfitDraft>({
    name: "",
    notes: "",
    tagInput: "",
    itemIds: [],
  });
  const [editorLayouts, setEditorLayouts] = useState<Record<number, OutfitCollageLayout>>({});
  const [selectedCollageItemId, setSelectedCollageItemId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generationOccasion, setGenerationOccasion] = useState("");
  const [generationReferencePhoto, setGenerationReferencePhoto] = useState<File | null>(null);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);

  const sortedItems = useMemo(
    () => [...user.clothing_items].sort((left, right) => left.name.localeCompare(right.name)),
    [user.clothing_items],
  );
  const itemById = useMemo(
    () => new Map(sortedItems.map((item) => [item.id, item])),
    [sortedItems],
  );
  const selectedItems = useMemo(() => {
    return formState.itemIds
      .map((id) => itemById.get(id))
      .filter((item): item is ClothingItem => Boolean(item));
  }, [formState.itemIds, itemById]);
  const availableItems = useMemo(
    () => sortedItems.filter((item) => !formState.itemIds.includes(item.id)),
    [formState.itemIds, sortedItems],
  );
  const editingOutfit = editingOutfitId
    ? outfits.find((outfit) => outfit.id === editingOutfitId) ?? null
    : null;

  function showFlash(kind: FlashState["kind"], message: string) {
    setFlash({ kind, message });
  }

  function setFormField<Key extends keyof OutfitDraft>(key: Key, value: OutfitDraft[Key]) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resolveItemsById(itemIds: number[]) {
    return itemIds
      .map((itemId) => itemById.get(itemId))
      .filter((item): item is ClothingItem => Boolean(item));
  }

  function syncEditorLayouts(itemIds: number[]) {
    const nextItems = resolveItemsById(itemIds);
    setEditorLayouts((current) => resolveOutfitCollageLayouts(nextItems, current));
  }

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlash(null);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [flash]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      showFlash("error", "Please add an outfit name.");
      return;
    }

    if (formState.itemIds.length === 0) {
      showFlash("error", "Add at least one item to build an outfit.");
      return;
    }

    const tags = parseTagInput(formState.tagInput);

    setIsSaving(true);

    try {
      if (!editingOutfitId) {
        showFlash("error", "Create new outfits from the closet cart.");
        return;
      }

      const updatedOutfit = await updateOutfit({
        id: editingOutfitId,
        name: trimmedName,
        itemIds: formState.itemIds,
        itemLayouts: formState.itemIds.map((itemId) => ({
          item_id: itemId,
          ...editorLayouts[itemId],
        })),
        notes: formState.notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      onOutfitUpdated(updatedOutfit);
      showFlash("success", "Outfit updated.");

      resetForm();
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to save outfit.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(outfitId: number) {
    try {
      await destroyOutfit(outfitId);
      onOutfitDeleted(outfitId);
      showFlash("success", "Outfit deleted.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to delete outfit.");
    }
  }

  async function handleGenerateOutfit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsGeneratingOutfit(true);
    setFlash(null);

    try {
      const generatedOutfit = await generateOutfit({
        occasion: generationOccasion,
        referencePhoto: generationReferencePhoto,
      });

      onOutfitGenerated(generatedOutfit);
      setGenerationOccasion("");
      setGenerationReferencePhoto(null);
      setIsGenerateDialogOpen(false);
      startEditing(generatedOutfit);
      showFlash("success", "AI outfit generated.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to generate an outfit.");
    } finally {
      setIsGeneratingOutfit(false);
    }
  }

  function startEditing(outfit: Outfit) {
    setEditingOutfitId(outfit.id);
    setFormState(outfitToFormState(outfit));
    const nextLayouts = resolveOutfitCollageLayouts(outfit.items);
    setEditorLayouts(nextLayouts);
    setSelectedCollageItemId(outfit.items[0]?.id ?? null);
    setFlash(null);
  }

  function resetForm() {
    setEditingOutfitId(null);
    setFormState({
      name: "",
      notes: "",
      tagInput: "",
      itemIds: [],
    });
    setEditorLayouts({});
    setSelectedCollageItemId(null);
  }

  function closeGenerateDialog() {
    if (isGeneratingOutfit) {
      return;
    }

    setIsGenerateDialogOpen(false);
    setGenerationOccasion("");
    setGenerationReferencePhoto(null);
  }

  function addItemToEditingOutfit(itemId: number) {
    setFormState((current) => {
      if (current.itemIds.includes(itemId)) {
        return current;
      }

      const nextItemIds = [...current.itemIds, itemId];
      syncEditorLayouts(nextItemIds);
      setSelectedCollageItemId(itemId);
      return {
        ...current,
        itemIds: nextItemIds,
      };
    });
  }

  function removeItemFromEditingOutfit(itemId: number) {
    setFormState((current) => {
      const nextItemIds = current.itemIds.filter((id) => id !== itemId);
      syncEditorLayouts(nextItemIds);
      setEditorLayouts((currentLayouts) => {
        const nextLayouts = { ...currentLayouts };
        delete nextLayouts[itemId];
        return nextLayouts;
      });
      setSelectedCollageItemId((currentSelectedId) => (
        currentSelectedId === itemId ? nextItemIds[0] ?? null : currentSelectedId
      ));
      return {
        ...current,
        itemIds: nextItemIds,
      };
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
            My Outfits
          </PrimitiveText>
          <PrimitiveText as="h1" variant="display" font="serif" className="mb-2">
            Lookbook Builder
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            Group your closet pieces into reusable outfit combos.
          </PrimitiveText>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <PrimitiveButton
            type="button"
            variant="outline"
            className="h-auto px-5 py-3"
            onClick={() => setIsGenerateDialogOpen(true)}
            disabled={isLoading || isGeneratingOutfit || user.clothing_items.length === 0}
          >
            <Sparkles className="h-4 w-4" />
            {isGeneratingOutfit ? "Generating..." : "AI Outfit"}
          </PrimitiveButton>
          <PrimitiveText as="p" variant="bodySm" tone="muted">
            {outfits.length} {outfits.length === 1 ? "outfit" : "outfits"} saved
          </PrimitiveText>
        </div>
      </div>

      <section className="space-y-4">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="animate-pulse border border-border p-6 space-y-4">
                <div className="h-8 bg-muted w-1/2" />
                <div className="h-4 bg-muted w-full" />
                <div className="h-24 bg-muted" />
              </div>
            ))}
          </div>
        ) : loadErrorMessage ? (
          <div className="border border-destructive/20 bg-destructive/5 p-8">
            <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
              Outfits could not be loaded.
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              {loadErrorMessage}
            </PrimitiveText>
          </div>
        ) : outfits.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              No outfits yet
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Create your first look from the closet cart and it will appear here.
            </PrimitiveText>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {outfits.map((outfit, index) => (
              <motion.article
                key={outfit.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className="mx-auto w-full max-w-[22rem] overflow-hidden border border-border bg-card"
              >
                <div className="px-5 pt-5">
                  <OutfitCollageCanvas
                    items={outfit.items}
                    maxVisibleItems={6}
                    className="mx-auto w-full max-w-[15.5rem]"
                  />
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
                        Saved Look
                      </PrimitiveText>
                      {outfit.generated_by_ai ? (
                        <PrimitiveText
                          as="p"
                          variant="caption"
                          tone="muted"
                          className="mb-2 inline-flex items-center gap-1 uppercase tracking-[0.18em]"
                        >
                          <Sparkles className="h-3 w-3" />
                          AI generated
                        </PrimitiveText>
                      ) : null}
                      <PrimitiveText as="h3" variant="display" font="serif" className="break-words">
                        {outfit.name}
                      </PrimitiveText>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <PrimitiveText as="p" variant="bodySm" tone="muted">
                          <Shirt className="mr-1 inline h-3 w-3" />
                          {outfit.items.length} {outfit.items.length === 1 ? "piece" : "pieces"}
                        </PrimitiveText>
                        {outfit.tags && outfit.tags.length > 0 ? (
                          <PrimitiveText as="p" variant="bodySm" tone="muted">
                            {outfit.tags.join(" · ")}
                          </PrimitiveText>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <PrimitiveButton
                        onClick={() => startEditing(outfit)}
                        variant="outline"
                        size="icon"
                        aria-label="Edit outfit"
                      >
                        <Pencil className="h-4 w-4" />
                      </PrimitiveButton>
                      <PrimitiveButton
                        onClick={() => void handleDelete(outfit.id)}
                        variant="outline"
                        size="icon"
                        className="hover:border-destructive"
                        aria-label="Delete outfit"
                      >
                        <Trash2 className="h-4 w-4" />
                      </PrimitiveButton>
                    </div>
                  </div>

                  {outfit.notes ? (
                    <PrimitiveText as="p" variant="bodySm" tone="muted" className="line-clamp-3">
                      {outfit.notes}
                    </PrimitiveText>
                  ) : null}

                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {flash && !editingOutfitId && !isGenerateDialogOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 right-6 z-[70] max-w-sm border px-4 py-3 text-sm shadow-lg backdrop-blur ${
            flash.kind === "success"
              ? "border-foreground/20 bg-background/95 text-foreground"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          }`}
          role={flash.kind === "error" ? "alert" : "status"}
          aria-live={flash.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {flash.message}
        </motion.div>
      ) : null}

      <Dialog open={Boolean(editingOutfitId)} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-none border-border p-0 sm:w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] xl:max-w-[120rem] 2xl:max-w-[128rem]">
          <div className="max-h-[90vh] overflow-y-auto lg:grid lg:overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(28rem,0.95fr)] 2xl:grid-cols-[minmax(0,1.7fr)_minmax(32rem,0.9fr)]">
            <div className="min-h-[calc(100svh-8rem)] border-b border-border bg-stone-50 px-5 py-6 md:px-8 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-10">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <PrimitiveText as="p" variant="overline" tone="muted">
                  Outfit Preview
                </PrimitiveText>
                {editingOutfit ? (
                  <>
                    <div className="grid min-h-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[5.75rem_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <OutfitCollageLayersPanel
                          availableItems={availableItems}
                          items={selectedItems}
                          layouts={editorLayouts}
                          onAddItem={addItemToEditingOutfit}
                          onRemoveItem={removeItemFromEditingOutfit}
                          selectedItemId={selectedCollageItemId}
                          onSelectItem={setSelectedCollageItemId}
                          onReorder={(orderedItemIds) => {
                            setEditorLayouts((current) => reorderCollageLayers(current, orderedItemIds));
                            setFormState((current) => ({
                              ...current,
                              itemIds: orderedItemIds,
                            }));
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="mx-auto w-full max-w-[min(20rem,calc((100vh-20rem)*0.8))] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:max-w-[min(32rem,calc((100vh-22rem)*0.8))] lg:max-w-[min(72rem,calc((100vh-16rem)*0.8))]">
                        <OutfitCollageCanvas
                          items={selectedItems}
                          layouts={editorLayouts}
                          editable
                          selectedItemId={selectedCollageItemId}
                          onSelectItem={setSelectedCollageItemId}
                          onLayoutsChange={setEditorLayouts}
                          className="w-full"
                        />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="p-6 lg:overflow-y-auto lg:p-8 xl:p-10">
              <DialogHeader className="mb-6 text-left sm:text-left">
                <DialogTitle asChild>
                  <PrimitiveText as="h2" variant="display" font="serif">
                    Edit Outfit
                  </PrimitiveText>
                </DialogTitle>
                <DialogDescription asChild>
                  <PrimitiveText as="p" tone="muted">
                    {editingOutfit?.generated_by_ai
                      ? "Update the generated outfit details while keeping the current look in view."
                      : "Update the saved outfit details while keeping the current look in view."}
                  </PrimitiveText>
                </DialogDescription>
              </DialogHeader>

              {flash ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-5 border px-4 py-3 text-sm ${
                    flash.kind === "success"
                      ? "border-foreground/20 bg-background text-foreground"
                      : "border-destructive/25 bg-destructive/10 text-destructive"
                  }`}
                  role={flash.kind === "error" ? "alert" : "status"}
                  aria-live={flash.kind === "error" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {flash.message}
                </motion.div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block space-y-2">
                  <PrimitiveText as="span" variant="bodySm" tone="muted">
                    Title
                  </PrimitiveText>
                  <Input
                    value={formState.name}
                    onChange={(event) => setFormField("name", event.target.value)}
                    placeholder="Weekend Brunch"
                    maxLength={MAX_OUTFIT_NAME}
                  />
                </label>

                <label className="block space-y-2">
                  <PrimitiveText as="span" variant="bodySm" tone="muted">
                    Tags
                  </PrimitiveText>
                  <Input
                    value={formState.tagInput}
                    onChange={(event) => setFormField("tagInput", event.target.value)}
                    placeholder="casual, spring"
                  />
                </label>

                <label className="block space-y-2">
                  <PrimitiveText as="span" variant="bodySm" tone="muted">
                    Notes
                  </PrimitiveText>
                  <Textarea
                    value={formState.notes}
                    onChange={(event) => setFormField("notes", event.target.value)}
                    placeholder="When and where to wear this look"
                    className="min-h-32"
                    maxLength={MAX_OUTFIT_NOTES}
                  />
                </label>

                {selectedItems.length > 0 ? (
                  <div className="space-y-2">
                    <PrimitiveText as="p" variant="bodySm" tone="muted">
                      Included pieces
                    </PrimitiveText>
                    <div className="flex flex-wrap gap-2">
                      {selectedItems.map((item) => (
                        <div key={item.id} className="border border-border bg-card px-3 py-2">
                          <PrimitiveText as="span" variant="bodySm">
                            {item.name}
                          </PrimitiveText>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <DialogFooter className="pt-2 sm:justify-start">
                  <PrimitiveButton type="submit" disabled={isSaving} variant="outline">
                    Save Changes
                  </PrimitiveButton>
                  <PrimitiveButton type="button" onClick={resetForm} variant="outline">
                    Cancel
                  </PrimitiveButton>
                </DialogFooter>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGenerateDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsGenerateDialogOpen(true);
            return;
          }

          closeGenerateDialog();
        }}
      >
        <DialogContent className="rounded-none border-border sm:max-w-lg">
          <DialogHeader className="text-left sm:text-left">
            <DialogTitle asChild>
              <PrimitiveText as="h2" variant="display" font="serif">
                Generate Outfit
              </PrimitiveText>
            </DialogTitle>
            <DialogDescription asChild>
              <PrimitiveText as="p" tone="muted">
                Use closet types, tags, and visual descriptions to create a saved look.
              </PrimitiveText>
            </DialogDescription>
          </DialogHeader>

          {flash?.kind === "error" && !editingOutfitId ? (
            <div className="border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {flash.message}
            </div>
          ) : null}

          <form onSubmit={handleGenerateOutfit} className="space-y-5">
            <label className="block space-y-2">
              <PrimitiveText as="span" variant="bodySm" tone="muted">
                Occasion or vibe
              </PrimitiveText>
              <Textarea
                value={generationOccasion}
                onChange={(event) => setGenerationOccasion(event.target.value)}
                placeholder="Optional, e.g. coffee date, gallery opening, rainy commute"
                className="min-h-24"
                maxLength={240}
              />
            </label>

            <div className="space-y-2">
              <PrimitiveText as="span" variant="bodySm" tone="muted">
                Reference flatlay
              </PrimitiveText>
              <label className="flex cursor-pointer items-center justify-between gap-3 border border-dashed border-border bg-background px-4 py-3 text-sm transition-colors hover:bg-accent/40">
                <span className="flex min-w-0 items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {generationReferencePhoto ? generationReferencePhoto.name : "Upload flatlay photo"}
                  </span>
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={isGeneratingOutfit}
                  onChange={(event) => {
                    setGenerationReferencePhoto(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {generationReferencePhoto ? (
                <PrimitiveButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => setGenerationReferencePhoto(null)}
                  disabled={isGeneratingOutfit}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove reference
                </PrimitiveButton>
              ) : null}
            </div>

            <DialogFooter>
              <PrimitiveButton type="button" variant="outline" onClick={closeGenerateDialog} disabled={isGeneratingOutfit}>
                Cancel
              </PrimitiveButton>
              <PrimitiveButton type="submit" disabled={isGeneratingOutfit || user.clothing_items.length === 0}>
                <Sparkles className="h-4 w-4" />
                {isGeneratingOutfit ? "Generating..." : "Generate"}
              </PrimitiveButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
