import { SearchX, Shirt } from "lucide-react";
import { AddItemMenu } from "../AddItemMenu";
import { VisualStatePanel } from "./VisualStatePanel";

interface ClosetEmptyStateProps {
  hasActiveFilters: boolean;
  onSelectImage?: () => void;
  onSelectManual?: () => void;
}

export function ClosetEmptyState({
  hasActiveFilters,
  onSelectImage,
  onSelectManual,
}: ClosetEmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <VisualStatePanel
        icon={SearchX}
        overline="No results"
        title="No matching items found"
        description="Try a different tag, search phrase, or sort—or clear your filters to see the full closet."
      />
    );
  }

  return (
    <VisualStatePanel
      icon={Shirt}
      overline="Your closet"
      title="Start with your first piece"
      description="Add a photo or enter details manually to build a closet you can search, filter, and turn into outfits."
    >
      {onSelectImage && onSelectManual ? (
        <AddItemMenu onSelectImage={onSelectImage} onSelectManual={onSelectManual} />
      ) : null}
    </VisualStatePanel>
  );
}
