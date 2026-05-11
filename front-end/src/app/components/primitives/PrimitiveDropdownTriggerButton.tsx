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
        "relative h-14 bg-stone-200 pr-10 hover:bg-stone-200",
        className,
      )}
      style={{ fontFamily: "Outfit, sans-serif", ...style }}
      {...props}
    >
      <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
        {children}
      </span>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 opacity-50" />
    </button>
  );
}

export { PrimitiveDropdownTriggerButton };
