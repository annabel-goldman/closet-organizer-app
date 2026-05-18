import { ClothingItem, ClothingItemFormValues } from "./closet";

export type ClothingItemFormErrors = Partial<Record<keyof ClothingItemFormValues, string>>;

const MAX_NAME_LENGTH = 80;

export function validateClothingItemForm(values: ClothingItemFormValues): ClothingItemFormErrors {
  const errors: ClothingItemFormErrors = {};
  const trimmedName = values.name.trim();

  if (!trimmedName) {
    errors.name = "Add a name for this item.";
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  if (values.date) {
    const purchaseDate = new Date(`${values.date}T12:00:00`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (Number.isNaN(purchaseDate.getTime())) {
      errors.date = "Enter a valid purchase date.";
    } else if (purchaseDate > today) {
      errors.date = "Purchase date cannot be in the future.";
    }
  }

  return errors;
}

export function hasClothingItemFormErrors(errors: ClothingItemFormErrors) {
  return Object.keys(errors).length > 0;
}

export function firstInvalidClothingItemField(errors: ClothingItemFormErrors) {
  const order: (keyof ClothingItemFormValues)[] = ["category", "name", "size", "date", "brand", "tags"];
  return order.find((field) => errors[field]) ?? null;
}

export function clothingItemFieldElementId(field: keyof ClothingItemFormValues) {
  return `item-field-${field}`;
}

export function collectClosetSuggestions(items: ClothingItem[]) {
  const brands = new Set<string>();
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
