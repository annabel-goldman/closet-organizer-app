import { Sparkles } from "lucide-react";
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
  label = "AI clean PNG",
  onClick,
}: AiCleanImageButtonProps) {
  const buttonLabel = isLoading ? "Cleaning..." : label;
  const isDisabled = disabled || isLoading;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex ${isDisabled ? "cursor-default" : "cursor-pointer"}`}>
          <PrimitiveButton
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            variant="outline"
            className={className}
            aria-label={buttonLabel}
          >
            <Sparkles className="w-4 h-4" />
            {iconOnly ? null : buttonLabel}
          </PrimitiveButton>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}
