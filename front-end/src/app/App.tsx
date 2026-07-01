import { Dispatch, SetStateAction, useDeferredValue, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag } from "lucide-react";
import { AddItemMenu } from "./components/AddItemMenu";
import { ClothingCard } from "./components/ClothingCard";
import { CreateItemPage } from "./components/CreateItemPage";
import { ItemDetailPage } from "./components/ItemDetailPage";
import { MyOutfitsPage } from "./components/MyOutfitsPage";
import { OutfitCartSheet } from "./components/OutfitCartSheet";
import { OutfitCreatedDialog } from "./components/OutfitCreatedDialog";
import { UserDetailPage } from "./components/UserDetailPage";
import { UsersDirectoryPage } from "./components/UsersDirectoryPage";
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
import { HomeFooterLinks } from "./components/info/HomeFooterLinks";
import { PrivacyPage } from "./components/info/PrivacyPage";
import { TermsPage } from "./components/info/TermsPage";
import { AccessRestrictedState } from "./components/shared/AccessRestrictedState";
import { ClosetEmptyState } from "./components/shared/ClosetEmptyState";
import { HomeLanding } from "./components/shared/HomeLanding";
import { NotFoundPage } from "./components/shared/NotFoundPage";
import { SiteFooter } from "./components/shared/SiteFooter";
import { SiteHeader } from "./components/shared/SiteHeader";
import { ClosetSearchField } from "./components/ClosetSearchField";
import {
  ClothingItem,
  createOutfit,
  fetchOutfits,
  fetchCurrentUser,
  formatPossessive,
  formatPreferredStyle,
  logoutSession,
  Outfit,
  OutfitDraft,
  parseTagInput,
  titleize,
  User,
} from "./lib/closet";
import {
  buildGroupedTagOptions,
  ClosetSortOption,
  filterClothingItems,
  formatClosetSearchSuggestionLabel,
  getClosetSearchSuggestions,
  hasActiveClosetControls,
} from "./lib/closetFilters";
import {
  AppRoute,
  authErrorMessage,
  getRouteFromLocation,
  isClosetRoute,
  isOutfitRoute,
  isPublicInfoRoute,
  isProtectedRoute,
  isUsersRoute,
  navigateTo,
} from "./lib/routes";
import { collectClosetSuggestions } from "./lib/itemFormValidation";
import { useOutfitDraftState } from "./lib/useOutfitDraftState";

interface HomeMessageState {
  kind: "error" | "success";
  text: string;
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
  onClear: () => void;
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
  onClear,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOtherTags, setSelectedOtherTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<ClosetSortOption>("name-asc");
  const [isOutfitCartOpen, setIsOutfitCartOpen] = useState(false);
  const [isOutfitCreatedDialogOpen, setIsOutfitCreatedDialogOpen] = useState(false);
  const [isCreatingOutfitFromCart, setIsCreatingOutfitFromCart] = useState(false);
  const [outfitsCache, setOutfitsCache] = useState<Outfit[]>([]);
  const [hasLoadedOutfits, setHasLoadedOutfits] = useState(false);
  const [isLoadingOutfits, setIsLoadingOutfits] = useState(false);
  const [outfitsErrorMessage, setOutfitsErrorMessage] = useState("");
  const [outfitCartErrorMessage, setOutfitCartErrorMessage] = useState("");
  const [outfitCartName, setOutfitCartName] = useState("");
  const [outfitCartStatusMessage, setOutfitCartStatusMessage] = useState("");
  const [isTopOutfitCartButtonVisible, setIsTopOutfitCartButtonVisible] = useState(true);
  const topOutfitCartButtonRef = useRef<HTMLSpanElement | null>(null);
  const [outfitDraft, setOutfitDraft] = useOutfitDraftState(user);

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
    if (!user || route.kind !== "outfits" || hasLoadedOutfits) {
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
    setOutfitCartStatusMessage("");
  }, [user]);

  const clothingItems = user?.clothing_items ?? [];
  const outfitDraftItems = outfitDraft.itemIds
    .map((itemId) => clothingItems.find((item) => item.id === itemId))
    .filter((item): item is ClothingItem => Boolean(item));
  const outfitCartBadgeLabel =
    outfitDraftItems.length > 9 ? "9+" : String(outfitDraftItems.length);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isLoggedOutProtectedRoute = isProtectedRoute(route) && !user;
  const closetTitle = user ? formatPossessive(titleize(user.username)) : "Your Closet";
  const preferredStyle = formatPreferredStyle(user?.preferred_style);
  const selectedItem =
    route.kind === "item"
      ? clothingItems.find((item) => item.id === route.itemId) ?? null
      : null;
  const isAdminRoute = route.kind === "users" || route.kind === "user";
  const isUnauthorizedAdminRoute = Boolean(user && !user.admin && isAdminRoute);
  const groupedTagOptions = buildGroupedTagOptions(clothingItems);
  const filteredClothingItems = filterClothingItems(
    clothingItems,
    deferredSearchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    sortOption,
  );
  const closetSearchSuggestions = getClosetSearchSuggestions(
    clothingItems,
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    sortOption,
    { limit: 8 },
  );
  const hasActiveFilters = hasActiveClosetControls(
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    sortOption,
  );
  const showFloatingOutfitCartButton = Boolean(
    user && isClosetRoute(route) && !isOutfitCartOpen && !isTopOutfitCartButtonVisible,
  );
  const outfitCartStatusMessageClassName = showFloatingOutfitCartButton
    ? "fixed right-20 top-[calc(30%-1.5rem)] z-[70] max-w-[calc(100vw-7rem)] border border-foreground/15 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur sm:max-w-sm"
    : "fixed bottom-6 right-6 z-[70] max-w-sm border border-foreground/15 bg-background/95 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur";

  function toggleSelectedValue(
    value: string,
    setSelectedValues: Dispatch<SetStateAction<string[]>>,
  ) {
    setSelectedValues((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value].sort((left, right) => left.localeCompare(right)),
    );
  }

  function clearSelectedValues(setSelectedValues: Dispatch<SetStateAction<string[]>>) {
    setSelectedValues([]);
  }

  function addItemToOutfitDraft(itemId: number) {
    if (outfitDraft.itemIds.includes(itemId)) {
      return;
    }

    setOutfitCartStatusMessage("Item added successfully.");
    setOutfitCartErrorMessage("");
    setOutfitDraft((current) => ({
      ...current,
      itemIds: [itemId, ...current.itemIds],
    }));
  }

  function removeItemFromOutfitDraft(itemId: number) {
    setOutfitCartStatusMessage("Item removed from outfit.");
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
      });

      if (hasLoadedOutfits) {
        upsertCachedOutfit(createdOutfit);
      }

      setOutfitDraft((current) => ({
        ...current,
        itemIds: [],
        notes: "",
        tagInput: "",
      }));
      setOutfitCartName("");
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
    return <div className="min-h-screen bg-background" />;
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
        onBack={() => navigateTo("/closet")}
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
        itemId={route.itemId}
        initialItem={selectedItem}
        onBack={() => navigateTo("/closet")}
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
  } else if (route.kind === "outfits") {
    pageContent = user ? (
      <MyOutfitsPage
        isLoading={isLoadingOutfits || (!hasLoadedOutfits && !outfitsErrorMessage)}
        loadErrorMessage={outfitsErrorMessage}
        onOutfitDeleted={removeCachedOutfit}
        onOutfitGenerated={upsertCachedOutfit}
        onOutfitUpdated={replaceCachedOutfit}
        outfits={outfitsCache}
        user={user}
      />
    ) : null;
  } else {
    pageContent = (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <PrimitiveText
                as="h1"
                variant="display"
                font="serif"
                className="mb-2 tracking-tight"
                style={{
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  lineHeight: "1",
                }}
              >
                {closetTitle}
              </PrimitiveText>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <PrimitiveText as="p" tone="muted" className="tracking-wide">
                {isLoading
                  ? "Loading items from your backend..."
                  : `${clothingItems.length} ${clothingItems.length === 1 ? "item" : "items"}${
                      preferredStyle ? ` · ${preferredStyle} style` : ""
                    }`}
              </PrimitiveText>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
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
          </motion.div>
        </div>

        {errorMessage ? (
          <div className="border border-destructive/20 bg-destructive/5 p-6">
            <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
              The closet data could not be loaded.
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              {errorMessage}. Make sure both dev servers are running through `./start.sh`.
            </PrimitiveText>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3 animate-pulse">
                <div className="aspect-[3/4] bg-muted" />
                <div className="h-6 w-2/3 bg-muted" />
                <div className="h-4 w-1/2 bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8 space-y-5"
            >
              <div className="space-y-3 min-[660px]:grid min-[660px]:gap-3 min-[660px]:space-y-0 min-[660px]:grid-cols-[minmax(0,3.2fr)_repeat(3,minmax(0,0.8fr))_minmax(0,1fr)] min-[660px]:items-start">
                <div className="min-w-0 self-start">
                  <label htmlFor="closet-search" className="sr-only">
                    Search closet items
                  </label>
                  <ClosetSearchField
                    id="closet-search"
                    value={searchQuery}
                    onChange={setSearchQuery}
                    suggestions={closetSearchSuggestions}
                    onSelectSuggestion={(item) =>
                      setSearchQuery(formatClosetSearchSuggestionLabel(item))
                    }
                    onOpenItem={(item) => navigateTo(`/items/${item.id}`)}
                    placeholder="Search by name or describe an item with tags"
                    className="h-14 pl-10"
                  />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1 min-[660px]:contents">
                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Tags"
                      options={groupedTagOptions.other}
                      selectedValues={selectedOtherTags}
                      onClear={() => clearSelectedValues(setSelectedOtherTags)}
                      onToggleValue={(value) => toggleSelectedValue(value, setSelectedOtherTags)}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Colors"
                      options={groupedTagOptions.colors}
                      selectedValues={selectedColors}
                      onClear={() => clearSelectedValues(setSelectedColors)}
                      onToggleValue={(value) => toggleSelectedValue(value, setSelectedColors)}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <ClosetFilterMenu
                      label="Brands"
                      options={groupedTagOptions.brands}
                      selectedValues={selectedBrands}
                      onClear={() => clearSelectedValues(setSelectedBrands)}
                      onToggleValue={(value) => toggleSelectedValue(value, setSelectedBrands)}
                    />
                  </div>

                  <div className="min-w-[8.5rem] shrink-0 min-[660px]:min-w-0 min-[660px]:shrink">
                    <label id="closet-sort-label" className="sr-only">
                      Sort closet items
                    </label>
                    <PrimitiveSelect value={sortOption} onValueChange={(value) => setSortOption(value as ClosetSortOption)}>
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

              {hasActiveFilters ? (
                <div className="flex items-center justify-between gap-4 border border-border bg-card px-4 py-3">
                  <PrimitiveText as="p" tone="muted">
                    Refine your closet with free-text search, tag filters, and sorting.
                  </PrimitiveText>
                  <PrimitiveButton
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedOtherTags([]);
                      setSelectedColors([]);
                      setSelectedBrands([]);
                      setSortOption("name-asc");
                    }}
                  >
                    Clear filters
                  </PrimitiveButton>
                </div>
              ) : null}

            </motion.div>

            {user && filteredClothingItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
                {filteredClothingItems.map((item) => (
                  <ClothingCard
                    key={item.id}
                    {...item}
                    onSelect={(itemId) => navigateTo(`/items/${itemId}`)}
                    isInOutfit={outfitDraft.itemIds.includes(item.id)}
                    onAddToOutfit={addItemToOutfitDraft}
                    onRemoveFromOutfit={removeItemFromOutfitDraft}
                  />
                ))}
              </div>
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
          </>
        )}
      </div>
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
          {pageContent}
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <SiteHeader route={route} user={user} onSignOut={() => void handleLogout()} />

      <main
        id="main-content"
        className={`${isPublicInfoRoute(route) ? "" : "flex-1"} ${route.kind === "home" ? "flex" : ""}`}
      >
        {pageContent}
      </main>

      <OutfitCartSheet
        createErrorMessage={outfitCartErrorMessage}
        isCreating={isCreatingOutfitFromCart}
        isOpen={isOutfitCartOpen}
        items={outfitDraftItems}
        notes={outfitDraft.notes}
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

      <SiteFooter />
    </div>
  );
}
