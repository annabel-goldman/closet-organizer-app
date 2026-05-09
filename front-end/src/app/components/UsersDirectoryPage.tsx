import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import { fetchUsers, formatPossessive, formatPreferredStyle, titleize, User } from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { AccessRestrictedState } from "./shared/AccessRestrictedState";

interface UsersDirectoryPageProps {
  onBack: () => void;
  onSelectUser: (userId: number) => void;
}

export function UsersDirectoryPage({ onBack, onSelectUser }: UsersDirectoryPageProps) {
  const {
    data: users,
    errorMessage,
    isLoading,
  } = usePageData<User[]>({
    deps: [],
    getErrorMessage: (error) => (error instanceof Error ? error.message : "Unable to load users."),
    initialData: [],
    load: (signal) => fetchUsers(signal),
  });
  const isForbidden = /not authorized/i.test(errorMessage);

  if (isForbidden) {
    return (
      <AccessRestrictedState
        backLabel="Back"
        message={errorMessage}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          Back home
        </button>

        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p
              className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-3"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              User Directory
            </p>
            <h1 className="mb-2">All Users</h1>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              Browse every closet owner in the system and open a detailed profile.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3 px-5 py-3 border border-border bg-card">
            <Users className="w-4 h-4" />
            <span style={{ fontFamily: "Outfit, sans-serif" }}>{users.length} users</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="border border-destructive/20 bg-destructive/5 p-6">
            <p className="text-lg mb-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              Users could not be loaded.
            </p>
            <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {errorMessage}
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse border border-border p-6 space-y-4">
                <div className="h-8 bg-muted w-1/2" />
                <div className="h-4 bg-muted w-1/3" />
                <div className="h-24 bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {users.map((user, index) => {
              const preferredStyle = formatPreferredStyle(user.preferred_style);
              return (
                <motion.button
                  key={user.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  onClick={() => onSelectUser(user.id)}
                  className="text-left border border-border bg-card p-6 hover:border-foreground transition-colors"
                >
                  <p
                    className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-4"
                    style={{ fontFamily: "Outfit, sans-serif" }}
                  >
                    Closet Owner
                  </p>
                  <h2 className="mb-2">{titleize(user.username)}</h2>
                  <p className="text-muted-foreground mb-6" style={{ fontFamily: "Outfit, sans-serif" }}>
                    {formatPossessive(titleize(user.username))}
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                    <div className="border border-border p-4">
                      <p className="text-muted-foreground mb-1">Items</p>
                      <p className="text-xl" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                        {user.clothing_items.length}
                      </p>
                    </div>
                    <div className="border border-border p-4">
                      <p className="text-muted-foreground mb-1">Style</p>
                      <p className="text-xl" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                        {preferredStyle ?? "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ fontFamily: "Outfit, sans-serif" }}>Open details</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
