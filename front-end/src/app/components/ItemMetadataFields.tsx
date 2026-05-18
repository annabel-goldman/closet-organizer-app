import { CircleHelp } from "lucide-react";
import {
  ClothingItemFormValues,
  formatDisplaySize,
} from "../lib/closet";
import { ClothingItemFormErrors, clothingItemFieldElementId } from "../lib/itemFormValidation";
import {
  PrimitiveSelect,
  PrimitiveSelectContent,
  PrimitiveSelectItem,
  PrimitiveSelectTrigger,
  PrimitiveSelectValue,
} from "./primitives/PrimitiveSelect";
import { PrimitiveText } from "./primitives/PrimitiveText";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ItemMetadataFieldsProps {
  brandSuggestions?: string[];
  errors?: ClothingItemFormErrors;
  fieldIdPrefix?: string;
  onChange: (nextValues: ClothingItemFormValues) => void;
  tagSuggestions?: string[];
  values: ClothingItemFormValues;
}

const sizeOptions = ["xs", "small", "medium", "large", "xl"];

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <PrimitiveText as="p" variant="bodySm" tone="destructiveSoft" role="alert">
      {message}
    </PrimitiveText>
  );
}

function LabelWithTooltip({
  htmlFor,
  label,
  tooltip,
}: {
  htmlFor: string;
  label: string;
  tooltip: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <PrimitiveText as="span" variant="label">
        <label htmlFor={htmlFor}>{label}</label>
      </PrimitiveText>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`More about ${label.toLowerCase()}`}
          >
            <CircleHelp className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ItemMetadataFields({
  brandSuggestions = [],
  errors = {},
  fieldIdPrefix = "",
  onChange,
  tagSuggestions = [],
  values,
}: ItemMetadataFieldsProps) {
  function updateField<K extends keyof ClothingItemFormValues>(
    fieldName: K,
    value: ClothingItemFormValues[K],
  ) {
    onChange({
      ...values,
      [fieldName]: value,
    });
  }

  const brandListId = `${fieldIdPrefix}item-brand-suggestions`;
  const tagListId = `${fieldIdPrefix}item-tag-suggestions`;

  function fieldId(field: keyof ClothingItemFormValues) {
    return `${fieldIdPrefix}${clothingItemFieldElementId(field)}`;
  }

  return (
    <>
      <label className="space-y-2 sm:col-span-2" htmlFor={fieldId("name")}>
        <PrimitiveText as="span" variant="label">
          Name
        </PrimitiveText>
        <Input
          id={fieldId("name")}
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
          className="h-auto px-4 py-3"
        />
        <FieldError message={errors.name} />
        {errors.name ? (
          <span id={`${fieldId("name")}-error`} className="sr-only">
            {errors.name}
          </span>
        ) : null}
      </label>

      <div className="space-y-2">
        <PrimitiveText as="span" variant="label" id={`${fieldId("size")}-label`}>
          Size
        </PrimitiveText>
        <PrimitiveSelect value={values.size} onValueChange={(value) => updateField("size", value)}>
          <PrimitiveSelectTrigger
            id={fieldId("size")}
            aria-labelledby={`${fieldId("size")}-label`}
            className="h-auto px-4 py-3"
          >
            <PrimitiveSelectValue placeholder="Select size" />
          </PrimitiveSelectTrigger>
          <PrimitiveSelectContent>
            {sizeOptions.map((size) => (
              <PrimitiveSelectItem key={size} value={size}>
                {formatDisplaySize(size)}
              </PrimitiveSelectItem>
            ))}
          </PrimitiveSelectContent>
        </PrimitiveSelect>
      </div>

      <label className="space-y-2" htmlFor={fieldId("date")}>
        <PrimitiveText as="span" variant="label">
          Purchase Date
        </PrimitiveText>
        <Input
          id={fieldId("date")}
          type="date"
          value={values.date}
          onChange={(event) => updateField("date", event.target.value)}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? `${fieldId("date")}-error` : undefined}
          className="h-auto px-4 py-3"
        />
        <FieldError message={errors.date} />
        {errors.date ? (
          <span id={`${fieldId("date")}-error`} className="sr-only">
            {errors.date}
          </span>
        ) : null}
      </label>

      <label className="space-y-2 sm:col-span-2" htmlFor={fieldId("brand")}>
        <LabelWithTooltip
          htmlFor={fieldId("brand")}
          label="Brand"
          tooltip="Brands power the Brands filter on your closet. Start typing to reuse a brand you have already saved."
        />
        <Input
          id={fieldId("brand")}
          list={brandSuggestions.length > 0 ? brandListId : undefined}
          value={values.brand}
          onChange={(event) => updateField("brand", event.target.value)}
          placeholder="Optional, e.g. COS, Nike"
          className="h-auto px-4 py-3"
        />
        {brandSuggestions.length > 0 ? (
          <datalist id={brandListId}>
            {brandSuggestions.map((brand) => (
              <option key={brand} value={brand} />
            ))}
          </datalist>
        ) : null}
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Used for the Brands filter on your closet. Tags stay separate.
        </PrimitiveText>
      </label>

      <label className="space-y-2 sm:col-span-2" htmlFor={fieldId("tags")}>
        <LabelWithTooltip
          htmlFor={fieldId("tags")}
          label="Tags"
          tooltip="Comma-separated tags help search and filters. Reuse existing tags from your closet when you can."
        />
        <Textarea
          id={fieldId("tags")}
          list={tagSuggestions.length > 0 ? tagListId : undefined}
          value={values.tags}
          onChange={(event) => updateField("tags", event.target.value)}
          placeholder="Try tags like cotton, blue, weekend, office"
          className="min-h-28 px-4 py-3"
        />
        {tagSuggestions.length > 0 ? (
          <datalist id={tagListId}>
            {tagSuggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        ) : null}
        <PrimitiveText as="p" variant="bodySm" tone="muted">
          Add comma-separated tags so people can search and filter this item naturally.
        </PrimitiveText>
      </label>
    </>
  );
}
