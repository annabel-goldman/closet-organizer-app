import { MapPinOff } from "lucide-react";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { navigateTo } from "../../lib/routes";
import { VisualStatePanel } from "./VisualStatePanel";

interface NotFoundPageProps {
  signedIn: boolean;
}

export function NotFoundPage({ signedIn }: NotFoundPageProps) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <VisualStatePanel
        icon={MapPinOff}
        overline="404"
        title="We couldn't find that page."
        description="The link may be out of date, or the page may have been moved. Use the button below to return to a known page."
      >
        <PrimitiveButton
          onClick={() => navigateTo(signedIn ? "/closet" : "/")}
          variant="outline"
        >
          {signedIn ? "Back to closet" : "Back home"}
        </PrimitiveButton>
      </VisualStatePanel>
    </div>
  );
}
