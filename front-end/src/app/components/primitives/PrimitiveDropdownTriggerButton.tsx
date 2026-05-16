import * as React from "react";
import { ChevronDown } from "lucide-react";

import { primitiveSelectTriggerVariants } from "./PrimitiveSelect";
import { cn } from "../ui/utils";

function textFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (React.isValidElement(child)) {
        return textFromChildren(child.props.children);
      }

      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function PrimitiveDropdownTriggerButton({
  children,
  className,
  style,
  title,
  ...props
}: React.ComponentProps<"button">) {
  const childText = textFromChildren(children);
  const resolvedTitle =
    title ??
    (typeof props["aria-label"] === "string" ? props["aria-label"] : undefined) ??
    (childText || undefined);

  return (
    <button
      type="button"
      className={cn(
        primitiveSelectTriggerVariants({ size: "default" }),
        "relative h-14 rounded-none bg-stone-200 pr-10 hover:bg-stone-200",
        className,
      )}
      style={{ fontFamily: "Outfit, sans-serif", ...style }}
      title={resolvedTitle}
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
