import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  CircleAlert,
  LayoutGrid,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ClothingItem,
  deleteModeledPreview,
  destroyOutfit,
  formatTagInput,
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
import {
  formatMagazineSearchSuggestionDetail,
  formatOutfitSearchSuggestionDetail,
  getMagazineSearchSuggestions,
  getOutfitSearchSuggestions,
  searchMagazines,
  searchOutfits,
} from "../lib/closetFilters";
import { navigateTo } from "../lib/routes";
import { SearchSuggestionField } from "./SearchSuggestionField";
import {
  CollectionCard,
  CollectionCardBody,
  CollectionCardHoverActions,
  CollectionCardMedia,
  CollectionCardTitleOverlay,
} from "./shared/CollectionCard";
import {
  CollectionGrid,
  CollectionGridSkeleton,
  CollectionPageHeader,
  CollectionPageShell,
  CollectionToolbar,
} from "./shared/CollectionLayout";
import { VisualStatePanel } from "./shared/VisualStatePanel";
import { useBackNavigationGuard } from "../lib/useBackNavigationGuard";
import { useIncrementalCollection } from "../lib/useIncrementalCollection";
import { InfiniteCollectionSentinel } from "./shared/InfiniteCollectionSentinel";

interface MyOutfitsPageProps {
  isLoading: boolean;
  loadErrorMessage: string;
  onOutfitDeleted: (outfitId: number) => void;
  onOutfitModeledWorkflowUpdated: (outfitId: number, workflow: AiWorkflow) => void;
  onOutfitUpdated: (outfit: Outfit) => void;
  outfits: Outfit[];
  pageView: OutfitsPageView;
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

function outfitEditorSnapshot(
  draft: OutfitDraft,
  layouts: Record<number, OutfitCollageLayout>,
) {
  return JSON.stringify({
    draft,
    layouts: draft.itemIds.map((itemId) => ({
      itemId,
      layout: layouts[itemId] ?? null,
    })),
  });
}

export function MyOutfitsPage({
  isLoading,
  loadErrorMessage,
  onOutfitDeleted,
  onOutfitModeledWorkflowUpdated,
  onOutfitUpdated,
  outfits,
  pageView,
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
  const [modeledWorkflow, setModeledWorkflow] = useState<AiWorkflow | null>(null);
  const [isRequestingModeledPreview, setIsRequestingModeledPreview] = useState(false);
  const [isDeletingModeledPreview, setIsDeletingModeledPreview] = useState(false);
  const [isAutofillingOutfitDetails, setIsAutofillingOutfitDetails] = useState(false);
  const [galleryView, setGalleryView] = useState<OutfitGalleryView>("flatlay");
  const [magazineSearchQuery, setMagazineSearchQuery] = useState("");
  const [outfitSearchQuery, setOutfitSearchQuery] = useState("");
  const [regenerationConfirmationOutfitId, setRegenerationConfirmationOutfitId] = useState<number | null>(null);
  const [showUnsavedNavigationWarning, setShowUnsavedNavigationWarning] = useState(false);
  const outfitDetailsRequestIdRef = useRef(0);
  const initialEditorSnapshotRef = useRef<string | null>(null);
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
    () => searchOutfits(outfits, outfitSearchQuery),
    [outfitSearchQuery, outfits],
  );
  const {
    hasMore: hasMoreOutfits,
    sentinelRef: outfitsSentinelRef,
    visibleItems: visibleOutfits,
  } = useIncrementalCollection(filteredOutfits, {
    batchSize: 24,
    resetKey: outfitSearchQuery.trim().toLocaleLowerCase(),
  });
  const outfitSearchSuggestions = useMemo(
    () => getOutfitSearchSuggestions(outfits, outfitSearchQuery),
    [outfitSearchQuery, outfits],
  );
  const filteredMagazines = useMemo(
    () => searchMagazines(hydratedFolders, magazineSearchQuery),
    [hydratedFolders, magazineSearchQuery],
  );
  const magazineSearchSuggestions = useMemo(
    () => getMagazineSearchSuggestions(hydratedFolders, magazineSearchQuery),
    [hydratedFolders, magazineSearchQuery],
  );
  const editingOutfit = editingOutfitId
    ? outfits.find((outfit) => outfit.id === editingOutfitId) ?? null
    : null;
  const currentEditorSnapshot = outfitEditorSnapshot(formState, editorLayouts);
  const hasUnsavedOutfitChanges = Boolean(
    editingOutfitId
    && initialEditorSnapshotRef.current
    && initialEditorSnapshotRef.current !== currentEditorSnapshot,
  );
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
    if (!showUnsavedNavigationWarning) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowUnsavedNavigationWarning(false);
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [showUnsavedNavigationWarning]);

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

  function startEditing(outfit: Outfit) {
    const nextFormState = outfitToFormState(outfit);
    const nextLayouts = resolveOutfitCollageLayouts(outfit.items);
    initialEditorSnapshotRef.current = outfitEditorSnapshot(nextFormState, nextLayouts);
    setEditingOutfitId(outfit.id);
    setFormState(nextFormState);
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
    setShowUnsavedNavigationWarning(false);
    initialEditorSnapshotRef.current = null;
  }

  const showNavigationWarning = useCallback(() => {
    setShowUnsavedNavigationWarning(true);
  }, []);

  useBackNavigationGuard({
    active: Boolean(editingOutfitId),
    blocked: hasUnsavedOutfitChanges,
    guardId: `outfit-editor-${editingOutfitId ?? "closed"}`,
    onBackWithoutChanges: resetForm,
    onBlockedBack: showNavigationWarning,
  });

  function requestEditorClose() {
    if (hasUnsavedOutfitChanges) {
      showNavigationWarning();
      return;
    }

    resetForm();
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
    <CollectionPageShell>
      <CollectionPageHeader
        title={pageView === "outfits" ? "My Outfits" : "My Magazines"}
        description={pageView === "outfits"
          ? `${outfits.length} ${outfits.length === 1 ? "outfit" : "outfits"} saved`
          : `${hydratedFolders.length} ${hydratedFolders.length === 1 ? "magazine" : "magazines"} · Group saved outfits into a story and decorate each page.`}
        actions={pageView === "outfits" ? (
          <div className="flex flex-wrap gap-2">
            <PrimitiveButton
              type="button"
              variant={galleryView === "modeled" ? "default" : "outline"}
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
          </div>
        ) : (
          <PrimitiveButton
            type="button"
            onClick={() => navigateTo("/magazines/new")}
            disabled={isLoadingFolders}
          >
            <Plus className="h-4 w-4" />
            New magazine
          </PrimitiveButton>
        )}
      />

      {pageView === "magazines" ? (
        <section>
          {!isLoadingFolders && hydratedFolders.length > 0 ? (
            <CollectionToolbar>
              <div className="max-w-xl">
                <label htmlFor="magazine-search" className="sr-only">
                  Search magazines
                </label>
                <SearchSuggestionField
                  id="magazine-search"
                  value={magazineSearchQuery}
                  onChange={setMagazineSearchQuery}
                  onClear={() => setMagazineSearchQuery("")}
                  showClear={Boolean(magazineSearchQuery.trim())}
                  suggestions={magazineSearchSuggestions}
                  getSuggestionKey={(folder) => folder.id}
                  getSuggestionLabel={(folder) => folder.name}
                  getSuggestionDetail={formatMagazineSearchSuggestionDetail}
                  onSelectSuggestion={(folder) => setMagazineSearchQuery(folder.name)}
                  onOpenSuggestion={(folder) => navigateTo(`/magazines/${folder.id}`)}
                  placeholder="Search magazines by name, occasion, notes, or outfits"
                />
                {magazineSearchQuery.trim() ? (
                  <PrimitiveText as="p" variant="caption" tone="muted" className="mt-2" aria-live="polite">
                    {filteredMagazines.length} of {hydratedFolders.length} {hydratedFolders.length === 1 ? "magazine" : "magazines"} match
                  </PrimitiveText>
                ) : null}
              </div>
            </CollectionToolbar>
          ) : null}

          {isLoadingFolders ? (
            <CollectionGridSkeleton count={4} label="Loading magazines" mediaClassName="aspect-[4/5]" variant="wardrobe" />
          ) : hydratedFolders.length === 0 ? (
            <VisualStatePanel
              icon={BookOpen}
              overline="Your magazines"
              title="Create your first magazine"
              description="Group saved outfits into a story, arrange their order, and decorate each page."
            >
              <PrimitiveButton type="button" onClick={() => navigateTo("/magazines/new")}>
                <Plus className="h-4 w-4" />
                New magazine
              </PrimitiveButton>
            </VisualStatePanel>
          ) : filteredMagazines.length === 0 ? (
            <VisualStatePanel
              icon={SearchX}
              overline="No results"
              title="No matching magazines"
              description="Try another magazine name, occasion, note, or outfit."
            >
              <PrimitiveButton type="button" variant="outline" onClick={() => setMagazineSearchQuery("")}>
                Clear search
              </PrimitiveButton>
            </VisualStatePanel>
          ) : (
            <CollectionGrid variant="wardrobe">
              {filteredMagazines.map((folder, index) => {
                const coverOutfit = folder.outfits[0];
                const coverView = coverOutfit && resolveModeledWorkflowImageUrl(coverOutfit.modeled_workflow)
                  ? "modeled"
                  : "flatlay";

                return (
                  <CollectionCard
                    key={folder.id}
                    style={{ animationDelay: `${index * 40}ms` }}
                    className="group animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <CollectionCardMedia className="aspect-[4/5] bg-white">
                      {coverOutfit ? (
                        <OutfitGalleryPreview className="max-w-none" outfit={coverOutfit} view={coverView} />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-stone-100 px-6 text-center">
                          <BookOpen className="mb-4 h-12 w-12 stroke-[1.2] text-muted-foreground" aria-hidden="true" />
                          <PrimitiveText as="span" variant="overline" tone="muted">Empty magazine</PrimitiveText>
                        </div>
                      )}
                      <CollectionCardTitleOverlay title={folder.name} />
                      <a
                        href={`/magazines/${folder.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                        aria-label={`Open ${folder.name} magazine`}
                      />
                      <CollectionCardHoverActions>
                        <PrimitiveButton
                          type="button"
                          variant="outline"
                          size="icon"
                          className="border-background/60 bg-background/90 shadow-sm backdrop-blur-sm"
                          onClick={() => navigateTo(`/magazines/${folder.id}/edit`)}
                          aria-label={`Edit ${folder.name} magazine`}
                        >
                          <Pencil className="h-4 w-4" />
                        </PrimitiveButton>
                        <PrimitiveButton
                          type="button"
                          variant="outline"
                          size="icon"
                          className="border-background/60 bg-background/90 shadow-sm backdrop-blur-sm hover:border-destructive"
                          onClick={() => requestFolderDelete(folder.id)}
                          aria-label={`Delete ${folder.name} magazine`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </PrimitiveButton>
                      </CollectionCardHoverActions>
                    </CollectionCardMedia>
                  </CollectionCard>
                );
              })}
            </CollectionGrid>
          )}
        </section>
      ) : (
        <section>
          {!isLoading && !loadErrorMessage && outfits.length > 0 ? (
            <CollectionToolbar>
              <div className="max-w-xl">
                <label htmlFor="outfit-search" className="sr-only">
                  Search outfits
                </label>
                <SearchSuggestionField
                  id="outfit-search"
                  value={outfitSearchQuery}
                  onChange={setOutfitSearchQuery}
                  onClear={() => setOutfitSearchQuery("")}
                  showClear={Boolean(outfitSearchQuery.trim())}
                  suggestions={outfitSearchSuggestions}
                  getSuggestionKey={(outfit) => outfit.id}
                  getSuggestionLabel={(outfit) => outfit.name}
                  getSuggestionDetail={(outfit) => formatOutfitSearchSuggestionDetail(outfit, outfitSearchQuery)}
                  onSelectSuggestion={(outfit) => setOutfitSearchQuery(outfit.name)}
                  onOpenSuggestion={startEditing}
                  placeholder="Search outfits by name, tags, notes, or pieces"
                />
                {outfitSearchQuery.trim() ? (
                  <PrimitiveText as="p" variant="caption" tone="muted" className="mt-2" aria-live="polite">
                    {filteredOutfits.length} of {outfits.length} {outfits.length === 1 ? "outfit" : "outfits"} match
                  </PrimitiveText>
                ) : null}
              </div>
            </CollectionToolbar>
          ) : null}

        {isLoading ? (
          <CollectionGridSkeleton count={4} label="Loading outfits" mediaClassName="aspect-[4/5]" variant="wardrobe" />
        ) : loadErrorMessage ? (
          <VisualStatePanel
            icon={CircleAlert}
            overline="Unable to load"
            title="Outfits could not be loaded"
            description={loadErrorMessage}
            tone="destructive"
          />
        ) : outfits.length === 0 ? (
          <VisualStatePanel
            icon={LayoutGrid}
            overline="Your outfits"
            title="No outfits yet"
            description="Create your first look from the closet cart and it will appear here."
          />
        ) : filteredOutfits.length === 0 ? (
          <VisualStatePanel
            icon={SearchX}
            overline="No results"
            title="No matching outfits"
            description="Try another name, tag, note, or closet piece."
          >
            <PrimitiveButton
              type="button"
              variant="outline"
              onClick={() => setOutfitSearchQuery("")}
            >
              Clear search
            </PrimitiveButton>
          </VisualStatePanel>
        ) : (
          <CollectionGrid variant="wardrobe">
            {visibleOutfits.map((outfit, index) => {
              const galleryModelPreview = resolveOutfitGalleryModelPreview(outfit.modeled_workflow);

              return (
                <CollectionCard
                  key={outfit.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className="group animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <CollectionCardMedia className="aspect-[4/5] bg-white">
                    <OutfitGalleryPreview className="max-w-none" outfit={outfit} view={galleryView} />
                    <CollectionCardTitleOverlay title={outfit.name} />
                    <button
                      type="button"
                      className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                      onClick={() => startEditing(outfit)}
                      aria-label={`Open ${outfit.name}`}
                    />
                    <CollectionCardHoverActions>
                      <PrimitiveButton
                        onClick={() => startEditing(outfit)}
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${outfit.name}`}
                        className="border-background/60 bg-background/90 shadow-sm backdrop-blur-sm"
                      >
                        <Pencil className="h-4 w-4" />
                      </PrimitiveButton>
                      <PrimitiveButton
                        onClick={() => void handleDelete(outfit.id)}
                        variant="outline"
                        size="icon"
                        className="border-background/60 bg-background/90 shadow-sm backdrop-blur-sm hover:border-destructive"
                        aria-label={`Delete ${outfit.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </PrimitiveButton>
                    </CollectionCardHoverActions>
                  </CollectionCardMedia>

                  {canUseModeledPreview && galleryView === "modeled" ? (
                    <CollectionCardBody density="compact">
                      {galleryModelPreview.kind === "image" ? (
                        <PrimitiveButton
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={isRequestingModeledPreview || !outfit.items.length || !outfit.items.every((item) => item.image_url)}
                          onClick={() => setRegenerationConfirmationOutfitId(outfit.id)}
                          title={!outfit.items.every((item) => item.image_url) ? "Every outfit item needs a photo" : undefined}
                        >
                          <UserRound className="h-4 w-4" />
                          Regenerate model
                        </PrimitiveButton>
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
                      )}
                    </CollectionCardBody>
                  ) : null}
                </CollectionCard>
              );
            })}
          </CollectionGrid>
        )}
        {!isLoading && !loadErrorMessage && filteredOutfits.length > 0 ? (
          <InfiniteCollectionSentinel
            hasMore={hasMoreOutfits}
            label="Loading more outfits…"
            sentinelRef={outfitsSentinelRef}
          />
        ) : null}
        </section>
      )}

      {flash && !editingOutfitId ? (
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

      {showUnsavedNavigationWarning ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-[100] flex w-[min(26rem,calc(100vw-3rem))] items-start gap-3 border border-amber-500/35 bg-background/95 px-4 py-3 text-foreground shadow-lg backdrop-blur"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <PrimitiveText as="p" variant="bodySm">
            You have unsaved outfit changes. Save your changes or choose Cancel before leaving.
          </PrimitiveText>
        </motion.div>
      ) : null}

      <Dialog open={Boolean(editingOutfitId)} onOpenChange={(open) => !open && requestEditorClose()}>
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
                      onClick={() => {
                        if (!editingOutfit) return;
                        if (modeledImageUrl) {
                          setRegenerationConfirmationOutfitId(editingOutfit.id);
                          return;
                        }
                        void handleRequestModeledPreview(editingOutfit.id, formState, editorLayouts);
                      }}
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
        open={regenerationConfirmationOutfitId !== null}
        onOpenChange={(open) => !open && setRegenerationConfirmationOutfitId(null)}
        title="Replace modeled image?"
        description={`Regenerating will replace the existing modeled image for “${
          outfits.find((outfit) => outfit.id === regenerationConfirmationOutfitId)?.name ?? "this outfit"
        }”.`}
        cancelLabel="Keep existing image"
        confirmLabel="Regenerate model"
        onConfirm={() => {
          const outfitId = regenerationConfirmationOutfitId;
          setRegenerationConfirmationOutfitId(null);
          if (!outfitId) return;

          if (editingOutfitId === outfitId && editingOutfit) {
            void handleRequestModeledPreview(outfitId, formState, editorLayouts);
            return;
          }

          const outfit = outfits.find((entry) => entry.id === outfitId);
          if (outfit) handleStartModeling(outfit);
        }}
      />

      <PrimitiveConfirmationDialog
        open={folderToDeleteId !== null}
        onOpenChange={(open) => !open && requestFolderDelete(null)}
        title="Delete magazine?"
        description="This removes the magazine layout and uploaded clip art. The outfits themselves will stay saved."
        cancelLabel="Keep magazine"
        confirmLabel="Delete magazine"
        onConfirm={() => void handleDeleteFolder()}
      />

    </CollectionPageShell>
  );
}
