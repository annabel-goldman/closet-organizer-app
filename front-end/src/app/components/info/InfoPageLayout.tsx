import { ArrowLeft } from "lucide-react";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";
import { navigateTo } from "../../lib/routes";

interface InfoPageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function InfoPageLayout({ title, children }: InfoPageLayoutProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <PrimitiveButton
        onClick={() => navigateTo("/")}
        variant="ghost"
        size="sm"
        className="mb-8 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </PrimitiveButton>

      <PrimitiveText as="h1" variant="display" font="serif" className="mb-8">
        {title}
      </PrimitiveText>

      <div className="space-y-6">{children}</div>
    </article>
  );
}
