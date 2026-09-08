import * as React from "react";
import { Search, X } from "lucide-react";

import { PrimitiveButton } from "./PrimitiveButton";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";

type SearchFieldSize = "collection" | "form" | "compact";

interface PrimitiveSearchFieldProps extends Omit<React.ComponentProps<typeof Input>, "size"> {
  clearLabel?: string;
  containerClassName?: string;
  fieldSize?: SearchFieldSize;
  onClear?: () => void;
  showClear?: boolean;
}

const sizeStyles: Record<SearchFieldSize, { field: string; icon: string }> = {
  collection: { field: "h-14 pl-10", icon: "left-3 h-4 w-4" },
  form: { field: "h-11 pl-9", icon: "left-3 h-4 w-4" },
  compact: { field: "h-8 pl-8 text-sm", icon: "left-2.5 h-3.5 w-3.5" },
};

export const PrimitiveSearchField = React.forwardRef<HTMLInputElement, PrimitiveSearchFieldProps>(
  function PrimitiveSearchField({
    className,
    clearLabel = "Clear search",
    containerClassName,
    fieldSize = "collection",
    onClear,
    showClear = false,
    ...props
  }, ref) {
    const styles = sizeStyles[fieldSize];

    return (
      <div className={cn("relative min-w-0", containerClassName)}>
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            styles.icon,
          )}
          aria-hidden="true"
        />
        <Input
          ref={ref}
          className={cn(styles.field, showClear && "pr-11", className)}
          {...props}
        />
        {showClear && onClear ? (
          <PrimitiveButton
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 z-10 size-8 -translate-y-1/2 text-muted-foreground hover:bg-background/70 hover:text-foreground"
            aria-label={clearLabel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </PrimitiveButton>
        ) : null}
      </div>
    );
  },
);
