import { KeyboardEvent, useState } from "react";
import { CircleHelp, Plus, X } from "lucide-react";
import {
  ClothingItemFormValues,
  formatDisplaySize,
  formatTagInput,
  parseTagInput,
} from "../lib/closet";
import { ClothingItemFormErrors, clothingItemFieldElementId } from "../lib/itemFormValidation";
import { AiMetadataAutofillButton } from "./AiMetadataAutofillButton";
import {
  PrimitiveSelect,
  PrimitiveSelectContent,
  PrimitiveSelectItem,
  PrimitiveSelectTrigger,
  PrimitiveSelectValue,
} from "./primitives/PrimitiveSelect";
import { PrimitiveButton } from "./primitives/PrimitiveButton";
import { PrimitiveText } from "./primitives/PrimitiveText";
import {
  MAX_CLOTHING_ITEM_BRAND,
  MAX_CLOTHING_ITEM_CATEGORY,
  MAX_CLOTHING_ITEM_NAME,
  MAX_TAG_LENGTH,
} from "../lib/inputLengthPolicy";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";

interface ItemMetadataFieldsProps {
  autofillDisabled?: boolean;
  brandSuggestions?: string[];
  errors?: ClothingItemFormErrors;
  fieldIdPrefix?: string;
  isAutofilling?: boolean;
  onChange: (nextValues: ClothingItemFormValues) => void;
  onFieldCommit?: (nextValues: ClothingItemFormValues) => void;
  onRequestAutofill?: () => void;
  showAutofillButton?: boolean;
  tagSuggestions?: string[];
  values: ClothingItemFormValues;
}

const sizeOptions = ["na", "xs", "small", "medium", "large", "xl"];

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

function BrandAutocomplete({
  id,
  value,
  onChange,
  onCommit,
  suggestions,
  placeholder,
  className,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  onCommit?: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const filtered = value
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;
  return (
    <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className={className}
          maxLength={maxLength}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(e.target.value.length > 0);
          }}
          onFocus={() => {}}
          onBlur={(event) => {
            onCommit?.(event.target.value);
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="p-0"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {filtered.map((brand) => (
                <CommandItem
                  key={brand}
                  value={brand}
                  onSelect={() => {
                    onChange(brand);
                    onCommit?.(brand);
                    setOpen(false);
                  }}
                >
                  {brand}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ItemMetadataFields({
  autofillDisabled = false,
  brandSuggestions = [],
  errors = {},
  fieldIdPrefix = "",
  isAutofilling = false,
  onChange,
  onFieldCommit,
  onRequestAutofill,
  showAutofillButton = true,
  tagSuggestions = [],
  values,
}: ItemMetadataFieldsProps) {
  const [draftTag, setDraftTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const tags = parseTagInput(values.tags);
  const visibleTags = editingTag ? tags.filter((tag) => tag !== editingTag) : tags;

  const tagListId = `${fieldIdPrefix}item-tag-suggestions`;

  function fieldId(field: keyof ClothingItemFormValues) {
    return `${fieldIdPrefix}${clothingItemFieldElementId(field)}`;
  }

  function nextFieldValues<K extends keyof ClothingItemFormValues>(
    fieldName: K,
    value: ClothingItemFormValues[K],
  ) {
    return {
      ...values,
      [fieldName]: value,
    };
  }

  function updateField<K extends keyof ClothingItemFormValues>(
    fieldName: K,
    value: ClothingItemFormValues[K],
  ) {
    const nextValues = nextFieldValues(fieldName, value);

    onChange(nextValues);
    return nextValues;
  }

  function updateTags(nextTags: string[]) {
    return updateField("tags", formatTagInput(nextTags));
  }

  function commitValues(nextValues: ClothingItemFormValues = values) {
    onFieldCommit?.(nextValues);
  }

  function handleAddTag() {
    const baseTags = editingTag ? tags.filter((tag) => tag !== editingTag) : tags;
    const nextTags = parseTagInput([...baseTags, draftTag].filter(Boolean).join(","));

    const nextValues = updateTags(nextTags);
    setDraftTag("");
    setEditingTag(null);
    setIsAddingTag(false);
    commitValues(nextValues);
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
    const nextValues = updateTags(tags.filter((tag) => tag !== tagToRemove));
    commitValues(nextValues);
  }

  function beginTagEdit(tag: string) {
    setDraftTag(tag);
    setEditingTag(tag);
    setIsAddingTag(true);
  }

  function addTagFromSuggestion(tag: string) {
    if (!tag.trim() || tags.includes(tag.trim())) {
      return;
    }

    const nextValues = updateTags([...tags, tag.trim()]);
    commitValues(nextValues);
  }

  return (
    <>
      {onRequestAutofill && showAutofillButton ? (
        <div className="flex justify-end sm:col-span-full">
          <AiMetadataAutofillButton
            className="h-9 w-9"
            disabled={autofillDisabled}
            isLoading={isAutofilling}
            label="AI autofill type, name, brand, and tags"
            onClick={onRequestAutofill}
          />
        </div>
      ) : null}

      <label className="space-y-2 sm:col-span-full" htmlFor={fieldId("name")}>
        <PrimitiveText as="span" variant="label">
          Name
        </PrimitiveText>
        <Input
          id={fieldId("name")}
          value={values.name}
          onBlur={(event) => commitValues(nextFieldValues("name", event.target.value))}
          onChange={(event) => updateField("name", event.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
          className="h-auto px-4 py-3"
          required
          maxLength={MAX_CLOTHING_ITEM_NAME}
        />
        <FieldError message={errors.name} />
        {errors.name ? (
          <span id={`${fieldId("name")}-error`} className="sr-only">
            {errors.name}
          </span>
        ) : null}
      </label>

      <label className="space-y-2 sm:col-span-full" htmlFor={fieldId("category")}>
        <PrimitiveText as="span" variant="label">
          Type
        </PrimitiveText>
        <Input
          id={fieldId("category")}
          value={values.category}
          onBlur={(event) => commitValues(nextFieldValues("category", event.target.value))}
          onChange={(event) => updateField("category", event.target.value)}
          placeholder="e.g. sweater, jacket, dress"
          className="h-auto px-4 py-3"
          maxLength={MAX_CLOTHING_ITEM_CATEGORY}
        />
      </label>

      <div className="space-y-2">
        <PrimitiveText as="span" variant="label" id={`${fieldId("size")}-label`}>
          Size
        </PrimitiveText>
        <PrimitiveSelect
          value={values.size}
          onValueChange={(value) => {
            const nextValues = updateField("size", value);
            commitValues(nextValues);
          }}
        >
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
          onBlur={(event) => commitValues(nextFieldValues("date", event.target.value))}
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

      <label className="space-y-2" htmlFor={fieldId("brand")}>
        <PrimitiveText as="span" variant="label">
          Brand
        </PrimitiveText>
        <BrandAutocomplete
          id={fieldId("brand")}
          value={values.brand ?? ""}
          onChange={(val) => updateField("brand", val)}
          onCommit={(val) => commitValues(nextFieldValues("brand", val))}
          suggestions={brandSuggestions}
          placeholder="Optional, e.g. COS, Nike"
          className="h-auto px-4 py-3"
          maxLength={MAX_CLOTHING_ITEM_BRAND}
        />
      </label>

      <div className="space-y-2 sm:col-span-full">
        <LabelWithTooltip
          htmlFor={fieldId("tags")}
          label="Tags"
          tooltip="Add tags to improve search and filters. Double-click a tag to edit it, or pick from your closet suggestions."
        />
        <div
          className="flex min-h-14 flex-wrap items-center gap-2 border border-border bg-card px-3 py-3"
          id={fieldId("tags")}
        >
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
                list={tagSuggestions.length > 0 ? tagListId : undefined}
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
        {tagSuggestions.length > 0 ? (
          <>
            <datalist id={tagListId}>
              {tagSuggestions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-2">
              {tagSuggestions.slice(0, 8).map((tag) => (
                <PrimitiveButton
                  key={tag}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => addTagFromSuggestion(tag)}
                  disabled={tags.includes(tag)}
                >
                  {tag}
                </PrimitiveButton>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
