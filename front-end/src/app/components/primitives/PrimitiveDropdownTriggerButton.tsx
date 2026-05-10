import * as React from "react";
import { ChevronDown } from "lucide-react";

import { primitiveSelectTriggerVariants } from "./PrimitiveSelect";
import { cn } from "../ui/utils";

function PrimitiveDropdownTriggerButton({
  children,
  className,
  style,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        primitiveSelectTriggerVariants({ size: "default" }),
        "h-14 bg-stone-200 hover:bg-stone-200",
        className,
      )}
      style={{ fontFamily: "Outfit, sans-serif", ...style }}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
        {children}
      </span>
      <ChevronDown className="size-4 opacity-50" />
    </button>
  );
}

export { PrimitiveDropdownTriggerButton };
