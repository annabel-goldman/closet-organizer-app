import { KeyboardEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  ClothingItemFormValues,
  formatDisplaySize,
  formatTagInput,
  parseTagInput,
} from "../lib/closet";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import {
  MAX_CLOTHING_ITEM_BRAND,
  MAX_CLOTHING_ITEM_CATEGORY,
  MAX_CLOTHING_ITEM_NAME,
  MAX_TAG_LENGTH,
} from "../lib/inputLengthPolicy";

interface ItemMetadataFieldsProps {
  autofillDisabled?: boolean;
  isAutofilling?: boolean;
  onChange: (nextValues: ClothingItemFormValues) => void;
  onRequestAutofill?: () => void;
  showAutofillButton?: boolean;
  values: ClothingItemFormValues;
}

const sizeOptions = ["na", "xs", "small", "medium", "large", "xl"];

export function ItemMetadataFields({
  autofillDisabled = false,
  isAutofilling = false,
  onChange,
  onRequestAutofill,
  showAutofillButton = true,
  values,
}: ItemMetadataFieldsProps) {
  const [draftTag, setDraftTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const tags = parseTagInput(values.tags);
  const visibleTags = editingTag ? tags.filter((tag) => tag !== editingTag) : tags;

  function updateField<K extends keyof ClothingItemFormValues>(
    fieldName: K,
    value: ClothingItemFormValues[K],
  ) {
    onChange({
      ...values,
      [fieldName]: value,
    });
  }

  function updateTags(nextTags: string[]) {
    updateField("tags", formatTagInput(nextTags));
  }

  function handleAddTag() {
    const baseTags = editingTag ? tags.filter((tag) => tag !== editingTag) : tags;
    const nextTags = parseTagInput([...baseTags, draftTag].filter(Boolean).join(","));

    updateTags(nextTags);
    setDraftTag("");
    setEditingTag(null);
    setIsAddingTag(false);
  }

  function closeTagEditor() {
    setDraftTag("");
    setEditingTag(null);
    setIsAddingTag(false);
  }

  function handleTagInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddTag();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeTagEditor();
    }
  }

  function removeTag(tagToRemove: string) {
    updateTags(tags.filter((tag) => tag !== tagToRemove));
  }

  function beginTagEdit(tag: string) {
    setDraftTag(tag);
    setEditingTag(tag);
    setIsAddingTag(true);
  }

  return (
    <>
      {onRequestAutofill && showAutofillButton ? (
        <div className="flex justify-end sm:col-span-2">
          <AiMetadataAutofillButton
            className="h-9 w-9"
            disabled={autofillDisabled}
            isLoading={isAutofilling}
            label="AI autofill name, brand, and tags"
            onClick={onRequestAutofill}
          />
        </div>
      ) : null}

      <label className="space-y-2 sm:col-span-2">
        <PrimitiveText as="span" variant="label">Type</PrimitiveText>
        <input
          value={values.category}
          onChange={(event) => updateField("category", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
          placeholder="e.g. sweater, jacket, dress"
          maxLength={MAX_CLOTHING_ITEM_CATEGORY}
        />
      </label>

      <label className="space-y-2 sm:col-span-2">
        <PrimitiveText as="span" variant="label">Name</PrimitiveText>
        <input
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
          required
          maxLength={MAX_CLOTHING_ITEM_NAME}
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
        <PrimitiveText as="span" variant="label">Brand</PrimitiveText>
        <input
          value={values.brand}
          onChange={(event) => updateField("brand", event.target.value)}
          className="w-full border border-border bg-card px-4 py-3"
          placeholder="Optional, e.g. COS, Nike"
          maxLength={MAX_CLOTHING_ITEM_BRAND}
        />
      </label>

      <div className="space-y-2 sm:col-span-2">
        <PrimitiveText as="span" variant="label">Tags</PrimitiveText>
        <div className="flex min-h-14 flex-wrap items-center gap-2 border border-border bg-card px-3 py-3">
          {visibleTags.map((tag) => (
            <div
              key={tag}
              className="inline-flex h-9 items-center gap-1 border border-border bg-background px-3 py-1"
              onDoubleClick={() => beginTagEdit(tag)}
            >
              <PrimitiveText as="span" variant="bodySm">
                {tag}
              </PrimitiveText>
              <PrimitiveButton
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag} tag`}
              >
                <X className="w-3 h-3" />
              </PrimitiveButton>
            </div>
          ))}

          {isAddingTag ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draftTag}
                onChange={(event) => setDraftTag(event.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tag"
                className="h-9 w-32 border border-border bg-background px-3 py-1"
                autoFocus
                maxLength={MAX_TAG_LENGTH}
              />
              <PrimitiveButton
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={handleAddTag}
                disabled={!draftTag.trim()}
                aria-label="Save tag"
              >
                <Plus className="w-4 h-4" />
              </PrimitiveButton>
              <PrimitiveButton
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={closeTagEditor}
                aria-label="Cancel adding tag"
              >
                <X className="w-4 h-4" />
              </PrimitiveButton>
            </div>
          ) : (
            <PrimitiveButton
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setEditingTag(null);
                setIsAddingTag(true);
              }}
              aria-label="Add a tag"
            >
              <Plus className="w-4 h-4" />
            </PrimitiveButton>
          )}
        </div>
      </div>
    </>
  );
}
