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

## Changelog Maintenance

- Before merging anything, open `CHANGELOG.md` first.
- Compare `CHANGELOG.md` against the history of `main` and the current branch, including tags and branch-only commits, to determine whether the file is out of date.
- Update `CHANGELOG.md` before merging whenever the branch adds user-facing behavior, API changes, dependency or security updates, or other changes that should be captured in release notes.
- Keep release numbering aligned with the branch history. If the branch has untagged work that still needs to be documented, add it under an `Unreleased` section until the release version is known.

## Documentation Maintenance

- Keep these files aligned with the current codebase: `AGENTS.md`, `CHANGELOG.md`, `PROJECT_INDEX.md`, `wiki.md`, `front-end/README.md`, and `back-end/README.md`.
- Update `PROJECT_INDEX.md` whenever repository structure, major source-file responsibilities, or the documentation set changes.
- Keep `wiki.md` intentionally narrow. It should only contain the product purpose and problem statement, not implementation notes, roadmaps, references, or setup details.
- Keep `front-end/README.md` focused on the current frontend architecture, routes, major flows, and the shared primitives rule from this file.
- Keep `back-end/README.md` focused on the current backend routes, services, environment variables, and data model.
- Remove references to deleted or retired docs when the docs set changes. Do not leave stale pointers to files that no longer exist.
- When backend endpoints, frontend routes, shared primitives, or AI flows change, update the corresponding README files in the same branch before merging.
- When rewriting docs, prefer describing the current state of the code instead of preserving milestone-era wording that no longer matches the app.
