import { LoaderCircle, Sparkles } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AiCleanImageButtonProps {
  className?: string;
  disabled?: boolean;
  iconOnly?: boolean;
  isLoading?: boolean;
  label?: string;
  onClick: () => void;
}

export function AiCleanImageButton({
  className = "",
  disabled = false,
  iconOnly = false,
  isLoading = false,
  label = "AI clean image",
  onClick,
}: AiCleanImageButtonProps) {
  const buttonLabel = label;
  const isDisabled = disabled || isLoading;
  const Icon = isLoading ? LoaderCircle : Sparkles;

  const button = (
    <PrimitiveButton
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      variant="outline"
      className={className}
      aria-busy={isLoading}
      aria-label={buttonLabel}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isLoading ? "animate-spin" : ""}`} />
      {!iconOnly ? buttonLabel : null}
    </PrimitiveButton>
  );

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex ${isDisabled ? "cursor-default" : "cursor-pointer"}`}>
            {button}
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={8}>{buttonLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
