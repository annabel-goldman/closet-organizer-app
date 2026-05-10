# AGENTS.md

## Frontend UI Architecture

When building or refactoring frontend UI in this repo, prefer the shared primitives in `front-end/src/app/components/primitives/` before introducing custom button or dropdown markup.

Use these first:

- `front-end/src/app/components/primitives/PrimitiveButton.tsx`
- `front-end/src/app/components/primitives/PrimitiveSelect.tsx`
- `front-end/src/app/components/primitives/PrimitiveDropdownMenu.tsx`
- `front-end/src/app/components/primitives/PrimitiveDropdownTriggerButton.tsx`
- `front-end/src/app/components/primitives/PrimitiveText.tsx`

## Default Rule

- Reuse an existing primitive when it already fits the interaction.
- If a new visual variation is needed, extend the primitive instead of duplicating styles in page-level or feature-level components.
- Keep app-specific composition outside the primitives layer, but keep shared interaction patterns, sizing, spacing, and focus treatment inside the primitives layer.
- Do not hand-roll new button, select trigger, dropdown trigger, or recurring typography styles in feature files unless there is a strong reason the existing primitives cannot support the use case.

## Goal

This project should use a consistent control and typography system so new UI work stays visually aligned and easier to maintain.
