import { useEffect, useState } from "react";

import {
  createOutfitFolder,
  fetchOutfitFolder,
  fetchOutfits,
  type Outfit,
  type OutfitFolder,
  updateOutfitFolder,
} from "../lib/closet";
import { navigateTo } from "../lib/routes";
import { MagazineEditorForm, type MagazineDraft } from "./MagazineEditorForm";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface MagazineEditorPageProps {
  magazineId: number | null;
}

export function MagazineEditorPage({ magazineId }: MagazineEditorPageProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [folder, setFolder] = useState<OutfitFolder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage("");

    Promise.all([
      fetchOutfits(controller.signal),
      magazineId ? fetchOutfitFolder(magazineId, controller.signal) : Promise.resolve(null),
    ])
      .then(([nextOutfits, nextFolder]) => {
        setOutfits(nextOutfits);
        setFolder(nextFolder);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the magazine editor.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [magazineId]);

  async function handleSave(draft: MagazineDraft) {
    setIsSaving(true);
    setErrorMessage("");
    try {
      if (magazineId) {
        await updateOutfitFolder(magazineId, draft);
        navigateTo("/outfits?view=magazines");
      } else {
        const createdFolder = await createOutfitFolder(draft);
        navigateTo(`/magazines/${createdFolder.id}/edit`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save this magazine.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-6 py-12" role="status">
        <PrimitiveText tone="muted">Loading magazine workspace…</PrimitiveText>
      </div>
    );
  }

  if (errorMessage && (!magazineId || !folder)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <PrimitiveText as="h1" variant="display" font="serif">Magazine unavailable</PrimitiveText>
        <PrimitiveText as="p" tone="muted" className="mt-3">{errorMessage}</PrimitiveText>
        <PrimitiveButton type="button" variant="outline" className="mt-6" onClick={() => navigateTo("/outfits?view=magazines")}>
          Back to magazines
        </PrimitiveButton>
      </div>
    );
  }

  return (
    <>
      {errorMessage ? (
        <div className="fixed right-6 top-24 z-50 max-w-sm border border-destructive/25 bg-destructive/10 px-4 py-3 text-destructive" role="alert">
          {errorMessage}
        </div>
      ) : null}
      <MagazineEditorForm
        key={folder?.id ?? "new"}
        folder={folder}
        isSaving={isSaving}
        outfits={outfits}
        onCancel={() => navigateTo("/outfits?view=magazines")}
        onError={setErrorMessage}
        onSave={(draft) => void handleSave(draft)}
      />
    </>
  );
}
