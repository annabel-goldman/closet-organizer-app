import { Sparkles } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface AiMetadataAutofillButtonProps {
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  onClick: () => void;
}

export function AiMetadataAutofillButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "AI autofill item details",
  onClick,
}: AiMetadataAutofillButtonProps) {
  const buttonLabel = isLoading ? "Autofilling..." : label;
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
          </PrimitiveButton>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}
