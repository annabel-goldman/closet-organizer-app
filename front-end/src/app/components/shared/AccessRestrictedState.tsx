import { ShieldAlert } from "lucide-react";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { VisualStatePanel } from "./VisualStatePanel";

interface AccessRestrictedStateProps {
  backLabel: string;
  message: string;
  onBack: () => void;
}

export function AccessRestrictedState({
  backLabel,
  message,
  onBack,
}: AccessRestrictedStateProps) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <VisualStatePanel
        icon={ShieldAlert}
        tone="destructive"
        overline="403"
        title="You are not authorized to view this page."
        description={message}
      >
        <PrimitiveButton onClick={onBack} variant="outline">
          {backLabel}
        </PrimitiveButton>
      </VisualStatePanel>
    </div>
  );
}
