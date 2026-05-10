import { motion } from "motion/react";
import { ChevronRight, Shirt } from "lucide-react";
import {
  fetchUser,
  formatDisplaySize,
  formatPossessive,
  formatPreferredStyle,
  formatTagLabel,
  titleize,
  User,
} from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { AccessRestrictedState } from "./shared/AccessRestrictedState";

interface UserDetailPageProps {
  userId: number;
  initialUser?: User | null;
  onBack: () => void;
  onOpenItem: (itemId: number) => void;
}

export function UserDetailPage({
  userId,
  initialUser,
  onBack,
  onOpenItem,
}: UserDetailPageProps) {
  const shouldUseInitialUser = Boolean(initialUser?.id === userId);
  const {
    data: user,
    errorMessage,
    isLoading,
  } = usePageData<User | null>({
    deps: [initialUser, shouldUseInitialUser, userId],
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : "Unable to load this user.",
    initialData: shouldUseInitialUser ? initialUser ?? null : null,
    load: (signal) => fetchUser(userId, signal),
    shouldUseInitialData: shouldUseInitialUser,
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="animate-pulse grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="h-80 bg-muted" />
            <div className="space-y-4">
              <div className="h-10 bg-muted w-1/2" />
              <div className="h-4 bg-muted w-1/3" />
              <div className="h-56 bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to all users
          </button>
          <div className="border border-destructive/20 bg-destructive/5 p-6">
            <PrimitiveText as="p" variant="title" font="serif" className="mb-2">
              This user could not be loaded.
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              {errorMessage || "The requested user may have been removed."}
            </PrimitiveText>
          </div>
        </div>
      </div>
    );
  }

  const preferredStyle = formatPreferredStyle(user.preferred_style);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to all users
        </button>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-start">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="border border-border bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-200 p-8"
          >
            <PrimitiveText as="p" variant="overline" tone="muted" className="mb-4">
              User Profile
            </PrimitiveText>
            <PrimitiveText as="h1" variant="display" font="serif" className="mb-2">
              {titleize(user.username)}
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted" className="mb-8">
              {formatPossessive(titleize(user.username))}
            </PrimitiveText>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-white/70 bg-white/60 p-5">
                <PrimitiveText as="p" variant="bodySm" tone="muted" className="mb-2">
                  Preferred style
                </PrimitiveText>
                <PrimitiveText as="p" variant="display" font="serif">
                  {preferredStyle ?? "Not set"}
                </PrimitiveText>
              </div>
              <div className="border border-white/70 bg-white/60 p-5">
                <PrimitiveText as="p" variant="bodySm" tone="muted" className="mb-2">
                  Closet size
                </PrimitiveText>
                <PrimitiveText as="p" variant="display" font="serif">
                  {user.clothing_items.length} items
                </PrimitiveText>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="space-y-6"
          >
            <div>
              <PrimitiveText as="p" variant="overline" tone="muted" className="mb-3">
                Clothing Items
              </PrimitiveText>
              <PrimitiveText as="h2" variant="title" font="serif" className="mb-1">
                Closet Contents
              </PrimitiveText>
              <PrimitiveText as="p" tone="muted">
                Click any item to jump straight into its editable detail page.
              </PrimitiveText>
            </div>

            <div className="space-y-4">
              {user.clothing_items.length === 0 ? (
                <div className="border border-dashed border-border p-8 text-center">
                  <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
                    No items yet
                  </PrimitiveText>
                  <PrimitiveText as="p" tone="muted">
                    This user does not have any clothing items in the API right now.
                  </PrimitiveText>
                </div>
              ) : (
                user.clothing_items.map((item, index) => {
                  const visibleTags = item.tags.slice(0, 3);

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.03 }}
                      onClick={() => onOpenItem(item.id)}
                      className="w-full text-left border border-border bg-card p-5 hover:border-foreground transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 shrink-0 border border-border rounded-full flex items-center justify-center bg-muted">
                            <Shirt className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="mb-1">{item.name}</h3>
                            <PrimitiveText as="p" tone="muted">
                              {formatDisplaySize(item.size)}
                              {visibleTags[0] ? ` · ${formatTagLabel(visibleTags[0])}` : ""}
                            </PrimitiveText>
                            <PrimitiveText as="p" variant="bodySm" tone="muted" className="mt-2">
                              {visibleTags.length > 0
                                ? visibleTags.map(formatTagLabel).join(" · ")
                                : "No tags added yet"}
                            </PrimitiveText>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0" />
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
