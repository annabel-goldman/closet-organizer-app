import { PrimitiveText } from "../primitives/PrimitiveText";
import { DELETION_CONTACT, PROJECT_NAME, REPOSITORY_URL } from "../../lib/siteContent";
import { InfoPageLayout } from "./InfoPageLayout";
import { InfoSection } from "./InfoSection";

export function PrivacyPage() {
  return (
    <InfoPageLayout title="Privacy">
      <PrimitiveText as="p" tone="muted" className="mb-2">
        Last updated: May 2026. This summary describes how {PROJECT_NAME} handles information
        beyond what Google provides for sign-in.
      </PrimitiveText>

      <InfoSection heading="What we collect">
        <PrimitiveText as="p" tone="muted">
          When you sign in with Google, we store your Google account identifier, email address,
          display name, profile image URL, and an internal username. We also store a session cookie
          so you stay signed in.
        </PrimitiveText>
        <PrimitiveText as="p" tone="muted">
          When you use the closet, we store clothing item details you enter or generate (such as
          name, type, brand, tags, and visual descriptions), photos you upload, AI-cleaned versions of
          those photos, and saved outfits (names, notes, tags, and links to your items).
        </PrimitiveText>
        <PrimitiveText as="p" tone="muted">
          If you use outfit-photo import, we store the uploaded photo, detection results, and related
          AI metadata. Image and text processing may be sent to third-party AI providers configured
          for the deployment (for example OpenRouter).
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="How we use it">
        <PrimitiveText as="p" tone="muted">
          We use this information to operate the app: authenticate you, display and search your
          closet, save outfits, run optional AI features, and administer the service. We do not sell
          your personal data.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="Where it is stored">
        <PrimitiveText as="p" tone="muted">
          Data is stored in the application database and, for uploaded images, in file storage used
          by the hosting environment (local disk in development; cloud storage in production when
          configured).
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="How to request deletion">
        <PrimitiveText as="p" tone="muted">
          You may delete individual clothing items and outfits in the app. To remove your entire
          account and associated data, {DELETION_CONTACT} Include the email address tied to your
          Google sign-in so we can locate your account.
        </PrimitiveText>
        <PrimitiveText as="p" tone="muted">
          Repository for requests:{" "}
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            GitHub project
          </a>
        </PrimitiveText>
      </InfoSection>
    </InfoPageLayout>
  );
}
