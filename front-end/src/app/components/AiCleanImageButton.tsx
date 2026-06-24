import { LoaderCircle, Sparkles, type LucideIcon } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AiCleanImageButtonProps {
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
  iconOnly?: boolean;
  isLoading?: boolean;
  label?: string;
  onClick: () => void;
}

export function AiCleanImageButton({
  className = "",
  disabled = false,
  icon: Icon = Sparkles,
  iconOnly = false,
  isLoading = false,
  label = "AI clean PNG",
  onClick,
}: AiCleanImageButtonProps) {
  const buttonLabel = label;
  const isDisabled = disabled || isLoading;
  const ButtonIcon = isLoading ? LoaderCircle : Icon;

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
      <ButtonIcon className={`h-4 w-4 shrink-0 ${isLoading ? "animate-spin" : ""}`} />
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
