# Frontend Guidelines

## Structure

- Keep route components focused on page behavior, not shared plumbing.
- Put shared request logic in `src/app/lib/api.ts`.
- Put route parsing and navigation helpers in `src/app/lib/routes.ts`.
- Put search, sort, and filter helpers in focused utility modules instead of `App.tsx`.
- Extract multi-step UI flows into subcomponents once a single file starts mixing orchestration and rendering.

## State

- Prefer one coherent state object over several parallel state variables when fields are edited together.
- Use shared hooks like `usePageData` and `useOutfitDraftState` instead of repeating fetch lifecycle or local-storage wiring in each page.
- Avoid introducing local UI state for behavior that CSS can express cleanly.

## API Integration

- Use the shared request helpers so credentials, JSON parsing, and API error formatting stay consistent.
- Normalize backend payloads at the API/helper layer instead of scattering payload cleanup through components.
- Keep `closet.ts` focused on shared types, formatting helpers, and feature-facing frontend API functions.

## Components

- Prefer small presentational components with clear props over long files that mix several visual sections.
- Reuse shared restricted/error/loading patterns when the UX should stay consistent across pages.
- Keep item and outfit forms readable by extracting repeated field blocks or review cards once a page becomes hard to scan.

## Styling

- Preserve the established editorial look: serif headings, clean cards, and tailored spacing.
- Use flexbox and grid first; only use absolute positioning when it is clearly necessary.
- Favor existing UI primitives under `src/app/components/ui/` before introducing new ad hoc patterns.

## Refactoring Expectations

- When touching a large file, leave it cleaner than you found it.
- Prefer removing duplication in state transitions, async loading, and fetch handling before adding new abstractions elsewhere.
- If a helper or wrapper only renames another function without adding clarity, inline it.
