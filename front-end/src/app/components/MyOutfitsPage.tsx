import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  ClothingItem,
  deleteModeledPreview,
  destroyOutfit,
  formatTagInput,
  generateOutfit,
  generateOutfitMetadataSuggestions,
  OutfitDraft,
  Outfit,
  parseTagInput,
  requestModeledOutfit,
  updateOutfit,
  User,
  AiWorkflow,
  createOutfitDecoration,
  destroyOutfitDecoration,
  type Decoration,
  type OutfitDecoration,
  updateOutfitDecoration,
} from "../lib/closet";
import { OutfitCollageCanvas } from "./OutfitCollageCanvas";
import { OutfitCollageLayersPanel } from "./OutfitCollageLayersPanel";
import { OutfitPreviewCarousel } from "./OutfitPreviewCarousel";
import {
  OutfitCollageLayout,
  reorderCollageLayers,
  resolveOutfitCollageLayouts,
} from "../lib/outfitCollage";
import {
  resolveModeledWorkflowImageUrl,
  resolveOutfitGalleryModelPreview,
} from "../lib/modeledPreview";
import { createOutfitFlatlaySnapshot } from "../lib/outfitFlatlaySnapshot";
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
import { PrimitiveConfirmationDialog } from "./primitives/PrimitiveConfirmationDialog";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { OutfitGalleryPreview } from "./OutfitGalleryPreview";
import { MAX_OUTFIT_NAME, MAX_OUTFIT_NOTES } from "../lib/inputLengthPolicy";
import { useOutfitMagazines } from "./outfits/useOutfitMagazines";
import { matchesOutfitSearchQuery } from "../lib/closetFilters";
import { navigateTo } from "../lib/routes";

interface MyOutfitsPageProps {
  isLoading: boolean;
  loadErrorMessage: string;
  onOutfitDeleted: (outfitId: number) => void;
  onGenerationTaskStarted: (workflow: AiWorkflow, label: string) => void;
  onOutfitModeledWorkflowUpdated: (outfitId: number, workflow: AiWorkflow) => void;
  onOutfitUpdated: (outfit: Outfit) => void;
  outfits: Outfit[];
  user: User;
  canUseModeledPreview: boolean;
}

interface FlashState {
  kind: "success" | "error";
  message: string;
}

type OutfitGalleryView = "flatlay" | "modeled";
type OutfitsPageView = "outfits" | "magazines";

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
  onGenerationTaskStarted,
  onOutfitModeledWorkflowUpdated,
  onOutfitUpdated,
  outfits,
  user,
  canUseModeledPreview,
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
  const [editorDecorations, setEditorDecorations] = useState<OutfitDecoration[]>([]);
  const [selectedDecorationId, setSelectedDecorationId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generationOccasion, setGenerationOccasion] = useState("");
  const [generationReferencePhoto, setGenerationReferencePhoto] = useState<File | null>(null);
  const [isGeneratingOutfit, setIsGeneratingOutfit] = useState(false);
  const [modeledWorkflow, setModeledWorkflow] = useState<AiWorkflow | null>(null);
  const [isRequestingModeledPreview, setIsRequestingModeledPreview] = useState(false);
  const [isDeletingModeledPreview, setIsDeletingModeledPreview] = useState(false);
  const [isAutofillingOutfitDetails, setIsAutofillingOutfitDetails] = useState(false);
  const [galleryView, setGalleryView] = useState<OutfitGalleryView>("flatlay");
  const [pageView, setPageView] = useState<OutfitsPageView>(() => (
    new URLSearchParams(window.location.search).get("view") === "magazines" ? "magazines" : "outfits"
  ));
  const [outfitSearchQuery, setOutfitSearchQuery] = useState("");
  const [regenerationConfirmationOutfitId, setRegenerationConfirmationOutfitId] = useState<number | null>(null);
  const outfitDetailsRequestIdRef = useRef(0);
  const showFlash = useCallback((kind: FlashState["kind"], message: string) => {
    setFlash({ kind, message });
  }, []);
  const magazines = useOutfitMagazines({
    onFlash: showFlash,
    outfits,
    userId: user.id,
  });
  const {
    deleteRequestedFolder: handleDeleteFolder,
    folderToDeleteId,
    hydratedFolders,
    isLoading: isLoadingFolders,
    removeOutfit: removeOutfitFromFolders,
    requestFolderDelete,
  } = magazines;

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
  const filteredOutfits = useMemo(
    () => outfits.filter((outfit) => matchesOutfitSearchQuery(outfit, outfitSearchQuery)),
    [outfitSearchQuery, outfits],
  );
  const editingOutfit = editingOutfitId
    ? outfits.find((outfit) => outfit.id === editingOutfitId) ?? null
    : null;
  const selectedItemsCanBeModeled = selectedItems.length > 0 && selectedItems.every((item) => Boolean(item.image_url));
  const modeledImageUrl = resolveModeledWorkflowImageUrl(modeledWorkflow);
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

  useEffect(() => {
    if (editingOutfitId) {
      setModeledWorkflow(editingOutfit?.modeled_workflow ?? null);
    }
  }, [editingOutfit?.modeled_workflow, editingOutfitId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAutofillingOutfitDetails) {
      return;
    }

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
      removeOutfitFromFolders(outfitId);
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
      const occasionLabel = generationOccasion.trim() || "a new outfit";
      const workflow = await generateOutfit({
        occasion: generationOccasion,
        referencePhoto: generationReferencePhoto,
      });

      onGenerationTaskStarted(workflow, occasionLabel);
      setGenerationOccasion("");
      setGenerationReferencePhoto(null);
      setIsGenerateDialogOpen(false);
      showFlash("success", "Outfit generation started. You can leave this page while it runs.");
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
    setEditorDecorations(outfit.decorations ?? []);
    setSelectedDecorationId(null);
    setModeledWorkflow(outfit.modeled_workflow ?? null);
    setFlash(null);
  }

  function resetForm() {
    outfitDetailsRequestIdRef.current += 1;
    setIsAutofillingOutfitDetails(false);
    setEditingOutfitId(null);
    setFormState({
      name: "",
      notes: "",
      tagInput: "",
      itemIds: [],
    });
    setEditorLayouts({});
    setSelectedCollageItemId(null);
    setEditorDecorations([]);
    setSelectedDecorationId(null);
    setModeledWorkflow(null);
  }

  function syncEditorDecorations(nextDecorations: OutfitDecoration[]) {
    setEditorDecorations(nextDecorations);
    if (editingOutfit) {
      onOutfitUpdated({ ...editingOutfit, decorations: nextDecorations });
    }
  }

  async function addDecorationToFlatlay(decoration: Decoration) {
    if (!editingOutfitId) return;
    try {
      const placement = await createOutfitDecoration(editingOutfitId, {
        decorationId: decoration.id,
        x: 36 + (editorDecorations.length * 5) % 28,
        y: 34 + (editorDecorations.length * 7) % 32,
        width: 20,
        layerOrder: editorDecorations.length,
      });
      syncEditorDecorations([...editorDecorations, placement]);
      setSelectedDecorationId(placement.id);
      setSelectedCollageItemId(null);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to add this decoration.");
    }
  }

  async function changeFlatlayDecoration(placement: OutfitDecoration, changes: Partial<OutfitDecoration>) {
    if (!editingOutfitId) return;
    const previous = editorDecorations;
    const optimistic = previous.map((entry) => entry.id === placement.id ? { ...entry, ...changes } : entry);
    syncEditorDecorations(optimistic);
    try {
      const saved = await updateOutfitDecoration(editingOutfitId, placement.id, changes);
      syncEditorDecorations(optimistic.map((entry) => entry.id === saved.id ? saved : entry));
    } catch (error) {
      syncEditorDecorations(previous);
      showFlash("error", error instanceof Error ? error.message : "Unable to save this decoration.");
    }
  }

  async function removeFlatlayDecoration(placement: OutfitDecoration) {
    if (!editingOutfitId) return;
    try {
      await destroyOutfitDecoration(editingOutfitId, placement.id);
      syncEditorDecorations(editorDecorations.filter((entry) => entry.id !== placement.id));
      setSelectedDecorationId(null);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to remove this decoration.");
    }
  }

  async function handleRequestModeledPreview(
    outfitId: number,
    draft: OutfitDraft,
    layouts: Record<number, OutfitCollageLayout>,
  ) {
    if (!canUseModeledPreview) {
      showFlash("error", "Add a private model photo before modeling an outfit.");
      return;
    }

    const draftItems = resolveItemsById(draft.itemIds);
    if (
      draftItems.length === 0 ||
      draftItems.length !== draft.itemIds.length ||
      !draftItems.every((item) => item.image_url)
    ) {
      showFlash("error", "Every item in this outfit needs a photo before modeling the full look.");
      return;
    }

    setIsRequestingModeledPreview(true);
    setFlash(null);

    try {
      const flatlaySnapshot = await createOutfitFlatlaySnapshot({
        items: draftItems,
        layouts,
        decorations: editorDecorations,
        outfitName: draft.name,
      });
      const workflow = await requestModeledOutfit(outfitId, {
        itemIds: draft.itemIds,
        name: draft.name,
        notes: draft.notes,
        tags: parseTagInput(draft.tagInput),
      }, flatlaySnapshot);
      setModeledWorkflow(workflow);
      onOutfitModeledWorkflowUpdated(outfitId, workflow);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to create a modeled outfit preview.");
    } finally {
      setIsRequestingModeledPreview(false);
    }
  }

  function handleStartModeling(outfit: Outfit) {
    const draft = outfitToFormState(outfit);
    const layouts = resolveOutfitCollageLayouts(outfit.items);
    startEditing(outfit);
    void handleRequestModeledPreview(outfit.id, draft, layouts);
  }

  async function handleDeleteModeledPreview() {
    if (!modeledWorkflow || !editingOutfitId) {
      return;
    }

    setIsDeletingModeledPreview(true);
    setFlash(null);
    try {
      const nextWorkflow = await deleteModeledPreview(modeledWorkflow.id);
      setModeledWorkflow(nextWorkflow);
      onOutfitModeledWorkflowUpdated(editingOutfitId, nextWorkflow);
      showFlash("success", "Modeled outfit preview deleted.");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to delete the modeled outfit preview.");
    } finally {
      setIsDeletingModeledPreview(false);
    }
  }

  async function handleAutofillOutfitDetails() {
    if (!editingOutfit || formState.itemIds.length === 0) {
      showFlash("error", "Add at least one item before filling outfit details.");
      return;
    }

    setIsAutofillingOutfitDetails(true);
    setFlash(null);
    const requestId = outfitDetailsRequestIdRef.current + 1;
    outfitDetailsRequestIdRef.current = requestId;
    try {
      const suggestion = await generateOutfitMetadataSuggestions({
        outfitId: editingOutfit.id,
        itemIds: formState.itemIds,
        name: formState.name,
        notes: formState.notes,
        tags: parseTagInput(formState.tagInput),
      });
      if (outfitDetailsRequestIdRef.current !== requestId) {
        return;
      }

      setFormState((current) => ({
        ...current,
        name: suggestion.name || current.name,
        notes: suggestion.notes,
        tagInput: formatTagInput(suggestion.tags),
      }));
      showFlash("success", "AI filled the outfit details. Review them before saving.");
    } catch (error) {
      if (outfitDetailsRequestIdRef.current !== requestId) {
        return;
      }

      showFlash("error", error instanceof Error ? error.message : "Unable to fill the outfit details.");
    } finally {
      if (outfitDetailsRequestIdRef.current === requestId) {
        setIsAutofillingOutfitDetails(false);
      }
    }
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
      <section className="space-y-4 border-y border-border py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PrimitiveButton
              type="button"
              variant={pageView === "outfits" ? "default" : "outline"}
              size="sm"
              aria-pressed={pageView === "outfits"}
              onClick={() => setPageView("outfits")}
            >
              All outfits
            </PrimitiveButton>
            <PrimitiveButton
              type="button"
              variant={pageView === "magazines" ? "default" : "outline"}
              size="sm"
              disabled={isLoadingFolders}
              aria-pressed={pageView === "magazines"}
              onClick={() => setPageView("magazines")}
            >
              <BookOpen className="h-4 w-4" />
              My Magazines
            </PrimitiveButton>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {pageView === "outfits" ? (
              <>
                <PrimitiveButton
                  type="button"
                  variant={galleryView === "modeled" ? "default" : "outline"}
                  size="sm"
                  className="min-w-32"
                  aria-pressed={galleryView === "modeled"}
                  onClick={() => setGalleryView((current) => current === "modeled" ? "flatlay" : "modeled")}
                  title={galleryView === "modeled" ? "Show outfit flat lays" : "Show modeled outfits"}
                >
                  {galleryView === "modeled"
                    ? <LayoutGrid className="h-4 w-4" />
                    : <UserRound className="h-4 w-4" />}
                  {galleryView === "modeled" ? "Flatlay view" : "Model view"}
                </PrimitiveButton>
                <PrimitiveButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsGenerateDialogOpen(true)}
                  disabled={isLoading || isGeneratingOutfit || user.clothing_items.length === 0}
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingOutfit ? "Generating..." : "AI Outfit"}
                </PrimitiveButton>
              </>
            ) : null}
            <PrimitiveText as="p" variant="bodySm" tone="muted" className="px-1">
              {pageView === "outfits"
                ? `${outfits.length} ${outfits.length === 1 ? "outfit" : "outfits"} saved`
                : `${hydratedFolders.length} ${hydratedFolders.length === 1 ? "magazine" : "magazines"}`}
            </PrimitiveText>
          </div>
        </div>
      </section>

      {pageView === "magazines" ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <PrimitiveText as="h2" variant="display" font="serif">
                My Magazines
              </PrimitiveText>
              <PrimitiveText as="p" tone="muted" className="mt-1">
                Group saved outfits into a story, arrange their order, and decorate each page.
              </PrimitiveText>
            </div>
            <PrimitiveButton
              type="button"
              variant="outline"
              onClick={() => navigateTo("/magazines/new")}
              disabled={isLoadingFolders}
            >
              <Plus className="h-4 w-4" />
              New magazine
            </PrimitiveButton>
          </div>

          {isLoadingFolders ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="aspect-[4/3] animate-pulse border border-border bg-muted/40" />
              ))}
            </div>
          ) : hydratedFolders.length === 0 ? (
            <div className="border border-dashed border-border px-6 py-14 text-center">
              <BookOpen className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <PrimitiveText as="h3" variant="display" font="serif" className="mb-2">
                Create your first magazine
              </PrimitiveText>
              <PrimitiveButton type="button" className="mt-6" onClick={() => navigateTo("/magazines/new")}>
                <Plus className="h-4 w-4" />
                New magazine
              </PrimitiveButton>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hydratedFolders.map((folder, index) => (
                <motion.article
                  key={folder.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="overflow-hidden border border-border bg-card"
                >
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-stone-100 px-8 text-center">
                    <BookOpen className="mb-5 h-12 w-12 stroke-[1.2] text-muted-foreground" aria-hidden="true" />
                    <PrimitiveText as="span" variant="overline" tone="muted">
                      Magazine
                    </PrimitiveText>
                    <PrimitiveText as="span" variant="display" font="serif" className="mt-2 break-words">
                      {folder.name}
                    </PrimitiveText>
                  </div>

                  <div className="space-y-4 p-5">
                    <PrimitiveText as="p" variant="bodySm" tone="muted">
                      {folder.outfits.length} {folder.outfits.length === 1 ? "outfit" : "outfits"}
                      {folder.notes ? ` · ${folder.notes}` : ""}
                    </PrimitiveText>
                    <div className="flex flex-wrap gap-2">
                      <PrimitiveButton asChild>
                        <a href={`/magazines/${folder.id}`} target="_blank" rel="noopener noreferrer">
                          <BookOpen className="h-4 w-4" />
                          Open magazine
                        </a>
                      </PrimitiveButton>
                      <PrimitiveButton type="button" variant="outline" onClick={() => navigateTo(`/magazines/${folder.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                        Edit magazine
                      </PrimitiveButton>
                      <PrimitiveButton
                        type="button"
                        variant="outline"
                        size="icon"
                        className="hover:border-destructive"
                        onClick={() => requestFolderDelete(folder.id)}
                        aria-label={`Delete ${folder.name} magazine`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </PrimitiveButton>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </section>
      ) : (
      <section className="space-y-4">
        {!isLoading && !loadErrorMessage && outfits.length > 0 ? (
          <div className="relative max-w-xl">
            <label htmlFor="outfit-search" className="sr-only">
              Search outfits
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="outfit-search"
              type="search"
              value={outfitSearchQuery}
              onChange={(event) => setOutfitSearchQuery(event.target.value)}
              placeholder="Search outfits by name, tags, notes, or pieces"
              className="h-12 rounded-none border-border bg-background pl-11 pr-11"
            />
            {outfitSearchQuery ? (
              <PrimitiveButton
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2"
                onClick={() => setOutfitSearchQuery("")}
                aria-label="Clear outfit search"
              >
                <X className="h-4 w-4" />
              </PrimitiveButton>
            ) : null}
          </div>
        ) : null}

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
        ) : filteredOutfits.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center" role="status">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              No matching outfits
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Try another name, tag, note, or closet piece.
            </PrimitiveText>
            <PrimitiveButton
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => setOutfitSearchQuery("")}
            >
              Clear search
            </PrimitiveButton>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOutfits.map((outfit, index) => {
              const galleryModelPreview = resolveOutfitGalleryModelPreview(outfit.modeled_workflow);

              return (
                <motion.article
                  key={outfit.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="mx-auto w-full max-w-[22rem] overflow-hidden border border-border bg-card"
                >
                  <div className="px-5 pt-5">
                    <OutfitGalleryPreview outfit={outfit} view={galleryView} />
                  </div>

                  <div className="space-y-4 border-t border-border p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <PrimitiveText as="h3" variant="display" font="serif" className="break-words">
                          {outfit.name}
                        </PrimitiveText>
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

                    {canUseModeledPreview && galleryView === "modeled" ? (
                      galleryModelPreview.kind === "image" ? (
                        <PrimitiveConfirmationDialog
                          open={regenerationConfirmationOutfitId === outfit.id}
                          onOpenChange={(open) => setRegenerationConfirmationOutfitId(open ? outfit.id : null)}
                          title="Replace modeled image?"
                          description={`Regenerating will replace the existing modeled image for “${outfit.name}”.`}
                          cancelLabel="Keep existing image"
                          confirmLabel="Regenerate model"
                          onConfirm={() => {
                            setRegenerationConfirmationOutfitId(null);
                            handleStartModeling(outfit);
                          }}
                        >
                          <PrimitiveButton
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={isRequestingModeledPreview || !outfit.items.length || !outfit.items.every((item) => item.image_url)}
                            title={!outfit.items.every((item) => item.image_url) ? "Every outfit item needs a photo" : undefined}
                          >
                            <UserRound className="h-4 w-4" />
                            Regenerate model
                          </PrimitiveButton>
                        </PrimitiveConfirmationDialog>
                      ) : (
                        <PrimitiveButton
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={isRequestingModeledPreview || !outfit.items.length || !outfit.items.every((item) => item.image_url)}
                          onClick={() => handleStartModeling(outfit)}
                          title={!outfit.items.every((item) => item.image_url) ? "Every outfit item needs a photo" : undefined}
                        >
                          <UserRound className="h-4 w-4" />
                          Model this look
                        </PrimitiveButton>
                      )
                    ) : null}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
      )}

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
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-none border-border p-0 sm:w-[calc(100vw-3rem)] sm:max-w-[calc(100vw-3rem)] xl:max-w-[120rem] 2xl:max-w-[128rem]"
          headerActions={(
            <AiMetadataAutofillButton
              label="AI fill details"
              isLoading={isAutofillingOutfitDetails}
              disabled={isSaving || formState.itemIds.length === 0}
              onClick={() => void handleAutofillOutfitDetails()}
              className="h-9 w-9 p-0"
            />
          )}
        >
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
                          decorations={editorDecorations}
                          items={selectedItems}
                          layouts={editorLayouts}
                          onAddDecoration={(decoration) => void addDecorationToFlatlay(decoration)}
                          onAddItem={addItemToEditingOutfit}
                          onRemoveDecoration={(decoration) => void removeFlatlayDecoration(decoration)}
                          onRemoveItem={removeItemFromEditingOutfit}
                          selectedDecorationId={selectedDecorationId}
                          selectedItemId={selectedCollageItemId}
                          onSelectDecoration={(decorationId) => {
                            setSelectedDecorationId(decorationId);
                            setSelectedCollageItemId(null);
                          }}
                          onSelectItem={(itemId) => {
                            setSelectedCollageItemId(itemId);
                            setSelectedDecorationId(null);
                          }}
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
                          <OutfitPreviewCarousel
                            initialSlide={galleryView}
                            modeledImageUrl={modeledImageUrl}
                            modeledWorkflow={modeledWorkflow}
                            canDeleteModeledImage={modeledWorkflow?.status === "succeeded" || modeledWorkflow?.status === "review"}
                            isDeletingModeledImage={isDeletingModeledPreview}
                            onDeleteModeledImage={() => void handleDeleteModeledPreview()}
                            onModeledWorkflowUpdated={(workflow) => {
                              setModeledWorkflow(workflow);
                              onOutfitModeledWorkflowUpdated(editingOutfit.id, workflow);
                              showFlash("success", "Modeled preview edits saved.");
                            }}
                            flatlay={(
                              <OutfitCollageCanvas
                                decorations={editorDecorations}
                                items={selectedItems}
                                layouts={editorLayouts}
                                editable
                                selectedDecorationId={selectedDecorationId}
                                selectedItemId={selectedCollageItemId}
                                onSelectDecoration={(placementId) => {
                                  setSelectedDecorationId(placementId);
                                  if (placementId) setSelectedCollageItemId(null);
                                }}
                                onSelectItem={(itemId) => {
                                  setSelectedCollageItemId(itemId);
                                  if (itemId) setSelectedDecorationId(null);
                                }}
                                onDecorationChange={(placement, changes) => void changeFlatlayDecoration(placement, changes)}
                                onLayoutsChange={setEditorLayouts}
                                className="w-full"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="p-6 lg:overflow-y-auto lg:p-8 xl:p-10">
              <DialogHeader className="mb-6 pr-24 text-left sm:text-left">
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
                  {canUseModeledPreview ? (
                    <PrimitiveButton
                      type="button"
                      variant="outline"
                      disabled={isRequestingModeledPreview || !selectedItemsCanBeModeled}
                      onClick={() => editingOutfit && void handleRequestModeledPreview(
                        editingOutfit.id,
                        formState,
                        editorLayouts,
                      )}
                      title={!selectedItemsCanBeModeled ? "Every outfit item needs a photo" : undefined}
                    >
                      <UserRound className="h-4 w-4" />
                      {isRequestingModeledPreview ? "Queueing..." : "Model this look"}
                    </PrimitiveButton>
                  ) : null}
                  <PrimitiveButton type="submit" disabled={isSaving || isAutofillingOutfitDetails} variant="outline">
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

      <PrimitiveConfirmationDialog
        open={folderToDeleteId !== null}
        onOpenChange={(open) => !open && requestFolderDelete(null)}
        title="Delete magazine?"
        description="This removes the magazine layout and uploaded clip art. The outfits themselves will stay saved."
        cancelLabel="Keep magazine"
        confirmLabel="Delete magazine"
        onConfirm={() => void handleDeleteFolder()}
      />

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
