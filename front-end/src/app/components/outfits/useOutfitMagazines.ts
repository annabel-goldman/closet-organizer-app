import { useEffect, useMemo, useState } from "react";

import {
  destroyOutfitFolder,
  fetchOutfitFolders,
  type Outfit,
  type OutfitFolder,
} from "../../lib/closet";

interface UseOutfitMagazinesOptions {
  onFlash: (kind: "success" | "error", message: string) => void;
  outfits: Outfit[];
  userId: number;
}

export function useOutfitMagazines({ onFlash, outfits, userId }: UseOutfitMagazinesOptions) {
  const [folders, setFolders] = useState<OutfitFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [folderToDeleteId, setFolderToDeleteId] = useState<number | null>(null);

  const hydratedFolders = useMemo(() => {
    const currentOutfitsById = new Map(outfits.map((outfit) => [outfit.id, outfit]));
    return folders.map((folder) => ({
      ...folder,
      outfits: folder.outfit_ids
        .map((outfitId) => currentOutfitsById.get(outfitId)
          ?? folder.outfits.find((outfit) => outfit.id === outfitId))
        .filter((outfit): outfit is Outfit => Boolean(outfit)),
    }));
  }, [folders, outfits]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);

    fetchOutfitFolders(controller.signal)
      .then(setFolders)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onFlash("error", error instanceof Error ? error.message : "Unable to load magazines.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [onFlash, userId]);

  async function deleteRequestedFolder() {
    if (!folderToDeleteId) return;

    const folderId = folderToDeleteId;
    try {
      await destroyOutfitFolder(folderId);
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      setFolderToDeleteId(null);
      onFlash("success", "Magazine deleted. Your outfits are still saved.");
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : "Unable to delete this magazine.");
    }
  }

  return {
    deleteRequestedFolder,
    folderToDeleteId,
    hydratedFolders,
    isLoading,
    removeOutfit: (outfitId: number) => setFolders((current) => current.map((folder) => ({
      ...folder,
      outfit_ids: folder.outfit_ids.filter((id) => id !== outfitId),
      outfits: folder.outfits.filter((outfit) => outfit.id !== outfitId),
      decorations: folder.decorations.filter((decoration) => decoration.page_key !== `outfit:${outfitId}`),
    }))),
    requestFolderDelete: setFolderToDeleteId,
  };
}
