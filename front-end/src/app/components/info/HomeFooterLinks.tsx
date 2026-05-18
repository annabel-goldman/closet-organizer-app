import { PrimitiveText } from "../primitives/PrimitiveText";
import { REPOSITORY_URL } from "../../lib/siteContent";
import { navigateTo } from "../../lib/routes";

interface HomeFooterLinksProps {
  className?: string;
}

function FooterLink({
  children,
  onClick,
  href,
  external,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const className =
    "text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors";

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function HomeFooterLinks({ className = "" }: HomeFooterLinksProps) {
  return (
    <nav
      aria-label="Legal and project links"
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm ${className}`}
    >
      <FooterLink onClick={() => navigateTo("/about")}>About us</FooterLink>
      <PrimitiveText as="span" variant="bodySm" tone="muted" aria-hidden>
        ·
      </PrimitiveText>
      <FooterLink onClick={() => navigateTo("/privacy")}>Privacy</FooterLink>
      <PrimitiveText as="span" variant="bodySm" tone="muted" aria-hidden>
        ·
      </PrimitiveText>
      <FooterLink onClick={() => navigateTo("/terms")}>Terms</FooterLink>
      <PrimitiveText as="span" variant="bodySm" tone="muted" aria-hidden>
        ·
      </PrimitiveText>
      <FooterLink href={REPOSITORY_URL} external>
        Repository
      </FooterLink>
    </nav>
  );
}
