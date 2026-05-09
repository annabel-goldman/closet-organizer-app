import { ArrowLeft } from "lucide-react";

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
          <p
            className="uppercase tracking-[0.3em] text-xs text-destructive/80 mb-3"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Access Restricted
          </p>
          <h1 className="mb-3">You are not authorized to view this page.</h1>
          <p className="text-muted-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
