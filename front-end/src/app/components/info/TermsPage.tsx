import { PrimitiveText } from "../primitives/PrimitiveText";
import { PROJECT_NAME } from "../../lib/siteContent";
import { InfoPageLayout } from "./InfoPageLayout";
import { InfoSection } from "./InfoSection";

export function TermsPage() {
  return (
    <InfoPageLayout title="Terms & disclaimers">
      <InfoSection heading="Educational use">
        <PrimitiveText as="p" tone="muted">
          {PROJECT_NAME} is provided as a student software-studio project for learning and
          demonstration. It is not a commercial product and may change or be taken offline without
          notice.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="No warranty">
        <PrimitiveText as="p" tone="muted">
          The app is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
          uninterrupted service, accuracy of AI-generated labels or images, or fitness for any
          particular purpose.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="Your content">
        <PrimitiveText as="p" tone="muted">
          You are responsible for photos and information you upload. Do not upload content you do
          not have rights to use. If you export listing text for third-party marketplaces, you are
          responsible for complying with those platforms&apos; policies and applicable laws.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="Third-party services">
        <PrimitiveText as="p" tone="muted">
          Sign-in is handled by Google. Optional AI and hosting services are subject to their own
          terms. Use of those features implies acceptance of their respective policies where
          applicable.
        </PrimitiveText>
      </InfoSection>

      <InfoSection heading="Limitation of liability">
        <PrimitiveText as="p" tone="muted">
          To the fullest extent permitted by law, the project team is not liable for any damages
          arising from use of this application, including loss of data, incorrect AI output, or
          issues with external resale or social platforms.
        </PrimitiveText>
      </InfoSection>
    </InfoPageLayout>
  );
}
