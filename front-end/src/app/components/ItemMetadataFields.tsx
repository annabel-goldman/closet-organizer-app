import {
  ClothingItemFormValues,
  formatDisplaySize,
} from "../lib/closet";
import { PrimitiveText } from "./primitives/PrimitiveText";

interface ItemMetadataFieldsProps {
  onChange: (nextValues: ClothingItemFormValues) => void;
  values: ClothingItemFormValues;
}

const sizeOptions = ["xs", "small", "medium", "large", "xl"];

export function ItemMetadataFields({ onChange, values }: ItemMetadataFieldsProps) {
  function updateField<K extends keyof ClothingItemFormValues>(
    fieldName: K,
    value: ClothingItemFormValues[K],
  ) {
    onChange({
      ...values,
      [fieldName]: value,
    });
  }

  return (
    <>
      <label className="space-y-2 sm:col-span-2">
        <PrimitiveText as="span" variant="label">Name</PrimitiveText>
        <input
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
          required
        />
      </label>

      <label className="space-y-2">
        <PrimitiveText as="span" variant="label">Size</PrimitiveText>
        <select
          value={values.size}
          onChange={(event) => updateField("size", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
        >
          {sizeOptions.map((size) => (
            <option key={size} value={size}>
              {formatDisplaySize(size)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <PrimitiveText as="span" variant="label">Purchase Date</PrimitiveText>
        <input
          type="date"
          value={values.date}
          onChange={(event) => updateField("date", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
        />
      </label>

      <label className="space-y-2 sm:col-span-2">
        <PrimitiveText as="span" variant="label">Tags</PrimitiveText>
        <textarea
          value={values.tags}
          onChange={(event) => updateField("tags", event.target.value)}
          className="min-h-28 w-full border border-border bg-card px-4 py-3"
          placeholder="Try tags like cotton, blue, weekend, office"
        />
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Add comma-separated tags so people can search and filter this item naturally.
        </PrimitiveText>
      </label>
    </>
  );
}
