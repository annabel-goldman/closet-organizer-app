import type { ComponentProps, ReactNode } from "react";
import { PopoverContent } from "../ui/popover";
import { cn } from "../ui/utils";
import { PrimitiveSearchField } from "./PrimitiveSearchField";
import { PrimitiveText } from "./PrimitiveText";

interface PrimitivePickerPopoverProps extends Omit<ComponentProps<typeof PopoverContent>, "children"> {
  bodyClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  searchDisabled?: boolean;
  searchId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  title: string;
  onSearchValueChange: (value: string) => void;
}

export function PrimitivePickerPopover({
  bodyClassName,
  children,
  className,
  footer,
  searchDisabled = false,
  searchId,
  searchLabel,
  searchPlaceholder,
  searchValue,
  style,
  title,
  onSearchValueChange,
  ...contentProps
}: PrimitivePickerPopoverProps) {
  return (
    <PopoverContent
      className={cn(
        "flex w-[15.5rem] flex-col overflow-hidden border-border p-0 shadow-[0_18px_40px_rgba(15,23,42,0.16)]",
        className,
      )}
      style={{
        maxHeight: "min(24rem, var(--radix-popover-content-available-height))",
        ...style,
      }}
      {...contentProps}
    >
      <div className="shrink-0 space-y-2 border-b border-border px-3 py-2.5">
        <PrimitiveText as="p" variant="overline" tone="muted" className="mb-1">
          {title}
        </PrimitiveText>
        <label className="block" htmlFor={searchId}>
          <span className="sr-only">{searchLabel}</span>
          <PrimitiveSearchField
            id={searchId}
            value={searchValue}
            onChange={(event) => onSearchValueChange(event.target.value)}
            placeholder={searchPlaceholder}
            fieldSize="compact"
            disabled={searchDisabled}
          />
        </label>
      </div>
      <div
        data-slot="picker-popover-scroll-region"
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-3", bodyClassName)}
        onWheel={(event) => event.stopPropagation()}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border px-3 py-2 text-right">
          {footer}
        </div>
      ) : null}
    </PopoverContent>
  );
}
