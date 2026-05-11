import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../ui/utils";

const primitiveTextVariants = cva("", {
  variants: {
    variant: {
      display: "text-2xl leading-tight md:text-3xl",
      title: "text-lg leading-snug",
      body: "text-base leading-relaxed",
      bodySm: "text-sm leading-relaxed",
      caption: "text-xs leading-normal",
      label: "text-sm leading-none font-medium",
      overline: "text-xs leading-normal uppercase tracking-[0.3em]",
      stat: "text-xl leading-none",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
      destructiveSoft: "text-destructive/80",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
  },
  defaultVariants: {
    variant: "body",
    tone: "default",
    weight: "regular",
  },
});

const primitiveTextFontStyles = {
  inherit: undefined,
  sans: { fontFamily: "Outfit, sans-serif" },
  serif: { fontFamily: "Cormorant Garamond, serif" },
} satisfies Record<string, React.CSSProperties | undefined>;

type PrimitiveTextOwnProps = VariantProps<typeof primitiveTextVariants> & {
  as?: React.ElementType;
  font?: keyof typeof primitiveTextFontStyles;
};

type PrimitiveTextProps<C extends React.ElementType> = PrimitiveTextOwnProps &
  Omit<React.ComponentPropsWithoutRef<C>, keyof PrimitiveTextOwnProps | "as">;

function PrimitiveText<C extends React.ElementType = "p">({
  as,
  className,
  font = "sans",
  style,
  tone,
  variant,
  weight,
  ...props
}: PrimitiveTextProps<C>) {
  const Component = as ?? "p";

  return (
    <Component
      className={cn(primitiveTextVariants({ variant, tone, weight }), className)}
      style={{
        ...primitiveTextFontStyles[font],
        ...style,
      }}
      {...props}
    />
  );
}

export { PrimitiveText, primitiveTextVariants };
