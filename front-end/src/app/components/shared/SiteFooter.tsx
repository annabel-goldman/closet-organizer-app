import { PrimitiveText } from "../primitives/PrimitiveText";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Curating closets and serving looks, one hanger at a time.
        </PrimitiveText>
      </div>
    </footer>
  );
}
