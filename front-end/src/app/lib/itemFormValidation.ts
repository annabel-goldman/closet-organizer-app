import type { ClothingItem, ClothingItemFormValues } from "./closet.ts";
import { COMMON_BRANDS } from "./commonBrands.ts";
import { CANONICAL_CLOTHING_CATEGORIES } from "./wardrobeTaxonomy.ts";

export type ClothingItemFormErrors = Partial<Record<keyof ClothingItemFormValues, string>>;

const MAX_NAME_LENGTH = 80;

export function validateClothingItemForm(values: ClothingItemFormValues): ClothingItemFormErrors {
  const errors: ClothingItemFormErrors = {};
  const normalizedCategory = values.category.trim().toLowerCase();
  const trimmedName = values.name.trim();

  if (!normalizedCategory) {
    errors.category = "Choose a type for this item.";
  } else if (
    !CANONICAL_CLOTHING_CATEGORIES.includes(
      normalizedCategory as typeof CANONICAL_CLOTHING_CATEGORIES[number],
    )
  ) {
    errors.category = "Choose one of the available item types.";
  }

  if (!trimmedName) {
    errors.name = "Add a name for this item.";
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function hasClothingItemFormErrors(errors: ClothingItemFormErrors) {
  return Object.keys(errors).length > 0;
}

export function firstInvalidClothingItemField(errors: ClothingItemFormErrors) {
  const order: (keyof ClothingItemFormValues)[] = ["category", "name", "brand", "visualDescription", "tags"];
  return order.find((field) => errors[field]) ?? null;
}

export function clothingItemFieldElementId(field: keyof ClothingItemFormValues) {
  return `item-field-${field}`;
}

export function collectClosetSuggestions(items: ClothingItem[]) {
  const brands = new Set<string>(COMMON_BRANDS);
  const tags = new Set<string>();

  for (const item of items) {
    const brand = item.brand?.trim();
    if (brand) {
      brands.add(brand);
    }

    for (const tag of item.tags) {
      const trimmedTag = tag.trim();
      if (trimmedTag) {
        tags.add(trimmedTag);
      }
    }
  }

  return {
    brandSuggestions: [...brands].sort((left, right) => left.localeCompare(right)),
    tagSuggestions: [...tags].sort((left, right) => left.localeCompare(right)),
  };
}
