import { useEffect, useMemo, useState } from "react";

import {
  createOutfitFolder,
  destroyOutfitFolder,
  fetchOutfitFolders,
  type Outfit,
  type OutfitFolder,
  updateOutfitFolder,
} from "../../lib/closet";

export interface OutfitFolderDraft {
  name: string;
  notes: string;
  outfitIds: number[];
}

interface UseOutfitMagazinesOptions {
  onFlash: (kind: "success" | "error", message: string) => void;
  outfits: Outfit[];
  userId: number;
}

export function useOutfitMagazines({ onFlash, outfits, userId }: UseOutfitMagazinesOptions) {
  const [folders, setFolders] = useState<OutfitFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isMagazineOpen, setIsMagazineOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const editingFolder = folders.find((folder) => folder.id === editingFolderId) ?? null;
  const selectedFolder = hydratedFolders.find((folder) => folder.id === selectedFolderId) ?? null;

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

  async function saveFolder(draft: OutfitFolderDraft) {
    setIsSaving(true);
    try {
      const savedFolder = editingFolder
        ? await updateOutfitFolder(editingFolder.id, draft)
        : await createOutfitFolder(draft);

      setFolders((current) => current.some((folder) => folder.id === savedFolder.id)
        ? current.map((folder) => folder.id === savedFolder.id ? savedFolder : folder)
        : [savedFolder, ...current]);
      setSelectedFolderId(savedFolder.id);
      setIsFolderDialogOpen(false);
      setEditingFolderId(null);
      onFlash("success", editingFolder ? "Magazine updated." : "Magazine created.");
      return savedFolder;
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : "Unable to save this magazine.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRequestedFolder() {
    if (!folderToDeleteId) return;

    const folderId = folderToDeleteId;
    try {
      await destroyOutfitFolder(folderId);
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      setFolderToDeleteId(null);
      onFlash("success", "Magazine deleted. Your outfits are still saved.");
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : "Unable to delete this magazine.");
    }
  }

  return {
    closeFolderDialog: () => {
      setIsFolderDialogOpen(false);
      setEditingFolderId(null);
    },
    closeMagazine: () => setIsMagazineOpen(false),
    deleteRequestedFolder,
    editingFolder,
    folderToDeleteId,
    hydratedFolders,
    isFolderDialogOpen,
    isLoading,
    isMagazineOpen,
    isSaving,
    openCreateFolder: () => {
      setEditingFolderId(null);
      setIsFolderDialogOpen(true);
    },
    openEditFolder: (folder: OutfitFolder) => {
      setEditingFolderId(folder.id);
      setIsFolderDialogOpen(true);
    },
    openMagazine: (folder: OutfitFolder) => {
      setSelectedFolderId(folder.id);
      setIsMagazineOpen(true);
    },
    removeOutfit: (outfitId: number) => setFolders((current) => current.map((folder) => ({
      ...folder,
      outfit_ids: folder.outfit_ids.filter((id) => id !== outfitId),
      outfits: folder.outfits.filter((outfit) => outfit.id !== outfitId),
      decorations: folder.decorations.filter((decoration) => decoration.page_key !== `outfit:${outfitId}`),
    }))),
    requestFolderDelete: setFolderToDeleteId,
    saveFolder,
    selectedFolder,
    updateFolder: (folder: OutfitFolder) => setFolders((current) =>
      current.map((entry) => entry.id === folder.id ? folder : entry)),
  };
}
