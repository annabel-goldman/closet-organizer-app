import { ArrowRight, Users } from "lucide-react";
import type { AppRoute } from "../../lib/routes";
import { isClosetRoute, isOutfitRoute, isUsersRoute, navigateTo } from "../../lib/routes";
import type { User } from "../../lib/closet";
import { beginGoogleSignIn } from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { ModelReferenceDialog } from "./ModelReferenceDialog";

interface SiteHeaderProps {
  route: AppRoute;
  user: User | null;
  onSignOut: () => void;
  onUserUpdated: (user: User) => void;
}

export function SiteHeader({ route, user, onSignOut, onUserUpdated }: SiteHeaderProps) {
  const globalAction = user ? (
    <PrimitiveButton onClick={onSignOut} variant="outline">
      <Users className="h-4 w-4" />
      Sign Out
    </PrimitiveButton>
  ) : (
    <PrimitiveButton onClick={() => beginGoogleSignIn()} variant="outline">
      Sign In
      <ArrowRight className="h-4 w-4" />
    </PrimitiveButton>
  );

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-2" aria-label="Primary">
            <PrimitiveButton
              onClick={() => navigateTo(user ? "/closet" : "/")}
              variant="outline"
              className={
                user && isClosetRoute(route)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground"
              }
            >
              {user ? "Closet" : "Home"}
            </PrimitiveButton>
            {user ? (
              <PrimitiveButton
                onClick={() => navigateTo("/outfits")}
                variant="outline"
                className={
                  isOutfitRoute(route)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:border-foreground"
                }
              >
                My Outfits
              </PrimitiveButton>
            ) : null}
          </nav>
          <img src="/brand-mark.png" alt="" className="hidden h-9 w-auto opacity-90 sm:block" aria-hidden />
        </div>

        <div className="flex items-center gap-3">
          {user?.admin ? (
            <PrimitiveButton
              onClick={() => navigateTo("/users")}
              variant="outline"
              className={
                isUsersRoute(route)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:border-foreground"
              }
            >
              Users
            </PrimitiveButton>
          ) : null}
          {user ? <ModelReferenceDialog user={user} onUserUpdated={onUserUpdated} /> : null}
          {globalAction}
        </div>
      </div>
    </header>
  );
}
