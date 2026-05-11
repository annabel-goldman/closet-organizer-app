import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface OutfitItem {
  id: number;
  name: string;
  imageUrl: string;
}

interface Outfit {
  id: number;
  name: string;
  items: OutfitItem[];
  date: string;
}

interface OutfitBuilderProps {
  outfits: Outfit[];
  isOpen: boolean;
  onClose: () => void;
}

export function OutfitBuilder({ outfits, isOpen, onClose }: OutfitBuilderProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <PrimitiveButton
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-6 right-6"
        >
          <X className="w-6 h-6" />
        </PrimitiveButton>

        <PrimitiveText as="h2" variant="display" font="serif" className="mb-8">
          Saved Outfits
        </PrimitiveText>

        <div className="space-y-8">
          {outfits.map((outfit, index) => (
            <motion.div
              key={outfit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-b border-border pb-8 last:border-0"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <PrimitiveText as="h3" variant="title" font="serif" className="mb-1">
                    {outfit.name}
                  </PrimitiveText>
                  <PrimitiveText as="p" tone="muted">
                    {outfit.date}
                  </PrimitiveText>
                </div>
                <PrimitiveButton variant="outline" className="border-foreground hover:bg-foreground hover:text-background">
                  Wear Today
                </PrimitiveButton>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {outfit.items.map((item) => (
                  <div key={item.id} className="aspect-[3/4] bg-muted overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          <PrimitiveButton
            variant="outline"
            className="h-auto w-full flex-col gap-3 border-2 border-dashed py-8 hover:border-foreground"
          >
            <Plus className="w-8 h-8" />
            <PrimitiveText as="span" variant="overline">
              Create New Outfit
            </PrimitiveText>
          </PrimitiveButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
