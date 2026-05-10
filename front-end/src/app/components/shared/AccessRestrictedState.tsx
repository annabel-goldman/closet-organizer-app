import { ArrowLeft } from "lucide-react";
import { PrimitiveText } from "../primitives/PrimitiveText";

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
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 mb-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>

        <div className="border border-destructive/20 bg-destructive/5 p-8">
          <PrimitiveText
            as="p"
            variant="overline"
            tone="destructiveSoft"
            className="mb-3"
          >
            Access Restricted
          </PrimitiveText>
          <PrimitiveText as="h1" variant="display" font="serif" className="mb-3">
            You are not authorized to view this page.
          </PrimitiveText>
          <PrimitiveText as="p" tone="muted">
            {message}
          </PrimitiveText>
        </div>
      </div>
    </div>
  );
}
