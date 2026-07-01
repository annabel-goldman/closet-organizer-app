import { useEffect, useRef, useState } from "react";

export interface ItemPhotoStateSnapshot {
  removeExisting: boolean;
  selectedFile: File | null;
}

export function useItemPhotoState(existingImageUrl?: string | null) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const imageUrl = previewUrl ?? (removeExisting ? null : existingImageUrl ?? null);

  function updateSelectedFile(file: File | null) {
    setSelectedFile(file);
    setRemoveExisting(false);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return file ? URL.createObjectURL(file) : null;
    });
  }

  function clearInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function clearSelectedFile() {
    updateSelectedFile(null);
    clearInput();
  }

  function markExistingForRemoval() {
    clearSelectedFile();
    setRemoveExisting(true);
  }

  function keepExistingPhoto() {
    setRemoveExisting(false);
  }

  function reset() {
    setSelectedFile(null);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setRemoveExisting(false);
    clearInput();
  }

  function getSnapshot(): ItemPhotoStateSnapshot {
    return {
      removeExisting,
      selectedFile,
    };
  }

  function restoreSnapshot(snapshot: ItemPhotoStateSnapshot) {
    updateSelectedFile(snapshot.selectedFile);
    setRemoveExisting(snapshot.removeExisting);
    clearInput();
  }

  return {
    inputRef,
    imageUrl,
    removeExisting,
    selectedFile,
    clearSelectedFile,
    keepExistingPhoto,
    markExistingForRemoval,
    reset,
    getSnapshot,
    restoreSnapshot,
    updateSelectedFile,
  };
}
