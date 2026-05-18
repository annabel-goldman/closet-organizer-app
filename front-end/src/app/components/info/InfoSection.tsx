import { PrimitiveText } from "../primitives/PrimitiveText";

interface InfoSectionProps {
  heading: string;
  children: React.ReactNode;
}

export function InfoSection({ heading, children }: InfoSectionProps) {
  return (
    <section className="space-y-3">
      <PrimitiveText as="h2" variant="title" font="serif">
        {heading}
      </PrimitiveText>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
