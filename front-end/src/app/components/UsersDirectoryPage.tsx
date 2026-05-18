import { useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import {
  fetchUsers,
  formatPossessive,
  formatPreferredStyle,
  titleize,
  UsersPage,
} from "../lib/closet";
import { usePageData } from "../lib/usePageData";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { AccessRestrictedState } from "./shared/AccessRestrictedState";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./ui/pagination";

interface UsersDirectoryPageProps {
  onBack: () => void;
  onSelectUser: (userId: number) => void;
}

const MotionPrimitiveButton = motion.create(PrimitiveButton);
const PER_PAGE = 24;

const EMPTY_PAGE: UsersPage = {
  users: [],
  meta: { page: 1, per_page: PER_PAGE, total_pages: 0, total_count: 0 },
};

function pageNumbersToShow(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push("ellipsis");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    pages.push(page);
  }

  if (windowEnd < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

export function UsersDirectoryPage({ onBack, onSelectUser }: UsersDirectoryPageProps) {
  const [page, setPage] = useState(1);

  const {
    data: { users, meta },
    errorMessage,
    isLoading,
  } = usePageData<UsersPage>({
    deps: [page],
    getErrorMessage: (error) => (error instanceof Error ? error.message : "Unable to load users."),
    initialData: EMPTY_PAGE,
    load: (signal) => fetchUsers({ page, perPage: PER_PAGE }, signal),
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

  const totalCount = meta.total_count;
  const totalPages = Math.max(meta.total_pages, 1);
  const startIndex = totalCount === 0 ? 0 : (meta.page - 1) * meta.per_page + 1;
  const endIndex = totalCount === 0 ? 0 : Math.min(meta.page * meta.per_page, totalCount);
  const shouldShowPagination = totalPages > 1;

  const goToPage = (nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), totalPages);
    if (clamped !== page) {
      setPage(clamped);
    }
  };

  const isFirstPage = meta.page <= 1;
  const isLastPage = meta.page >= totalPages;

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
              {totalCount.toLocaleString()} {totalCount === 1 ? "user" : "users"}
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
        ) : users.length === 0 ? (
          <div className="border border-dashed border-border p-12 text-center">
            <PrimitiveText as="p" variant="display" font="serif" className="mb-2">
              No users yet
            </PrimitiveText>
            <PrimitiveText as="p" tone="muted">
              Once people sign in, they will show up here.
            </PrimitiveText>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user, index) => {
                const preferredStyle = formatPreferredStyle(user.preferred_style);
                return (
                  <MotionPrimitiveButton
                    key={user.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.02 }}
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
                          {user.clothing_items_count.toLocaleString()}
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

            {shouldShowPagination && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <PrimitiveText as="p" variant="bodySm" tone="muted">
                  Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of{" "}
                  {totalCount.toLocaleString()}
                </PrimitiveText>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={isFirstPage}
                        className={isFirstPage ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault();
                          if (!isFirstPage) {
                            goToPage(meta.page - 1);
                          }
                        }}
                      />
                    </PaginationItem>
                    {pageNumbersToShow(meta.page, totalPages).map((entry, index) =>
                      entry === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={entry}>
                          <PaginationLink
                            href="#"
                            isActive={entry === meta.page}
                            onClick={(event) => {
                              event.preventDefault();
                              goToPage(entry);
                            }}
                          >
                            {entry}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={isLastPage}
                        className={isLastPage ? "pointer-events-none opacity-50" : ""}
                        onClick={(event) => {
                          event.preventDefault();
                          if (!isLastPage) {
                            goToPage(meta.page + 1);
                          }
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
