import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import {
  buildItemPreviewMetadata,
  formatTagLabel,
} from "../lib/closet";

interface ClothingCardProps {
  id: number;
  name: string;
  size: string;
  tags: string[];
  image_url?: string | null;
  index: number;
  onSelect?: (id: number) => void;
  onAddToOutfit?: (id: number) => void;
}

export function ClothingCard({
  id,
  name,
  size,
  tags,
  image_url,
  index,
  onSelect,
  onAddToOutfit,
}: ClothingCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const itemMetadata = buildItemPreviewMetadata(size, tags);
  const handleSelect = () => onSelect?.(id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="group relative cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="relative overflow-hidden bg-muted aspect-[5/6] sm:aspect-[3/4]">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out"
            style={{
              transform: isHovered ? "scale(1.08)" : "scale(1)",
            }}
          />
        ) : (
          <div
            className="h-full w-full p-6 flex flex-col justify-end bg-gradient-to-br from-stone-100 via-neutral-50 to-stone-200 text-stone-700 transition-transform duration-700 ease-out"
            style={{
              transform: isHovered ? "scale(1.03)" : "scale(1)",
            }}
          >
            <div className="space-y-2">
              {tags[0] && (
                <PrimitiveText as="p" variant="overline">
                  {formatTagLabel(tags[0])}
                </PrimitiveText>
              )}
              {itemMetadata && (
                <PrimitiveText as="p" variant="bodySm" className="opacity-70">
                  {itemMetadata}
                </PrimitiveText>
              )}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: image_url ? 0.88 : 0.12 }}
          animate={{ opacity: isHovered ? 1 : image_url ? 0.88 : 0.12 }}
          className="absolute inset-0 bg-gradient-to-t from-neutral-950/88 via-neutral-900/46 to-neutral-900/10"
        />

        <div className="absolute inset-x-0 top-0 p-5 pt-8">
          <PrimitiveText
            as="h3"
            variant="display"
            font="serif"
            className="max-w-[11ch] break-words"
            style={{
              color: image_url ? "white" : "rgba(68, 64, 60, 0.92)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: "0.95",
            }}
          >
            {name}
          </PrimitiveText>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
          className="absolute bottom-4 left-4 right-4"
        >
          <PrimitiveButton
            onClick={(event) => {
              event.stopPropagation();
              onAddToOutfit?.(id);
            }}
            className="h-auto w-full bg-white/90 px-4 py-2 backdrop-blur-sm hover:bg-white"
          >
            <Plus className="w-5 h-5" />
            <PrimitiveText as="span" variant="bodySm">
              Add to Outfit
            </PrimitiveText>
          </PrimitiveButton>
        </motion.div>
      </div>
    </motion.div>
  );
}
