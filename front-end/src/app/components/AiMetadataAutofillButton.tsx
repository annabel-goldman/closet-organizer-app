import { LoaderCircle, Sparkles } from "lucide-react";
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
  const buttonLabel = isLoading ? "Autofilling details..." : label;
  const isDisabled = disabled || isLoading;
  const Icon = isLoading ? LoaderCircle : Sparkles;

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
            aria-busy={isLoading}
            aria-label={buttonLabel}
          >
            <Icon className={`h-4 w-4 shrink-0 ${isLoading ? "animate-spin" : ""}`} />
          </PrimitiveButton>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{buttonLabel}</TooltipContent>
    </Tooltip>
  );
}
