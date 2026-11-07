import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, ShoppingBag } from "lucide-react";
import { AddItemMenu } from "./components/AddItemMenu";
import { ClothingCard } from "./components/ClothingCard";
import { OutfitCartSheet } from "./components/OutfitCartSheet";
import { OutfitCreatedDialog } from "./components/OutfitCreatedDialog";
import {
  PrimitiveButton,
} from "./components/primitives/PrimitiveButton";
import {
  PrimitiveDropdownMenu,
  PrimitiveDropdownMenuCheckboxItem,
  PrimitiveDropdownMenuContent,
  PrimitiveDropdownMenuLabel,
  PrimitiveDropdownMenuSeparator,
  PrimitiveDropdownMenuTrigger,
} from "./components/primitives/PrimitiveDropdownMenu";
import { PrimitiveDropdownTriggerButton } from "./components/primitives/PrimitiveDropdownTriggerButton";
import {
  PrimitiveSelect,
  PrimitiveSelectContent,
  PrimitiveSelectItem,
  PrimitiveSelectTrigger,
  PrimitiveSelectValue,
} from "./components/primitives/PrimitiveSelect";
import { PrimitiveText } from "./components/primitives/PrimitiveText";
import { AboutPage } from "./components/info/AboutPage";
import { PrivacyPage } from "./components/info/PrivacyPage";
import { TermsPage } from "./components/info/TermsPage";
import { AccessRestrictedState } from "./components/shared/AccessRestrictedState";
import { ClosetEmptyState } from "./components/shared/ClosetEmptyState";
import { HomeLanding } from "./components/shared/HomeLanding";
import { NotFoundPage } from "./components/shared/NotFoundPage";
import { SiteFooter } from "./components/shared/SiteFooter";
import { SiteHeader } from "./components/shared/SiteHeader";
import {
  CollectionGrid,
  CollectionGridSkeleton,
  CollectionPageHeader,
  CollectionPageShell,
  CollectionToolbar,
} from "./components/shared/CollectionLayout";
import { VisualStatePanel } from "./components/shared/VisualStatePanel";
import {
  GenerationTaskToasts,
} from "./components/shared/GenerationTaskToasts";
import { ClosetSearchField } from "./components/ClosetSearchField";
import {
  ClothingItem,
  createOutfit,
  discardOutfitRecommendation,
  emptyOutfitDraft,
  AiWorkflow,
  fetchClothingItem,
  fetchOutfitRecommendation,
  fetchOutfits,
  fetchCurrentUser,
  fetchWardrobeAnalysisStatus,
  formatTagInput,
  formatPossessive,
  formatPreferredStyle,
  generateOutfitRecommendations,
  generateOutfitMetadataSuggestions,
  logoutSession,
  Outfit,
  OutfitDraft,
  parseTagInput,
  startWardrobeAnalysis,
  titleize,
  User,
} from "./lib/closet";
import { formatClosetSearchSuggestionLabel } from "./lib/closetFilters";
import {
  AppRoute,
  authErrorMessage,
  getRouteFromLocation,
  isClosetRoute,
  isPublicInfoRoute,
  isProtectedRoute,
  navigateTo,
} from "./lib/routes";
import { collectClosetSuggestions } from "./lib/itemFormValidation";
import { useOutfitDraftState } from "./lib/useOutfitDraftState";
import { useGenerationTaskManager } from "./lib/useGenerationTaskManager";
import { useClosetControls } from "./lib/useClosetControls";
import { useIncrementalCollection } from "./lib/useIncrementalCollection";
import { InfiniteCollectionSentinel } from "./components/shared/InfiniteCollectionSentinel";

interface HomeMessageState {
  kind: "error" | "success";
  text: string;
}

const CreateItemPage = lazy(() => import("./components/CreateItemPage").then((module) => ({
  default: module.CreateItemPage,
})));
const ItemDetailPage = lazy(() => import("./components/ItemDetailPage").then((module) => ({
  default: module.ItemDetailPage,
})));
const MyOutfitsPage = lazy(() => import("./components/MyOutfitsPage").then((module) => ({
  default: module.MyOutfitsPage,
})));
const MyDecorationsPage = lazy(() => import("./components/MyDecorationsPage").then((module) => ({
  default: module.MyDecorationsPage,
})));
const MagazineEditorPage = lazy(() => import("./components/MagazineEditorPage").then((module) => ({
  default: module.MagazineEditorPage,
})));
const MagazineReaderPage = lazy(() => import("./components/MagazineReaderPage").then((module) => ({
  default: module.MagazineReaderPage,
})));
const UserDetailPage = lazy(() => import("./components/UserDetailPage").then((module) => ({
  default: module.UserDetailPage,
})));
const UsersDirectoryPage = lazy(() => import("./components/UsersDirectoryPage").then((module) => ({
  default: module.UsersDirectoryPage,
})));

function RouteLoadingState() {
  return (
    <div className="mx-auto flex min-h-72 w-full max-w-7xl items-center justify-center px-6 py-12" role="status">
      <PrimitiveText tone="muted">Loading page…</PrimitiveText>
    </div>
  );
}

interface OutfitCartGenerationMessage {
  kind: "error" | "success";
  text: string;
}

function outfitCartGenerationPrompt(draft: OutfitDraft, name: string) {
  const details = [
    name.trim() ? `Working title: ${name.trim()}` : "",
    draft.tagInput.trim() ? `Tags or direction: ${draft.tagInput.trim()}` : "",
    draft.notes.trim() ? `Notes: ${draft.notes.trim()}` : "",
  ].filter(Boolean);

  return details.length > 0
    ? `Create a cohesive, wearable outfit from my closet. ${details.join(". ")}`
    : "Create a cohesive, wearable outfit from my closet.";
}

function waitForOutfitGenerationPoll(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function buildCartOutfitName(itemCount: number) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date());

  return `Outfit ${formattedDate} · ${itemCount} ${itemCount === 1 ? "piece" : "pieces"}`;
}

interface ClosetFilterMenuProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggleValue: (value: string) => void;
}

function updateUserItem(user: User | null, nextItem: ClothingItem) {
  if (!user || user.id !== nextItem.user_id) {
    return user;
  }

  return {
    ...user,
    clothing_items: user.clothing_items
      .map((item) => (item.id === nextItem.id ? nextItem : item))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function removeUserItem(user: User | null, itemId: number) {
  if (!user) {
    return user;
  }

  const nextItems = user.clothing_items.filter((item) => item.id !== itemId);
  const removed = nextItems.length !== user.clothing_items.length;

  return {
    ...user,
    clothing_items: nextItems,
    clothing_items_count: removed
      ? Math.max(0, user.clothing_items_count - 1)
      : user.clothing_items_count,
  };
}

function formatFilterMenuTrigger(label: string, selectedValues: string[]) {
  if (selectedValues.length === 0) {
    return label;
  }

  const formattedValues = selectedValues.map(titleize);
  if (formattedValues.length === 1) {
    return formattedValues[0];
  }

  return `${formattedValues[0]} +${formattedValues.length - 1}`;
}

function ClosetFilterMenu({
  label,
  options,
  selectedValues,
  onToggleValue,
}: ClosetFilterMenuProps) {
  const triggerLabel = formatFilterMenuTrigger(label, selectedValues);
  const hasSelections = selectedValues.length > 0;
  const filterDescription = `Filter closet items by ${label.toLowerCase()}`;

  return (
    <div className="relative">
      <PrimitiveDropdownMenu>
        <PrimitiveDropdownMenuTrigger asChild>
          <PrimitiveDropdownTriggerButton
            disabled={options.length === 0}
            className={hasSelections ? "pr-14" : "pr-8"}
            aria-label={filterDescription}
          >
            {triggerLabel}
          </PrimitiveDropdownTriggerButton>
        </PrimitiveDropdownMenuTrigger>
        <PrimitiveDropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
          <PrimitiveDropdownMenuLabel>{label}</PrimitiveDropdownMenuLabel>
          <PrimitiveDropdownMenuSeparator />
          {options.map((option) => (
            <PrimitiveDropdownMenuCheckboxItem
              key={option}
              checked={selectedValues.includes(option)}
              onCheckedChange={() => onToggleValue(option)}
              onSelect={(event) => event.preventDefault()}
            >
              {titleize(option)}
            </PrimitiveDropdownMenuCheckboxItem>
          ))}
        </PrimitiveDropdownMenuContent>
      </PrimitiveDropdownMenu>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [user, setUser] = useState<User | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [homeMessage, setHomeMessage] = useState<HomeMessageState | null>(null);
  const [isOutfitCartOpen, setIsOutfitCartOpen] = useState(false);
  const [isOutfitCreatedDialogOpen, setIsOutfitCreatedDialogOpen] = useState(false);
  const [isCreatingOutfitFromCart, setIsCreatingOutfitFromCart] = useState(false);
  const [isClearingOutfitCart, setIsClearingOutfitCart] = useState(false);
  const [outfitsCache, setOutfitsCache] = useState<Outfit[]>([]);
  const [hasLoadedOutfits, setHasLoadedOutfits] = useState(false);
  const [isLoadingOutfits, setIsLoadingOutfits] = useState(false);
  const [outfitsErrorMessage, setOutfitsErrorMessage] = useState("");
  const [outfitCartErrorMessage, setOutfitCartErrorMessage] = useState("");
  const [outfitCartName, setOutfitCartName] = useState("");
  const [isGeneratingOutfitCart, setIsGeneratingOutfitCart] = useState(false);
  const [outfitCartGenerationMessage, setOutfitCartGenerationMessage] = useState<OutfitCartGenerationMessage | null>(null);
  const [outfitCartStatusMessage, setOutfitCartStatusMessage] = useState("");
  const [isTopOutfitCartButtonVisible, setIsTopOutfitCartButtonVisible] = useState(true);
  const topOutfitCartButtonRef = useRef<HTMLSpanElement | null>(null);
  const outfitCartGenerationRequestIdRef = useRef(0);
  const [outfitDraft, setOutfitDraft] = useOutfitDraftState(user);
  const {
    cancel: cancelGenerationTask,
    dismiss: dismissGenerationTask,
    tasks: generationTasks,
    track: trackGenerationTask,
    updateTracked: updateTrackedGenerationTask,
  } = useGenerationTaskManager({
    ownerId: user?.id,
    onWorkflowUpdated: async (workflow, _reason, signal) => {
      if (workflow.kind === "modeled_outfit") {
        const outfitId = Number(workflow.metadata?.outfit_id);
        if (outfitId) {
          setOutfitsCache((current) => current.map((outfit) => (
            outfit.id === outfitId ? { ...outfit, modeled_workflow: workflow } : outfit
          )));
        }
      }

      if (["succeeded", "cancelled"].includes(workflow.status) && workflow.kind === "item_clean") {
        const itemId = Number(workflow.metadata?.item_id);
        if (itemId) {
          const nextItem = await fetchClothingItem(itemId, signal);
          setUser((current) => updateUserItem(current, nextItem));
          syncCachedOutfitItem(nextItem);
        }
      }

    },
  });

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const authError = query.get("auth_error");
    if (!authError) {
      return;
    }

    setHomeMessage({ kind: "error", text: authErrorMessage(authError) });
    query.delete("auth_error");

    const nextSearch = query.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [route.kind]);

  useEffect(() => {
    const shouldLoadSession = route.kind === "home" || isProtectedRoute(route);
    const unauthorizedMessage = "You do not have permission to view this page. Please log in.";

    if (!shouldLoadSession) {
      setIsLoading(false);
      return;
    }

    if (user) {
      setIsLoading(false);
      setErrorMessage("");
      return;
    }

    if (hasLoadedSession) {
      setIsLoading(false);
      setErrorMessage("");
      if (isProtectedRoute(route)) {
        setHomeMessage({ kind: "error", text: unauthorizedMessage });
        navigateTo("/");
      }
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextUser = await fetchCurrentUser(controller.signal);
        if (!nextUser) {
          setUser(null);
          setHasLoadedSession(true);
          if (isProtectedRoute(route)) {
            setHomeMessage({ kind: "error", text: unauthorizedMessage });
            navigateTo("/");
          }
          return;
        }

        setHomeMessage((current) => (current?.kind === "error" ? null : current));
        setUser(nextUser);
        setHasLoadedSession(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load closet data from the backend.",
          );
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [hasLoadedSession, route, user]);

  useEffect(() => {
    setOutfitsCache([]);
    setHasLoadedOutfits(false);
    setIsLoadingOutfits(false);
    setOutfitsErrorMessage("");
  }, [user?.id]);

  useEffect(() => {
    if (!user || (route.kind !== "outfits" && route.kind !== "magazines") || hasLoadedOutfits) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsLoadingOutfits(true);
      setOutfitsErrorMessage("");

      try {
        const nextOutfits = await fetchOutfits(controller.signal);
        setOutfitsCache(nextOutfits);
        setHasLoadedOutfits(true);
      } catch (error) {
        if (!controller.signal.aborted) {
          setOutfitsErrorMessage(error instanceof Error ? error.message : "Unable to load outfits.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOutfits(false);
        }
      }
    })();

    return () => controller.abort();
  }, [hasLoadedOutfits, route.kind, user]);

  useEffect(() => {
    if (!outfitCartStatusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOutfitCartStatusMessage("");
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [outfitCartStatusMessage]);

  useEffect(() => {
    if (!user || !isClosetRoute(route)) {
      setIsTopOutfitCartButtonVisible(true);
      return;
    }

    const node = topOutfitCartButtonRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsTopOutfitCartButtonVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsTopOutfitCartButtonVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [route, user]);

  useEffect(() => {
    if (route.kind === "home" && user) {
      navigateTo("/closet");
    }
  }, [route.kind, user]);

  useEffect(() => {
    if (user) {
      return;
    }

    setIsOutfitCartOpen(false);
    setIsOutfitCreatedDialogOpen(false);
    setOutfitCartName("");
    setOutfitCartErrorMessage("");
    setIsGeneratingOutfitCart(false);
    setOutfitCartGenerationMessage(null);
    outfitCartGenerationRequestIdRef.current += 1;
    setOutfitCartStatusMessage("");
  }, [user]);

  const clothingItems = user?.clothing_items ?? [];
  const closetControls = useClosetControls(clothingItems);
  const outfitDraftItems = outfitDraft.itemIds
    .map((itemId) => clothingItems.find((item) => item.id === itemId))
    .filter((item): item is ClothingItem => Boolean(item));
  const outfitCartBadgeLabel =
    outfitDraftItems.length > 9 ? "9+" : String(outfitDraftItems.length);
  const isLoggedOutProtectedRoute = isProtectedRoute(route) && !user;
  const closetTitle = user ? formatPossessive(titleize(user.username)) : "Your Closet";
  const preferredStyle = formatPreferredStyle(user?.preferred_style);
  const selectedItem =
    route.kind === "item"
      ? clothingItems.find((item) => item.id === route.itemId) ?? null
      : null;
  const selectedItemModeledWorkflow = route.kind === "item"
    ? Object.values(generationTasks).find((task) => (
        task.workflow.kind === "modeled_item"
        && Number(task.workflow.metadata?.item_id) === route.itemId
      ))?.workflow ?? null
    : null;
  const selectedItemCleanWorkflow = route.kind === "item"
    ? Object.values(generationTasks).find((task) => (
        task.workflow.kind === "item_clean"
        && Number(task.workflow.metadata?.item_id) === route.itemId
      ))?.workflow ?? null
    : null;
  const resumableOutfitUploadIds = Array.from(new Set(Object.values(generationTasks)
    .filter((task) => (
      task.workflow.kind === "outfit_upload"
      && !["failed", "cancelled"].includes(task.workflow.status)
    ))
    .map((task) => Number(task.workflow.metadata?.upload_id))
    .filter((uploadId) => uploadId > 0)));
  const isAdminRoute = route.kind === "users" || route.kind === "user";
  const isUnauthorizedAdminRoute = Boolean(user && !user.admin && isAdminRoute);
  const {
    clearAll,
    filteredItems: filteredClothingItems,
    filterOptions,
    hasActiveFilters,
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedTypes,
    setSearchQuery,
    setSortOption,
    sortOption,
    suggestions: closetSearchSuggestions,
    toggleBrand,
    toggleColor,
    toggleType,
    typeOptions,
  } = closetControls;
  const {
    hasMore: hasMoreClothingItems,
    sentinelRef: clothingItemsSentinelRef,
    visibleItems: visibleClothingItems,
  } = useIncrementalCollection(filteredClothingItems, {
    batchSize: 48,
    resetKey: JSON.stringify({
      searchQuery,
      selectedBrands,
      selectedColors,
      selectedTypes,
      sortOption,
    }),
  });
  const showFloatingOutfitCartButton = Boolean(
    user && isClosetRoute(route) && !isOutfitCartOpen && !isTopOutfitCartButtonVisible,
  );
  const outfitCartStatusMessageClassName = showFloatingOutfitCartButton
    ? "fixed right-20 top-[calc(30%-1.5rem)] z-[70] max-w-[calc(100vw-7rem)] border border-foreground/15 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur sm:max-w-sm"
    : "fixed bottom-6 right-6 z-[70] max-w-sm border border-foreground/15 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur";

  function addItemToOutfitDraft(itemId: number) {
    if (outfitDraft.itemIds.includes(itemId)) {
      return;
    }

    setOutfitCartStatusMessage("Item added successfully.");
    setOutfitCartErrorMessage("");
    setOutfitCartGenerationMessage(null);
    setIsGeneratingOutfitCart(false);
    outfitCartGenerationRequestIdRef.current += 1;
    setOutfitDraft((current) => ({
      ...current,
      itemIds: [itemId, ...current.itemIds],
    }));
  }

  function removeItemFromOutfitDraft(itemId: number) {
    setOutfitCartStatusMessage("Item removed from outfit.");
    setOutfitCartGenerationMessage(null);
    setIsGeneratingOutfitCart(false);
    outfitCartGenerationRequestIdRef.current += 1;
    setOutfitDraft((current) => ({
      ...current,
      itemIds: current.itemIds.filter((id) => id !== itemId),
    }));
  }

  function upsertCachedOutfit(nextOutfit: Outfit) {
    setOutfitsCache((current) => [
      nextOutfit,
      ...current.filter((outfit) => outfit.id !== nextOutfit.id),
    ]);
  }

  function replaceCachedOutfit(nextOutfit: Outfit) {
    setOutfitsCache((current) =>
      current.map((outfit) => (outfit.id === nextOutfit.id ? nextOutfit : outfit)),
    );
  }

  function updateCachedOutfitModeledWorkflow(outfitId: number, workflow: AiWorkflow) {
    const outfitName = outfitsCache.find((outfit) => outfit.id === outfitId)?.name ?? `Outfit ${outfitId}`;

    setOutfitsCache((current) =>
      current.map((outfit) => (
        outfit.id === outfitId ? { ...outfit, modeled_workflow: workflow } : outfit
      )),
    );

    updateTrackedGenerationTask(workflow, outfitName);
  }

  function openGenerationResult(workflow: AiWorkflow) {
    if (["item_clean", "modeled_item"].includes(workflow.kind)) {
      const itemId = Number(workflow.metadata?.item_id);
      navigateTo(itemId ? `/items/${itemId}` : "/closet");
      return;
    }

    if (workflow.kind === "outfit_upload") {
      navigateTo("/items/new/image");
      return;
    }

    if (workflow.kind === "outfit_recommendation") {
      navigateTo("/closet");
      setIsOutfitCartOpen(true);
      return;
    }

    navigateTo("/outfits");
  }

  function removeCachedOutfit(outfitId: number) {
    setOutfitsCache((current) => current.filter((outfit) => outfit.id !== outfitId));
  }

  function syncCachedOutfitItem(nextItem: ClothingItem) {
    setOutfitsCache((current) =>
      current.map((outfit) => ({
        ...outfit,
        items: outfit.items.map((item) => (item.id === nextItem.id ? nextItem : item)),
      })),
    );
  }

  function removeCachedOutfitItem(itemId: number) {
    setOutfitsCache((current) =>
      current.map((outfit) => ({
        ...outfit,
        item_ids: outfit.item_ids.filter((id) => id !== itemId),
        items: outfit.items.filter((item) => item.id !== itemId),
      })),
    );
  }

  async function handleCreateOutfitFromCart() {
    if (!user || outfitDraft.itemIds.length === 0) {
      return;
    }

    setIsCreatingOutfitFromCart(true);
    setOutfitCartErrorMessage("");

    try {
      const tags = parseTagInput(outfitDraft.tagInput);

      const createdOutfit = await createOutfit({
        userId: user.id,
        name: outfitCartName.trim() || buildCartOutfitName(outfitDraft.itemIds.length),
        itemIds: outfitDraft.itemIds,
        notes: outfitDraft.notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        recommendationOptionId: outfitDraft.recommendationOptionId,
      });

      if (hasLoadedOutfits) {
        upsertCachedOutfit(createdOutfit);
      }

      setOutfitDraft(emptyOutfitDraft());
      setOutfitCartName("");
      setOutfitCartGenerationMessage(null);
      setIsOutfitCartOpen(false);
      setIsOutfitCreatedDialogOpen(true);
      setOutfitCartStatusMessage("Outfit created.");
    } catch (error) {
      setOutfitCartErrorMessage(
        error instanceof Error ? error.message : "Unable to create this outfit right now.",
      );
    } finally {
      setIsCreatingOutfitFromCart(false);
    }
  }

  async function handleClearOutfitCart() {
    if (outfitDraft.itemIds.length === 0 && !outfitCartName.trim() && !outfitDraft.tagInput.trim() && !outfitDraft.notes.trim()) {
      return;
    }

    setIsClearingOutfitCart(true);
    setOutfitCartErrorMessage("");
    let feedbackError = false;

    try {
      if (outfitDraft.recommendationRunId && outfitDraft.recommendationOptionId) {
        try {
          await discardOutfitRecommendation({
            runId: outfitDraft.recommendationRunId,
            optionId: outfitDraft.recommendationOptionId,
          });
        } catch {
          feedbackError = true;
        }
      }

      setOutfitDraft(emptyOutfitDraft());
      setOutfitCartName("");
      setOutfitCartGenerationMessage(null);
      setOutfitCartStatusMessage(
        feedbackError
          ? "Outfit cleared, but its AI feedback could not be saved."
          : "Outfit cleared.",
      );
    } finally {
      setIsClearingOutfitCart(false);
    }
  }

  async function handleGenerateOutfitCart() {
    if (!user) return;

    const requestId = outfitCartGenerationRequestIdRef.current + 1;
    const lockedItemIds = [...outfitDraft.itemIds];
    const draftMetadata = {
      name: outfitCartName.trim(),
      tags: parseTagInput(outfitDraft.tagInput),
      notes: outfitDraft.notes.trim(),
    };
    const prompt = outfitCartGenerationPrompt(outfitDraft, outfitCartName);
    outfitCartGenerationRequestIdRef.current = requestId;
    setIsGeneratingOutfitCart(true);
    setOutfitCartGenerationMessage(null);
    setOutfitCartErrorMessage("");

    try {
      let analysisStatus = await fetchWardrobeAnalysisStatus();
      if (!analysisStatus.complete) {
        analysisStatus = await startWardrobeAnalysis();
        if (analysisStatus.workflow) trackGenerationTask(analysisStatus.workflow, "your closet");

        while (!analysisStatus.complete) {
          await waitForOutfitGenerationPoll(1400);
          if (outfitCartGenerationRequestIdRef.current !== requestId) return;
          analysisStatus = await fetchWardrobeAnalysisStatus();
          if (analysisStatus.workflow) trackGenerationTask(analysisStatus.workflow, "your closet");
          if (!analysisStatus.complete && !analysisStatus.workflow) {
            throw new Error("Closet preparation stopped before it finished. Try the sparkle button again.");
          }
        }
      }
      if (analysisStatus.ready === 0) throw new Error("Add a photographed closet item before generating an outfit.");
      if (outfitCartGenerationRequestIdRef.current !== requestId) return;

      let result = await generateOutfitRecommendations({ prompt, lockedItemIds, draftMetadata });
      if (result.workflow) trackGenerationTask(result.workflow, "your outfit");
      while (["pending", "processing"].includes(result.status)) {
        await waitForOutfitGenerationPoll(1200);
        if (outfitCartGenerationRequestIdRef.current !== requestId) return;
        result = await fetchOutfitRecommendation(result.id);
        if (result.workflow) trackGenerationTask(result.workflow, "your outfit");
      }
      if (result.status !== "succeeded") {
        throw new Error(result.error_message || "Unable to generate an outfit from this closet.");
      }

      const recommendation = result.recommendations[0];
      if (!recommendation?.item_ids.length) throw new Error("The generator did not return any closet pieces.");

      setOutfitCartName(recommendation.title || outfitCartName);
      setOutfitDraft((current) => ({
        ...current,
        itemIds: recommendation.item_ids,
        notes: recommendation.summary || current.notes,
        recommendationRunId: result.id,
        recommendationOptionId: recommendation.id,
      }));

      try {
        const suggestion = await generateOutfitMetadataSuggestions({
          itemIds: recommendation.item_ids,
          name: draftMetadata.name || recommendation.title,
          notes: draftMetadata.notes,
          tags: draftMetadata.tags,
        });
        if (outfitCartGenerationRequestIdRef.current !== requestId) return;
        setOutfitCartName(suggestion.name || recommendation.title || outfitCartName);
        setOutfitDraft((current) => ({
          ...current,
          itemIds: recommendation.item_ids,
          notes: suggestion.notes,
          tagInput: formatTagInput(suggestion.tags),
          recommendationRunId: result.id,
          recommendationOptionId: recommendation.id,
        }));
        setOutfitCartGenerationMessage({
          kind: "success",
          text: "Outfit added to your cart with editable details.",
        });
      } catch {
        setOutfitCartGenerationMessage({
          kind: "success",
          text: "Outfit added to your cart. You can edit its details before creating it.",
        });
      }
    } catch (error) {
      if (outfitCartGenerationRequestIdRef.current !== requestId) return;
      setOutfitCartGenerationMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to generate an outfit.",
      });
    } finally {
      if (outfitCartGenerationRequestIdRef.current === requestId) {
        setIsGeneratingOutfitCart(false);
      }
    }
  }

  function handleBackToClosetFromOutfitDialog() {
    setIsOutfitCreatedDialogOpen(false);
    navigateTo("/closet");
  }

  function handleGoToOutfitsFromDialog() {
    setIsOutfitCreatedDialogOpen(false);
    navigateTo("/outfits");
  }

  async function handleLogout() {
    try {
      await logoutSession();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign out right now.");
      return;
    }

    setUser(null);
    setHasLoadedSession(true);
    setHomeMessage({ kind: "success", text: "Signed out successfully." });
    navigateTo("/");
  }

  const shouldRenderStandaloneAuthPage = !user && (route.kind === "home" || isLoggedOutProtectedRoute);

  let pageContent;

  if ((route.kind === "home" || isLoggedOutProtectedRoute) && isLoading) {
    return <div className={`min-h-screen ${route.kind === "magazine-reader" ? "bg-[#191714]" : "bg-background"}`} />;
  }

  if ((!user && route.kind === "home") || (isLoggedOutProtectedRoute && !isLoading)) {
    pageContent = <HomeLanding homeMessage={homeMessage} />;
  } else if (route.kind === "about") {
    pageContent = <AboutPage />;
  } else if (route.kind === "privacy") {
    pageContent = <PrivacyPage />;
  } else if (route.kind === "terms") {
    pageContent = <TermsPage />;
  } else if (route.kind === "not-found") {
    pageContent = <NotFoundPage signedIn={Boolean(user)} />;
  } else if (isUnauthorizedAdminRoute) {
    pageContent = (
      <AccessRestrictedState
        backLabel="Back"
        message="You're not authorized to view this page."
        onBack={() => navigateTo("/closet")}
      />
    );
  } else if (route.kind === "users") {
    pageContent = (
      <UsersDirectoryPage
        onBack={() => navigateTo(user ? "/closet" : "/")}
        onSelectUser={(userId) => navigateTo(`/users/${userId}`)}
      />
    );
  } else if (route.kind === "user") {
    const selectedUser = user?.id === route.userId ? user : null;

    pageContent = (
      <UserDetailPage
        userId={route.userId}
        initialUser={selectedUser}
        onBack={() => navigateTo(user ? "/closet" : "/")}
        onOpenItem={(itemId) => navigateTo(`/items/${itemId}`)}
      />
    );
  } else if (route.kind === "new-item") {
    const targetUser = route.userId && user?.id === route.userId ? user : route.userId ? null : user;
    const targetUserId = route.userId ?? user?.id ?? null;

    pageContent = (
      <CreateItemPage
        key={`${targetUserId ?? "none"}-${route.mode}`}
        userId={targetUserId}
        initialMode={route.mode}
        initialUser={targetUser}
        initialOutfitUploadIds={route.mode === "image" ? resumableOutfitUploadIds : []}
        onBack={() => navigateTo("/closet")}
        onGenerationTaskStarted={trackGenerationTask}
        onItemsCreated={(nextItems) => {
          setUser((current) => {
            if (!current || current.id !== targetUserId || nextItems.length === 0) {
              return current;
            }

            return {
              ...current,
              clothing_items: [...current.clothing_items, ...nextItems].sort((left, right) =>
                left.name.localeCompare(right.name),
              ),
              clothing_items_count: current.clothing_items_count + nextItems.length,
            };
          });

          if (route.mode === "image") {
            navigateTo("/closet");
            return;
          }

          navigateTo(`/items/${nextItems[0].id}`);
        }}
      />
    );
  } else if (route.kind === "item") {
    const closetSuggestions = collectClosetSuggestions(user?.clothing_items ?? []);

    pageContent = (
      <ItemDetailPage
        brandSuggestions={closetSuggestions.brandSuggestions}
        backgroundCleanWorkflow={selectedItemCleanWorkflow}
        backgroundModeledWorkflow={selectedItemModeledWorkflow}
        canUseModeledPreview={Boolean(user?.model_reference_photo_attached && user.model_reference_consent_at)}
        itemId={route.itemId}
        initialItem={selectedItem}
        onBack={() => navigateTo("/closet")}
        onGenerationTaskStarted={trackGenerationTask}
        tagSuggestions={closetSuggestions.tagSuggestions}
        onItemSaved={(nextItem) => {
          setUser((current) => updateUserItem(current, nextItem));
          syncCachedOutfitItem(nextItem);
        }}
        onItemDeleted={(itemId) => {
          setUser((current) => removeUserItem(current, itemId));
          removeCachedOutfitItem(itemId);
          setOutfitDraft((current: OutfitDraft) => ({
            ...current,
            itemIds: current.itemIds.filter((id) => id !== itemId),
          }));
          navigateTo("/closet");
        }}
      />
    );
  } else if (route.kind === "outfits" || route.kind === "magazines") {
    pageContent = user ? (
      <MyOutfitsPage
        pageView={route.kind}
        isLoading={isLoadingOutfits || (!hasLoadedOutfits && !outfitsErrorMessage)}
        loadErrorMessage={outfitsErrorMessage}
        onOutfitDeleted={removeCachedOutfit}
        onOutfitModeledWorkflowUpdated={updateCachedOutfitModeledWorkflow}
        onOutfitUpdated={replaceCachedOutfit}
        outfits={outfitsCache}
        canUseModeledPreview={Boolean(user.model_reference_photo_attached && user.model_reference_consent_at)}
        user={user}
      />
    ) : null;
  } else if (route.kind === "decorations") {
    pageContent = (
      <MyDecorationsPage
        onDecorationDeleted={(decorationId) => {
          setOutfitsCache((current) => current.map((outfit) => ({
            ...outfit,
            decorations: outfit.decorations?.filter((placement) => placement.decoration_id !== decorationId),
          })));
        }}
        onDecorationUpdated={(decoration) => {
          setOutfitsCache((current) => current.map((outfit) => ({
            ...outfit,
            decorations: outfit.decorations?.map((placement) => (
              placement.decoration_id === decoration.id
                ? { ...placement, image_url: decoration.image_url, name: decoration.name }
                : placement
            )),
          })));
        }}
      />
    );
  } else if (route.kind === "magazine-editor") {
    pageContent = <MagazineEditorPage magazineId={route.magazineId} />;
  } else if (route.kind === "magazine-reader") {
    pageContent = <MagazineReaderPage magazineId={route.magazineId} />;
  } else {
    pageContent = (
      <CollectionPageShell>
        <CollectionPageHeader
          title={closetTitle}
          description={isLoading
            ? "Loading your closet…"
            : `${clothingItems.length} ${clothingItems.length === 1 ? "item" : "items"}${
                preferredStyle ? ` · ${preferredStyle} style` : ""
              }`}
          actions={(
            <>
            <AddItemMenu
              disabled={!user}
              onSelectImage={() => {
                if (!user) {
                  return;
                }

                navigateTo(`/items/new?userId=${user.id}&mode=image`);
              }}
              onSelectManual={() => {
                if (!user) {
                  return;
                }

                navigateTo(`/items/new?userId=${user.id}&mode=manual`);
              }}
            />
            <span ref={topOutfitCartButtonRef} className="inline-flex">
              <PrimitiveButton
                type="button"
                variant="outline"
                onClick={() => setIsOutfitCartOpen(true)}
                disabled={!user}
                aria-label={`Open outfit cart with ${outfitDraftItems.length} ${
                  outfitDraftItems.length === 1 ? "item" : "items"
                }`}
                className="relative h-auto gap-3 px-5 py-3"
              >
                <span className="relative inline-flex">
                  <ShoppingBag className="h-4 w-4" />
                  {outfitDraftItems.length > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold leading-none text-background">
                      {outfitCartBadgeLabel}
                    </span>
                  ) : null}
                </span>
                <PrimitiveText as="span" variant="bodySm">
                  Outfit Cart
                </PrimitiveText>
              </PrimitiveButton>
            </span>
            </>
          )}
        />

        {errorMessage ? (
          <VisualStatePanel
            icon={CircleAlert}
            overline="Unable to load"
            title="The closet data could not be loaded"
            description={`${errorMessage}. Make sure both dev servers are running through ./start.sh.`}
            tone="destructive"
          />
        ) : isLoading ? (
          <CollectionGridSkeleton count={4} label="Loading closet items" mediaClassName="aspect-[5/6] sm:aspect-[3/4]" variant="wardrobe" />
        ) : (
          <>
            <CollectionToolbar className="space-y-5">
              <div className="space-y-3 min-[660px]:grid min-[660px]:gap-3 min-[660px]:space-y-0 min-[660px]:grid-cols-[minmax(0,3.2fr)_repeat(3,minmax(0,0.8fr))_minmax(0,1fr)] min-[660px]:items-start">
                <div className="min-w-0 self-start">
                  <label htmlFor="closet-search" className="sr-only">
                    Search closet items
                  </label>
                  <ClosetSearchField
                    id="closet-search"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClear={clearAll}
                    showClear={hasActiveFilters}
                    suggestions={closetSearchSuggestions}
                    onSelectSuggestion={(item) =>
                      setSearchQuery(formatClosetSearchSuggestionLabel(item))
                    }
                    onOpenItem={(item) => navigateTo(`/items/${item.id}`)}
                    placeholder="Search by name or describe an item"
                  />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1 min-[660px]:contents">
                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Types"
                      options={typeOptions}
                      selectedValues={selectedTypes}
                      onToggleValue={toggleType}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Colors"
                      options={filterOptions.colors}
                      selectedValues={selectedColors}
                      onToggleValue={toggleColor}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Brands"
                      options={filterOptions.brands}
                      selectedValues={selectedBrands}
                      onToggleValue={toggleBrand}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <label id="closet-sort-label" className="sr-only">
                      Sort closet items
                    </label>
                    <PrimitiveSelect value={sortOption} onValueChange={setSortOption}>
                      <PrimitiveSelectTrigger
                        aria-labelledby="closet-sort-label"
                        className="h-14 w-full gap-1.5 bg-stone-200 px-2.5 hover:bg-stone-200"
                      >
                        <PrimitiveSelectValue placeholder="Sort items" />
                      </PrimitiveSelectTrigger>
                      <PrimitiveSelectContent>
                        <PrimitiveSelectItem value="name-asc">Name A-Z</PrimitiveSelectItem>
                        <PrimitiveSelectItem value="newest-added">Newest added</PrimitiveSelectItem>
                        <PrimitiveSelectItem value="oldest-added">Oldest added</PrimitiveSelectItem>
                      </PrimitiveSelectContent>
                    </PrimitiveSelect>
                  </div>
                </div>
              </div>

            </CollectionToolbar>

            {user && filteredClothingItems.length > 0 ? (
              <CollectionGrid variant="wardrobe">
                {visibleClothingItems.map((item) => (
                  <ClothingCard
                    key={item.id}
                    {...item}
                    onSelect={(itemId) => navigateTo(`/items/${itemId}`)}
                    isInOutfit={outfitDraft.itemIds.includes(item.id)}
                    onAddToOutfit={addItemToOutfitDraft}
                    onRemoveFromOutfit={removeItemFromOutfitDraft}
                  />
                ))}
              </CollectionGrid>
            ) : user ? (
              <ClosetEmptyState
                hasActiveFilters={hasActiveFilters}
                onSelectImage={
                  hasActiveFilters
                    ? undefined
                    : () => navigateTo(`/items/new?userId=${user.id}&mode=image`)
                }
                onSelectManual={
                  hasActiveFilters
                    ? undefined
                    : () => navigateTo(`/items/new?userId=${user.id}&mode=manual`)
                }
              />
            ) : (
              <ClosetEmptyState hasActiveFilters={false} />
            )}
            {user && filteredClothingItems.length > 0 ? (
              <InfiniteCollectionSentinel
                hasMore={hasMoreClothingItems}
                label="Loading more closet items…"
                sentinelRef={clothingItemsSentinelRef}
              />
            ) : null}
          </>
        )}
      </CollectionPageShell>
    );
  }

  if (shouldRenderStandaloneAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <main id="main-content" className="flex flex-1 flex-col">
          <Suspense fallback={<RouteLoadingState />}>{pageContent}</Suspense>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (route.kind === "magazine-reader" && user) {
    return <Suspense fallback={<RouteLoadingState />}>{pageContent}</Suspense>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <SiteHeader
        route={route}
        user={user}
        onSignOut={() => void handleLogout()}
        onUserUpdated={setUser}
      />

      <main
        id="main-content"
        className={`${isPublicInfoRoute(route) ? "" : "flex-1"} ${route.kind === "home" ? "flex" : ""}`}
      >
        <Suspense fallback={<RouteLoadingState />}>{pageContent}</Suspense>
      </main>

      <OutfitCartSheet
        generationMessage={outfitCartGenerationMessage}
        createErrorMessage={outfitCartErrorMessage}
        isGeneratingOutfit={isGeneratingOutfitCart}
        isClearingOutfit={isClearingOutfitCart}
        isCreating={isCreatingOutfitFromCart}
        isOpen={isOutfitCartOpen}
        items={outfitDraftItems}
        notes={outfitDraft.notes}
        onGenerateOutfit={() => void handleGenerateOutfitCart()}
        onClearOutfit={() => void handleClearOutfitCart()}
        onCreateOutfit={() => void handleCreateOutfitFromCart()}
        onNotesChange={(value) =>
          setOutfitDraft((current) => ({
            ...current,
            notes: value,
          }))
        }
        onOpenChange={setIsOutfitCartOpen}
        onOutfitNameChange={setOutfitCartName}
        onRemoveItem={removeItemFromOutfitDraft}
        onTagInputChange={(value) =>
          setOutfitDraft((current) => ({
            ...current,
            tagInput: value,
          }))
        }
        outfitName={outfitCartName}
        tagInput={outfitDraft.tagInput}
      />

      <OutfitCreatedDialog
        isOpen={isOutfitCreatedDialogOpen}
        onBackToCloset={handleBackToClosetFromOutfitDialog}
        onGoToOutfits={handleGoToOutfitsFromDialog}
        onOpenChange={setIsOutfitCreatedDialogOpen}
      />

      <AnimatePresence>
        {showFloatingOutfitCartButton ? (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed right-4 top-[calc(30%-1.5rem)] z-[60]"
          >
            <PrimitiveButton
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setIsOutfitCartOpen(true)}
              aria-label={`Open outfit cart with ${outfitDraftItems.length} ${
                outfitDraftItems.length === 1 ? "item" : "items"
              }`}
              className="relative h-12 w-12 rounded-full border-foreground/15 bg-background/95 shadow-lg backdrop-blur hover:bg-background"
            >
              <ShoppingBag className="h-5 w-5" />
              {outfitDraftItems.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold leading-none text-background">
                  {outfitCartBadgeLabel}
                </span>
              ) : null}
            </PrimitiveButton>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {outfitCartStatusMessage}
      </div>

      <AnimatePresence>
        {outfitCartStatusMessage ? (
          <motion.div
            key={outfitCartStatusMessage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={outfitCartStatusMessageClassName}
            aria-hidden="true"
          >
            {outfitCartStatusMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GenerationTaskToasts
        tasks={Object.values(generationTasks)}
        onCancel={(workflowId) => void cancelGenerationTask(workflowId)}
        onDismiss={dismissGenerationTask}
        onOpen={openGenerationResult}
      />

      <SiteFooter />
    </div>
  );
}
