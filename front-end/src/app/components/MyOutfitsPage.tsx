import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Pencil, Plus, Shirt, Trash2, X } from "lucide-react";
import {
  buildPlaceholderLabel,
  ClothingItem,
  createOutfit,
  destroyOutfit,
  emptyOutfitDraft,
  fetchOutfits,
  formatTagLabel,
  OutfitDraft,
  Outfit,
  updateOutfit,
  User,
} from "../lib/closet";

interface MyOutfitsPageProps {
  user: User;
  draft: OutfitDraft;
  onDraftChange: (draft: OutfitDraft) => void;
  onBrowseCloset: () => void;
  onOpenItem: (itemId: number) => void;
}

interface FlashState {
  kind: "success" | "error";
  message: string;
}

export function MyOutfitsPage({
  user,
  draft,
  onDraftChange,
  onBrowseCloset,
  onOpenItem,
}: MyOutfitsPageProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [editingOutfitId, setEditingOutfitId] = useState<number | null>(null);

  const [name, setName] = useState(draft.name);
  const [notes, setNotes] = useState(draft.notes);
  const [tagInput, setTagInput] = useState(draft.tagInput);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>(draft.itemIds);
  const [isSaving, setIsSaving] = useState(false);
  const formSectionRef = useRef<HTMLElement | null>(null);

  const sortedItems = useMemo(
    () => [...user.clothing_items].sort((left, right) => left.name.localeCompare(right.name)),
    [user.clothing_items],
  );
  const selectedItems = useMemo(() => {
    const itemById = new Map(sortedItems.map((item) => [item.id, item]));
    return selectedItemIds
      .map((id) => itemById.get(id))
      .filter((item): item is ClothingItem => Boolean(item));
  }, [selectedItemIds, sortedItems]);

  function showFlash(kind: FlashState["kind"], message: string) {
    setFlash({ kind, message });
  }

  function updateCreateDraft(nextDraft: OutfitDraft) {
    setName(nextDraft.name);
    setNotes(nextDraft.notes);
    setTagInput(nextDraft.tagInput);
    setSelectedItemIds(nextDraft.itemIds);
    onDraftChange(nextDraft);
  }

  useEffect(() => {
    if (editingOutfitId) {
      return;
    }

    setName(draft.name);
    setNotes(draft.notes);
    setTagInput(draft.tagInput);
    setSelectedItemIds(draft.itemIds);
  }, [draft, editingOutfitId]);

  useEffect(() => {
    if (!flash) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setFlash(null);
    }, 2800);

    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOutfits() {
      setIsLoading(true);

      try {
        const nextOutfits = await fetchOutfits(controller.signal);
        setOutfits(nextOutfits);
      } catch (error) {
        if (!controller.signal.aborted) {
          showFlash("error", error instanceof Error ? error.message : "Unable to load outfits.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadOutfits();

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      showFlash("error", "Please add an outfit name.");
      return;
    }

    if (selectedItemIds.length === 0) {
      showFlash("error", "Add at least one item to build an outfit.");
      return;
    }

    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSaving(true);

    try {
      if (editingOutfitId) {
        const updatedOutfit = await updateOutfit({
          id: editingOutfitId,
          name: trimmedName,
          itemIds: selectedItemIds,
          notes: notes.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });

        setOutfits((current) =>
          current.map((outfit) => (outfit.id === updatedOutfit.id ? updatedOutfit : outfit)),
        );
        showFlash("success", "Outfit updated.");
      } else {
        const createdOutfit = await createOutfit({
          userId: user.id,
          name: trimmedName,
          itemIds: selectedItemIds,
          notes: notes.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });

        setOutfits((current) => [createdOutfit, ...current]);
        updateCreateDraft(emptyOutfitDraft());
        showFlash("success", "Outfit saved.");
      }

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
      setOutfits((current) => current.filter((outfit) => outfit.id !== outfitId));
      showFlash("success", "Outfit deleted.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to delete outfit.");
    }
  }

  function removeDraftItem(itemId: number) {
    if (editingOutfitId) {
      setSelectedItemIds((current) => current.filter((id) => id !== itemId));
      return;
    }

    updateCreateDraft({
      name,
      notes,
      tagInput,
      itemIds: selectedItemIds.filter((id) => id !== itemId),
    });
  }

  function removeEditingItem(itemId: number) {
    setSelectedItemIds((current) => current.filter((id) => id !== itemId));
  }

  function startEditing(outfit: Outfit) {
    setEditingOutfitId(outfit.id);
    setName(outfit.name);
    setNotes(outfit.notes ?? "");
    setTagInput(outfit.tags?.join(", ") ?? "");
    setSelectedItemIds(outfit.item_ids ?? outfit.items.map((item) => item.id));
    setFlash(null);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditingOutfitId(null);
    setName(draft.name);
    setNotes(draft.notes);
    setTagInput(draft.tagInput);
    setSelectedItemIds(draft.itemIds);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-3"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            My Outfits
          </p>
          <h1 className="mb-2">Lookbook Builder</h1>
          <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Group your closet pieces into reusable outfit combos.
          </p>
        </div>
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
          {outfits.length} {outfits.length === 1 ? "outfit" : "outfits"} saved
        </p>
      </div>

      <section ref={formSectionRef} className="border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Plus className="w-4 h-4" />
          <h2>{editingOutfitId ? "Edit Outfit" : "Create Outfit"}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                Name
              </span>
              <input
                value={name}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (editingOutfitId) {
                    setName(nextValue);
                    return;
                  }

                  updateCreateDraft({
                    name: nextValue,
                    notes,
                    tagInput,
                    itemIds: selectedItemIds,
                  });
                }}
                placeholder="Weekend Brunch"
                className="w-full border border-border bg-background px-3 py-2"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                Tags (comma separated)
              </span>
              <input
                value={tagInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (editingOutfitId) {
                    setTagInput(nextValue);
                    return;
                  }

                  updateCreateDraft({
                    name,
                    notes,
                    tagInput: nextValue,
                    itemIds: selectedItemIds,
                  });
                }}
                placeholder="casual, spring"
                className="w-full border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (editingOutfitId) {
                  setNotes(nextValue);
                  return;
                }

                updateCreateDraft({
                  name,
                  notes: nextValue,
                  tagInput,
                  itemIds: selectedItemIds,
                });
              }}
              placeholder="When and where to wear this look"
              className="w-full border border-border bg-background px-3 py-2 min-h-24"
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                Items in this outfit
              </p>
              <button
                type="button"
                onClick={onBrowseCloset}
                className="inline-flex items-center justify-center border border-border px-3 py-1.5 text-xs transition-colors hover:border-foreground"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                Add from closet
              </button>
            </div>

            {selectedItems.length === 0 ? (
              <div className="border border-dashed border-border p-4 text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                Use “Add to Outfit” on any closet item, then come back here to save.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="border border-border p-2 flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 border border-border bg-muted overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs" style={{ fontFamily: "Outfit, sans-serif" }}>
                          {buildPlaceholderLabel(item.name)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ fontFamily: "Outfit, sans-serif" }}>{item.name}</p>
                      <p className="text-xs text-muted-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {item.tags.length > 0 ? formatTagLabel(item.tags[0]) : "Unstyled"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (editingOutfitId) {
                          removeEditingItem(item.id);
                          return;
                        }

                        removeDraftItem(item.id);
                      }}
                      className="inline-flex items-center justify-center border border-border p-1.5 hover:border-foreground transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground disabled:opacity-50"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              {editingOutfitId ? "Save Changes" : "Save Outfit"}
            </button>

            {editingOutfitId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground"
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

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
        ) : outfits.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-2xl mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              No outfits yet
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Build your first look above and it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {outfits.map((outfit, index) => (
              <motion.article
                key={outfit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="border border-border bg-card p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3>{outfit.name}</h3>
                    {outfit.tags && outfit.tags.length > 0 ? (
                      <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                        {outfit.tags.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(outfit)}
                      className="inline-flex items-center justify-center border border-border p-2 hover:border-foreground transition-colors"
                      aria-label="Edit outfit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(outfit.id)}
                      className="inline-flex items-center justify-center border border-border p-2 hover:border-destructive transition-colors"
                      aria-label="Delete outfit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {outfit.notes ? (
                  <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                    {outfit.notes}
                  </p>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  {outfit.items.map((item: ClothingItem) => (
                    <button
                      key={item.id}
                      onClick={() => onOpenItem(item.id)}
                      className="w-full text-left border border-border px-3 py-2 hover:border-foreground transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 border border-border rounded-full flex items-center justify-center bg-muted">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xs" style={{ fontFamily: "Outfit, sans-serif" }}>
                              {buildPlaceholderLabel(item.name)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p style={{ fontFamily: "Outfit, sans-serif" }}>{item.name}</p>
                          <p className="text-xs text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                            <Shirt className="inline w-3 h-3 mr-1" />
                            {item.tags.length > 0 ? formatTagLabel(item.tags[0]) : "Unstyled"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>

      {flash ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 right-6 z-50 max-w-sm border px-4 py-3 text-sm shadow-lg backdrop-blur ${
            flash.kind === "success"
              ? "border-foreground/20 bg-background/95 text-foreground"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          }`}
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {flash.message}
        </motion.div>
      ) : null}
    </div>
  );
}
