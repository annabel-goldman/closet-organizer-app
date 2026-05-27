import { LoaderCircle, Sparkles } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { cn } from "./ui/utils";

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex ${isDisabled ? "cursor-default" : "cursor-pointer"}`}>
          <PrimitiveButton
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            variant="outline"
            className={cn("relative overflow-hidden", className)}
            aria-busy={isLoading}
            aria-label={buttonLabel}
          >
            <Sparkles
              className={cn(
                "h-4 w-4 shrink-0 transition-opacity",
                isLoading && "opacity-30",
              )}
            />
            {isLoading ? (
              <LoaderCircle className="absolute h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
          </PrimitiveButton>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>{buttonLabel}</TooltipContent>
    </Tooltip>
  );
}
