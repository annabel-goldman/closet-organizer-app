import { HomeFooterLinks } from "../info/HomeFooterLinks";
import { PrimitiveText } from "../primitives/PrimitiveText";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Curating closets and serving looks, one hanger at a time.
        </PrimitiveText>
        <HomeFooterLinks />
      </div>
    </footer>
  );
}
