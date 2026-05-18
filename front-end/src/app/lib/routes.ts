import { CreateItemMode } from "./closet";

interface HomeRouteState {
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

interface AboutRouteState {
  kind: "about";
}

interface PrivacyRouteState {
  kind: "privacy";
}

interface TermsRouteState {
  kind: "terms";
}

export type AppRoute =
  | HomeRouteState
  | ClosetRouteState
  | ItemRouteState
  | UsersRouteState
  | UserRouteState
  | NewItemRouteState
  | OutfitsRouteState
  | AboutRouteState
  | PrivacyRouteState
  | TermsRouteState
  | NotFoundRouteState;

export function isPublicInfoRoute(route: AppRoute) {
  return route.kind === "about" || route.kind === "privacy" || route.kind === "terms";
}

export function isClosetRoute(route: AppRoute) {
  return route.kind === "closet" || route.kind === "item" || route.kind === "new-item";
}

export function isOutfitRoute(route: AppRoute) {
  return route.kind === "outfits";
}

export function isUsersRoute(route: AppRoute) {
  return route.kind === "users" || route.kind === "user";
}

export function isProtectedRoute(route: AppRoute) {
  return route.kind !== "home" && route.kind !== "not-found" && !isPublicInfoRoute(route);
}

export function authErrorMessage(code: string | null) {
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

export function getRouteFromLocation(
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

  if (normalizedPath === "/about") {
    return { kind: "about" };
  }

  if (normalizedPath === "/privacy") {
    return { kind: "privacy" };
  }

  if (normalizedPath === "/terms") {
    return { kind: "terms" };
  }

  if (normalizedPath === "/") {
    return { kind: "home" };
  }

  return { kind: "not-found" };
}

export function navigateTo(pathname: string) {
  const nextUrl = new URL(pathname, window.location.origin);
  if (window.location.pathname === nextUrl.pathname && window.location.search === nextUrl.search) {
    return;
  }

  window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
