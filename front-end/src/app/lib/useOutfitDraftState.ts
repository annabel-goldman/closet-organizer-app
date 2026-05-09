import { useEffect, useState } from "react";
import { emptyOutfitDraft, loadOutfitDraft, OutfitDraft, saveOutfitDraft, User } from "./closet";

export function useOutfitDraftState(user: User | null) {
  const [outfitDraft, setOutfitDraft] = useState<OutfitDraft>(emptyOutfitDraft());

  useEffect(() => {
    if (!user) {
      setOutfitDraft(emptyOutfitDraft());
      return;
    }

    const availableItemIds = new Set(user.clothing_items.map((item) => item.id));
    const persisted = loadOutfitDraft(user.id);

    setOutfitDraft({
      ...persisted,
      itemIds: persisted.itemIds.filter((itemId) => availableItemIds.has(itemId)),
    });
  }, [user?.id, user?.clothing_items]);

  useEffect(() => {
    if (!user) {
      return;
    }

    saveOutfitDraft(user.id, outfitDraft);
  }, [outfitDraft, user]);

  return [outfitDraft, setOutfitDraft] as const;
}
