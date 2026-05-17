import { Dispatch, SetStateAction, useDeferredValue, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Search, Users } from "lucide-react";
import { AddItemMenu } from "./components/AddItemMenu";
import { ClothingCard } from "./components/ClothingCard";
import { CreateItemPage } from "./components/CreateItemPage";
import { ItemDetailPage } from "./components/ItemDetailPage";
import { MyOutfitsPage } from "./components/MyOutfitsPage";
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
import { AccessRestrictedState } from "./components/shared/AccessRestrictedState";
import { Input } from "./components/ui/input";
import {
  beginGoogleSignIn,
  ClothingItem,
  fetchCurrentUser,
  formatPossessive,
  formatPreferredStyle,
  logoutSession,
  OutfitDraft,
  titleize,
  User,
} from "./lib/closet";
import {
  buildGroupedTagOptions,
  ClosetSortOption,
  filterClothingItems,
  hasActiveClosetControls,
} from "./lib/closetFilters";
import {
  AppRoute,
  authErrorMessage,
  getRouteFromLocation,
  isClosetRoute,
  isOutfitRoute,
  isProtectedRoute,
  isUsersRoute,
  navigateTo,
} from "./lib/routes";
import { useOutfitDraftState } from "./lib/useOutfitDraftState";

interface HomeMessageState {
  kind: "error" | "success";
  text: string;
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

  return {
    ...user,
    clothing_items: user.clothing_items.filter((item) => item.id !== itemId),
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [homeMessage, setHomeMessage] = useState<HomeMessageState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedOtherTags, setSelectedOtherTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<ClosetSortOption>("name-asc");
  const [outfitDraftNotice, setOutfitDraftNotice] = useState("");
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
    if (!isProtectedRoute(route)) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const unauthorizedMessage = "You do not have permission to view this page. Please log in.";

    void (async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextUser = await fetchCurrentUser(controller.signal);
        if (!nextUser) {
          setUser(null);
          setHomeMessage({ kind: "error", text: unauthorizedMessage });
          navigateTo("/");
          return;
        }

        setHomeMessage((current) => (current?.kind === "error" ? null : current));
        setUser(nextUser);
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
  }, [route.kind]);

  useEffect(() => {
    if (!outfitDraftNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOutfitDraftNotice("");
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [outfitDraftNotice]);

  const clothingItems = user?.clothing_items ?? [];
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
  const hasActiveFilters = hasActiveClosetControls(
    searchQuery,
    selectedBrands,
    selectedColors,
    selectedOtherTags,
    sortOption,
  );

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
    setOutfitDraft((current) => {
      if (current.itemIds.includes(itemId)) {
        setOutfitDraftNotice("Already in your outfit draft.");
        return current;
      }

      setOutfitDraftNotice("Added to outfit draft.");
      return {
        ...current,
        itemIds: [itemId, ...current.itemIds],
      };
    });
  }

  async function handleLogout() {
    try {
      await logoutSession();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign out right now.");
      return;
    }

    setUser(null);
    setHomeMessage({ kind: "success", text: "Signed out successfully." });
    navigateTo("/");
  }

  const globalAction = user ? (
    <PrimitiveButton
      onClick={() => void handleLogout()}
      variant="outline"
    >
      <Users className="h-4 w-4" />
      Sign Out
    </PrimitiveButton>
  ) : (
    <PrimitiveButton
      onClick={() => beginGoogleSignIn()}
      variant="outline"
    >
      Sign In
      <ArrowRight className="h-4 w-4" />
    </PrimitiveButton>
  );

  let pageContent;

  if (isLoggedOutProtectedRoute && isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (route.kind === "home" || (isLoggedOutProtectedRoute && !isLoading)) {
    pageContent = (
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl text-center"
        >
          <PrimitiveText
            as="h1"
            variant="display"
            font="serif"
            className="mb-6"
            style={{
              fontSize: "clamp(3rem, 8vw, 5.5rem)",
              lineHeight: "0.95",
            }}
          >
            Closet Organizer
          </PrimitiveText>
          <PrimitiveText
            as="p"
            variant="title"
            tone="muted"
            className="mb-10"
            style={{ lineHeight: "1.7" }}
          >
            Organize clothing items, manage closet details.
          </PrimitiveText>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <PrimitiveButton
              onClick={() => beginGoogleSignIn()}
              variant="outline"
              className="h-auto px-6 py-3"
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4" />
            </PrimitiveButton>
          </div>
          {homeMessage ? (
            <div
              className={`mt-6 px-4 py-3 text-sm ${
                homeMessage.kind === "success"
                  ? "border border-emerald-300/40 bg-emerald-50 text-emerald-900"
                  : "border border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              <PrimitiveText as="p" variant="bodySm">{homeMessage.text}</PrimitiveText>
            </div>
          ) : null}
        </motion.div>
      </section>
    );
  } else if (route.kind === "not-found") {
    pageContent = (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="border border-border bg-card p-8">
          <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
            Page Not Found
          </PrimitiveText>
          <PrimitiveText as="h1" variant="display" font="serif" className="mb-3">
            We couldn&apos;t find that page.
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted" className="mb-6">
            The link may be out of date, or the page may have been moved.
          </PrimitiveText>
          <PrimitiveButton
            onClick={() => navigateTo(user ? "/closet" : "/")}
            variant="outline"
          >
            {user ? "Back to closet" : "Back home"}
          </PrimitiveButton>
        </div>
      </div>
    );
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
    pageContent = (
      <ItemDetailPage
        itemId={route.itemId}
        initialItem={selectedItem}
        onBack={() => navigateTo("/closet")}
        onItemSaved={(nextItem) => setUser((current) => updateUserItem(current, nextItem))}
        onItemDeleted={(itemId) => {
          setUser((current) => removeUserItem(current, itemId));
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
        user={user}
        draft={outfitDraft}
        onDraftChange={setOutfitDraft}
        onBrowseCloset={() => navigateTo("/closet")}
        onOpenItem={(itemId) => navigateTo(`/items/${itemId}`)}
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
                <div className="relative min-w-0 self-start">
                  <label htmlFor="closet-search" className="sr-only">
                    Search closet items
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="closet-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
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
                        <PrimitiveSelectItem value="recent-purchase">Most recent purchase</PrimitiveSelectItem>
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
                {filteredClothingItems.map((item, index) => (
                  <ClothingCard
                    key={item.id}
                    {...item}
                    index={index}
                    onSelect={(itemId) => navigateTo(`/items/${itemId}`)}
                    onAddToOutfit={addItemToOutfitDraft}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border p-10 text-center">
                <PrimitiveText as="p" variant="display" font="serif" className="mb-3">
                  {user ? "No matching items found" : "No closet data found"}
                </PrimitiveText>
                <PrimitiveText as="p" tone="muted">
                  {user
                    ? hasActiveFilters
                      ? "Try a different tag, search phrase, or sort."
                      : "Add a new item to start building out this closet."
                    : "Sign in with Google to load your closet."}
                </PrimitiveText>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (route.kind === "home" && !user) {
    return <div className="flex min-h-screen flex-col bg-background">{pageContent}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-foreground focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <PrimitiveButton
            onClick={() => navigateTo(user ? "/closet" : "/")}
            variant="outline"
            className={`${
              user && isClosetRoute(route)
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground"
            }`}
          >
            {user ? "Closet" : "Home"}
          </PrimitiveButton>

          <div className="flex items-center gap-3">
            {user ? (
              <nav className="flex items-center gap-2">
                <PrimitiveButton
                  onClick={() => navigateTo("/outfits")}
                  variant="outline"
                  className={`${
                    isOutfitRoute(route)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:border-foreground"
                  }`}
                >
                  My Outfits
                </PrimitiveButton>
                {user.admin ? (
                  <PrimitiveButton
                    onClick={() => navigateTo("/users")}
                    variant="outline"
                    className={`${
                      isUsersRoute(route)
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-foreground hover:border-foreground"
                    }`}
                  >
                    Users
                  </PrimitiveButton>
                ) : null}
              </nav>
            ) : null}
            {globalAction}
          </div>
        </div>
      </header>

      <main id="main-content" className={`flex-1 ${route.kind === "home" ? "flex" : ""}`}>
        {pageContent}
      </main>

      {outfitDraftNotice ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm border border-foreground/20 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {outfitDraftNotice} Draft has {outfitDraft.itemIds.length}{" "}
          {outfitDraft.itemIds.length === 1 ? "item" : "items"}.
        </motion.div>
      ) : null}

      <footer className="mt-12 border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <PrimitiveText as="p" variant="bodySm">
            Curating closets and serving looks, one hanger at a time.
          </PrimitiveText>
          <PrimitiveText as="p" variant="bodySm">Pressed, polished, and ready for the runway.</PrimitiveText>
        </div>
      </footer>
    </div>
  );
}
