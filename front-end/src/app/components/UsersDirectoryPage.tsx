import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import { fetchUsers, formatPossessive, formatPreferredStyle, titleize, User } from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { AccessRestrictedState } from "./shared/AccessRestrictedState";

interface UsersDirectoryPageProps {
  onBack: () => void;
  onSelectUser: (userId: number) => void;
}

const MotionPrimitiveButton = motion.create(PrimitiveButton);

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
        <PrimitiveButton
          onClick={onBack}
          variant="ghost"
          className="mb-8 h-auto px-0 py-0 text-muted-foreground"
        >
          Back home
        </PrimitiveButton>

        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
              User Directory
            </PrimitiveText>
            <PrimitiveText as="h1" variant="display" font="serif" className="mb-2">
              All Users
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Browse every closet owner in the system and open a detailed profile.
            </PrimitiveText>
          </div>
          <div className="hidden sm:flex items-center gap-3 px-5 py-3 border border-border bg-card">
            <Users className="w-4 h-4" />
            <PrimitiveText as="span" variant="bodySm">
              {users.length} users
            </PrimitiveText>
          </div>
        </div>

        {errorMessage ? (
          <div className="border border-destructive/20 bg-destructive/5 p-6">
            <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
              Users could not be loaded.
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              {errorMessage}
            </PrimitiveText>
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
                <MotionPrimitiveButton
                  key={user.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  onClick={() => onSelectUser(user.id)}
                  variant="outline"
                  className="h-auto justify-start bg-card p-6 text-left hover:border-foreground"
                >
                  <PrimitiveText as="p" variant="overline" tone="muted" className="mb-4">
                    Closet Owner
                  </PrimitiveText>
                  <PrimitiveText as="h2" variant="title" font="serif" className="mb-2">
                    {titleize(user.username)}
                  </PrimitiveText>
                  <PrimitiveText as="p" tone="muted" className="mb-6">
                    {formatPossessive(titleize(user.username))}
                  </PrimitiveText>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                    <div className="border border-border p-4">
                      <PrimitiveText as="p" variant="bodySm" tone="muted" className="mb-1">
                        Items
                      </PrimitiveText>
                      <PrimitiveText as="p" variant="stat" font="serif">
                        {user.clothing_items.length}
                      </PrimitiveText>
                    </div>
                    <div className="border border-border p-4">
                      <PrimitiveText as="p" variant="bodySm" tone="muted" className="mb-1">
                        Style
                      </PrimitiveText>
                      <PrimitiveText as="p" variant="stat" font="serif">
                        {preferredStyle ?? "N/A"}
                      </PrimitiveText>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <PrimitiveText as="span" variant="bodySm">
                      Open details
                    </PrimitiveText>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </MotionPrimitiveButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
