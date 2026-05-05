import { useDeferredValue, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Search, Users } from "lucide-react";
import { AddItemMenu } from "./components/AddItemMenu";
import { ClothingCard } from "./components/ClothingCard";
import { CreateItemPage } from "./components/CreateItemPage";
import { ItemDetailPage } from "./components/ItemDetailPage";
import { MyOutfitsPage } from "./components/MyOutfitsPage";
import { UserDetailPage } from "./components/UserDetailPage";
import { UsersDirectoryPage } from "./components/UsersDirectoryPage";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  beginGoogleSignIn,
  ClothingItem,
  CreateItemMode,
  emptyOutfitDraft,
  fetchClosetOwner,
  formatPossessive,
  formatPreferredStyle,
  loadOutfitDraft,
  logoutSession,
  OutfitDraft,
  saveOutfitDraft,
  titleize,
  User,
} from "./lib/closet";

interface RouteState {
  kind: "home";
}

interface ClosetRouteState {
  kind: "closet";
}

interface ItemRouteState {
  kind: "item";
  itemId: number;
}

interface UsersRouteState {
  kind: "users";
}

interface UserRouteState {
  kind: "user";
  userId: number;
}

interface NewItemRouteState {
  kind: "new-item";
  userId: number | null;
  mode: CreateItemMode;
}

interface OutfitsRouteState {
  kind: "outfits";
}

interface NotFoundRouteState {
  kind: "not-found";
}

interface HomeMessageState {
  kind: "error" | "success";
  text: string;
}

type AppRoute =
  | RouteState
  | ClosetRouteState
  | ItemRouteState
  | UsersRouteState
  | UserRouteState
  | NewItemRouteState
  | OutfitsRouteState
  | NotFoundRouteState;

function isClosetRoute(route: AppRoute) {
  return route.kind === "closet" || route.kind === "item" || route.kind === "new-item";
}

function isOutfitRoute(route: AppRoute) {
  return route.kind === "outfits";
}

function isUsersRoute(route: AppRoute) {
  return route.kind === "users" || route.kind === "user";
}

function isProtectedRoute(route: AppRoute) {
  return route.kind !== "home" && route.kind !== "not-found";
}

function authErrorMessage(code: string | null) {
  switch (code) {
    case "auth_cancelled":
      return "Google sign-in was cancelled before it finished.";
    case "google_auth_failed":
      return "Google sign-in could not be completed. Please try again.";
    case "signin_failed":
      return "Sign-in failed. Please try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}

function parseCreateItemMode(value: string | null): CreateItemMode {
  return value === "image" ? "image" : "manual";
}

function getRouteFromLocation(
  pathname = window.location.pathname,
  search = window.location.search,
): AppRoute {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const itemMatch = normalizedPath.match(/^\/items\/(\d+)$/);
  const userMatch = normalizedPath.match(/^\/users\/(\d+)$/);
  const query = new URLSearchParams(search);

  if (normalizedPath === "/items/new") {
    const userId = query.get("userId");
    return {
      kind: "new-item",
      userId: userId ? Number(userId) : null,
      mode: parseCreateItemMode(query.get("mode")),
    };
  }

  if (normalizedPath === "/closet") {
    return { kind: "closet" };
  }

  if (normalizedPath === "/users") {
    return { kind: "users" };
  }

  if (normalizedPath === "/outfits") {
    return { kind: "outfits" };
  }

  if (userMatch) {
    return { kind: "user", userId: Number(userMatch[1]) };
  }

  if (itemMatch) {
    return { kind: "item", itemId: Number(itemMatch[1]) };
  }

  if (normalizedPath === "/") {
    return { kind: "home" };
  }

  return { kind: "not-found" };
}

function navigateTo(pathname: string) {
  const nextUrl = new URL(pathname, window.location.origin);
  if (window.location.pathname === nextUrl.pathname && window.location.search === nextUrl.search) {
    return;
  }

  window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
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

type ClosetSortOption = "name-asc" | "newest-added" | "oldest-added" | "recent-purchase";

function matchesSearchQuery(item: ClothingItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    item.name,
    item.size,
    ...item.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return normalizedQuery
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function sortClothingItems(items: ClothingItem[], sortOption: ClosetSortOption) {
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (sortOption === "name-asc") {
      return left.name.localeCompare(right.name);
    }

    if (sortOption === "oldest-added") {
      return (new Date(left.created_at ?? 0).getTime()) - (new Date(right.created_at ?? 0).getTime());
    }

    if (sortOption === "recent-purchase") {
      return (new Date(right.date ?? 0).getTime()) - (new Date(left.date ?? 0).getTime());
    }

    return (new Date(right.created_at ?? 0).getTime()) - (new Date(left.created_at ?? 0).getTime());
  });

  return sorted;
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [homeMessage, setHomeMessage] = useState<HomeMessageState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortOption, setSortOption] = useState<ClosetSortOption>("name-asc");
  const [outfitDraft, setOutfitDraft] = useState<OutfitDraft>(emptyOutfitDraft());
  const [outfitDraftNotice, setOutfitDraftNotice] = useState("");

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

    async function loadProtectedRoute() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextUser = await fetchClosetOwner(controller.signal);
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
    }

    loadProtectedRoute();

    return () => controller.abort();
  }, [route.kind]);

  useEffect(() => {
    if (!user) {
      setOutfitDraft(emptyOutfitDraft());
      return;
    }

    const availableItemIds = new Set(user.clothing_items.map((item) => item.id));
    const persisted = loadOutfitDraft(user.id);
    setOutfitDraft({
      ...persisted,
      itemIds: persisted.itemIds.filter((itemId) => availableItemIds.has(itemId)),
    });
  }, [user?.id, user?.clothing_items]);

  useEffect(() => {
    if (!user) {
      return;
    }

    saveOutfitDraft(user.id, outfitDraft);
  }, [outfitDraft, user]);

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

  const isAdminRoute = route.kind === "users" || route.kind === "user";
  const isUnauthorizedAdminRoute = Boolean(user && !user.admin && isAdminRoute);
  const tagOptions = Array.from(new Set(clothingItems.flatMap((item) => item.tags))).sort((left, right) =>
    left.localeCompare(right),
  );
  const filteredClothingItems = sortClothingItems(
    clothingItems.filter((item) => {
      if (selectedTag !== "all" && !item.tags.includes(selectedTag)) {
        return false;
      }

      return matchesSearchQuery(item, deferredSearchQuery);
    }),
    sortOption,
  );
  const hasActiveClosetControls =
    searchQuery.trim().length > 0 || selectedTag !== "all" || sortOption !== "name-asc";

  const globalAction = user ? (
    <button
      onClick={async () => {
        try {
          await logoutSession();
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to sign out right now.");
          return;
        }

        setUser(null);
        setHomeMessage({ kind: "success", text: "Signed out successfully." });
        navigateTo("/");
      }}
      className="inline-flex items-center justify-center gap-3 border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground"
      style={{ fontFamily: "Outfit, sans-serif" }}
    >
      <Users className="h-4 w-4" />
      Sign Out
    </button>
  ) : (
    <button
      onClick={() => beginGoogleSignIn()}
      className="inline-flex items-center justify-center gap-3 border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground"
      style={{ fontFamily: "Outfit, sans-serif" }}
    >
      Sign In
      <ArrowRight className="h-4 w-4" />
    </button>
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
          <h1
            className="mb-6"
            style={{
              fontFamily: "Cormorant Garamond, serif",
              fontSize: "clamp(3rem, 8vw, 5.5rem)",
              lineHeight: "0.95",
            }}
          >
            Closet Organizer
          </h1>
          <p
            className="mb-10 text-lg text-muted-foreground"
            style={{ fontFamily: "Outfit, sans-serif", lineHeight: "1.7" }}
          >
            Organize clothing items, manage closet details.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={() => beginGoogleSignIn()}
              className="inline-flex items-center justify-center gap-3 border border-border px-6 py-3 transition-colors hover:border-foreground"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {homeMessage ? (
            <div
              className={`mt-6 px-4 py-3 text-sm ${
                homeMessage.kind === "success"
                  ? "border border-emerald-300/40 bg-emerald-50 text-emerald-900"
                  : "border border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              <p style={{ fontFamily: "Outfit, sans-serif" }}>{homeMessage.text}</p>
            </div>
          ) : null}
        </motion.div>
      </section>
    );
  } else if (route.kind === "not-found") {
    pageContent = (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="border border-border bg-card p-8">
          <p
            className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-3"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Page Not Found
          </p>
          <h1 className="mb-3">We couldn&apos;t find that page.</h1>
          <p className="mb-6 text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            The link may be out of date, or the page may have been moved.
          </p>
          <button
            onClick={() => navigateTo(user ? "/closet" : "/")}
            className="inline-flex items-center justify-center border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            {user ? "Back to closet" : "Back home"}
          </button>
        </div>
      </div>
    );
  } else if (isUnauthorizedAdminRoute) {
    pageContent = (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <button
            onClick={() => navigateTo("/closet")}
            className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="border border-destructive/20 bg-destructive/5 p-8">
            <p
              className="uppercase tracking-[0.3em] text-xs text-destructive/80 mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Access Restricted
            </p>
            <h1 className="mb-3">You are not authorized to view this page.</h1>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              You&apos;re not authorized to view this page.
            </p>
          </div>
        </div>
      </div>
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
    const targetUser =
      route.userId && user?.id === route.userId ? user : route.userId ? null : user;
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
          setOutfitDraft((current) => ({
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
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-2 tracking-tight"
              style={{
                fontFamily: "Cormorant Garamond, serif",
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                lineHeight: "1",
              }}
            >
              {closetTitle}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="tracking-wide text-muted-foreground"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              {isLoading
                ? "Loading items from your backend..."
                : `${clothingItems.length} ${clothingItems.length === 1 ? "item" : "items"}${
                    preferredStyle ? ` · ${preferredStyle} style` : ""
                  }`}
            </motion.p>
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
            <p className="mb-2 text-lg" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              The closet data could not be loaded.
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {errorMessage}. Make sure both dev servers are running through `./start.sh`.
            </p>
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
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.9fr)_minmax(14rem,1fr)_12rem] lg:items-start">
                <div className="relative min-w-0 self-start">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name or describe an item with tags"
                    className="h-14 pl-10"
                  />
                </div>

                <div className="min-w-0">
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger className="h-14 w-full bg-stone-200 hover:bg-stone-200">
                      <SelectValue placeholder="All tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {tagOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {titleize(tag)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={sortOption} onValueChange={(value) => setSortOption(value as ClosetSortOption)}>
                  <SelectTrigger className="h-14 w-full bg-stone-200 hover:bg-stone-200">
                    <SelectValue placeholder="Sort items" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="newest-added">Newest added</SelectItem>
                    <SelectItem value="oldest-added">Oldest added</SelectItem>
                    <SelectItem value="recent-purchase">Most recent purchase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveClosetControls ? (
                <div className="flex items-center justify-between gap-4 border border-border bg-card px-4 py-3">
                  <p className="text-sm text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                    Refine your closet with free-text search, tag filters, and sorting.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedTag("all");
                      setSortOption("name-asc");
                    }}
                    className="inline-flex items-center justify-center border border-border px-3 py-2 text-sm transition-colors hover:border-foreground"
                    style={{ fontFamily: "Outfit, sans-serif" }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}

            </motion.div>

            {user && filteredClothingItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
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
                <p className="mb-3 text-2xl" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  {user ? "No matching items found" : "No closet data found"}
                </p>
                <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {user
                    ? hasActiveClosetControls
                      ? "Try a different tag, search phrase, or sort."
                      : "Add a new item to start building out this closet."
                    : "Sign in with Google to load your closet."}
                </p>
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
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <button
            onClick={() => navigateTo("/")}
            className="inline-flex items-center justify-center border border-border px-4 py-2.5 text-sm transition-colors hover:border-foreground"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Home
          </button>

          <div className="flex items-center gap-3">
            {user ? (
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => navigateTo("/closet")}
                  className={`inline-flex items-center justify-center border px-4 py-2.5 text-sm transition-colors ${
                    isClosetRoute(route)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:border-foreground"
                  }`}
                  style={{ fontFamily: "Outfit, sans-serif" }}
                >
                  Closet
                </button>
                <button
                  onClick={() => navigateTo("/outfits")}
                  className={`inline-flex items-center justify-center border px-4 py-2.5 text-sm transition-colors ${
                    isOutfitRoute(route)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:border-foreground"
                  }`}
                  style={{ fontFamily: "Outfit, sans-serif" }}
                >
                  My Outfits
                </button>
                {user.admin ? (
                  <button
                    onClick={() => navigateTo("/users")}
                    className={`inline-flex items-center justify-center border px-4 py-2.5 text-sm transition-colors ${
                      isUsersRoute(route)
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-foreground hover:border-foreground"
                    }`}
                    style={{ fontFamily: "Outfit, sans-serif" }}
                  >
                    Users
                  </button>
                ) : null}
              </nav>
            ) : null}
            {globalAction}
          </div>
        </div>
      </header>

      <main className={`flex-1 ${route.kind === "home" ? "flex" : ""}`}>{pageContent}</main>

      {outfitDraftNotice ? (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-50 max-w-sm border border-foreground/20 bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {outfitDraftNotice} Draft has {outfitDraft.itemIds.length} {outfitDraft.itemIds.length === 1 ? "item" : "items"}.
        </motion.div>
      ) : null}

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p style={{ fontFamily: "Outfit, sans-serif" }}>
            Curating closets and serving looks, one hanger at a time.
          </p>
          <p style={{ fontFamily: "Outfit, sans-serif" }}>Pressed, polished, and ready for the runway.</p>
        </div>
      </footer>
    </div>
  );
}
