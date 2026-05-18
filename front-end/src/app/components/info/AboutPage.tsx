import { PrimitiveText } from "../primitives/PrimitiveText";
import { InfoPageLayout } from "./InfoPageLayout";
import { InfoSection } from "./InfoSection";
import { PROJECT_NAME, REPOSITORY_URL, TEAM_MEMBERS } from "../../lib/siteContent";

export function AboutPage() {
  return (
    <InfoPageLayout title="About us">
      <InfoSection heading="What is Curated Closet?">
        <PrimitiveText as="p" tone="muted">
          {PROJECT_NAME} helps you catalog clothing, build outfits, and use AI-assisted tools to
          organize photos and metadata. It is a course project built for Northwestern&apos;s CS
          Software Studio.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="Team">
        <ul className="list-disc space-y-2 pl-5">
          {TEAM_MEMBERS.map((name) => (
            <li key={name}>
              <PrimitiveText as="span" tone="muted">
                {name}
              </PrimitiveText>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection heading="Source code">
        <PrimitiveText as="p" tone="muted">
          The project repository is available on GitHub:{" "}
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            {REPOSITORY_URL.replace("https://github.com/", "")}
          </a>
        </PrimitiveText>
      </InfoSection>
    </InfoPageLayout>
  );
}
