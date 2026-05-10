import { Sparkles } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";

interface AiCleanImageButtonProps {
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  onClick: () => void;
}

export function AiCleanImageButton({
  className = "",
  disabled = false,
  isLoading = false,
  label = "AI clean PNG",
  onClick,
}: AiCleanImageButtonProps) {
  return (
    <PrimitiveButton
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      variant="outline"
      className={className}
    >
      <Sparkles className="w-4 h-4" />
      {isLoading ? "Cleaning..." : label}
    </PrimitiveButton>
  );
}
