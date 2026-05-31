# Project Structure Index

Last updated: 2026-05-29

This file is intentionally concise and focused on repository structure.
For the product purpose and problem statement, see `wiki.md`.

## Top-Level Layout

```text
project-closet-organizer/
├── .github/                    # CI and automation
├── AGENTS.md                   # Repo-specific working rules for agents and shared docs maintenance
├── back-end/                   # Rails API app
├── front-end/                  # React + Vite UI app
├── Procfile                    # Heroku runtime entrypoint for back-end/
├── package.json                # Frontend build glue for deployment
├── README.md                   # Project overview and setup
├── wiki.md                     # Product purpose and problem statement
├── PROJECT_INDEX.md            # This structure index
├── CHANGELOG.md                # Release notes and tag-aligned history
└── start.sh                    # Boots backend and frontend together
```

## Backend (`back-end`)

- `app/models`: `user`, `clothing_item`, `outfit`, `outfit_item`, `outfit_upload`, and `outfit_detection`
- `app/controllers`: auth/session handling, JSON CRUD controllers, outfit collage/layout-aware outfit updates, upload flows, AI clean-image and transparent-PNG helper endpoints, SPA fallback, and the development/test `X-Test-User-Id` QA auth override in `ApplicationController`
- `app/presenters`: API payload shaping for users, clothing items, outfits, uploads, and detections, including saved outfit collage layout data
- `app/services/`: OpenRouter detection, metadata suggestion, crop refinement, crop verification, single-image catalog cleanup with backdrop selection plus transparent-background cleanup, snapshot-based account mirror sync services, one-time user PNG backfill support, incremental prod-item import support, and shared tempfile/image-source helpers
- `config/routes.rb`: API routes plus HTML fallback routes
- `db/seeds.rb`: demo admin user plus large-scale dev seed (~1k users, ~5k items, ~2k outfits) for pagination/perf testing
- `lib/tasks`: maintenance tasks, including snapshot-based account mirror sync, legacy production-account sync/import helpers, incremental prod-item imports, and one-time clothing-item PNG backfills
- `test/`: model, integration, and service tests

## Frontend (`front-end`)

- `src/app/App.tsx`: route handling, auth-aware layout, and top-level page composition
- `src/app/components/primitives/`: shared button, select, dropdown, and typography primitives that frontend work should reuse first
- `src/app/components/`: routed pages, the closet outfit-cart tray, autosaving item editor flows with persistent Undo/Redo, expanded preview image editing tools, extracted create-item/restricted-state components, and supporting UI
- `src/app/components/OutfitCollageCanvas.tsx`: saved-outfit collage renderer plus the `react-moveable`-backed edit-modal move/resize/rotate interactions and the shared normalized-layout/stage-aspect contract used by both saved and editable outfit previews
- `src/app/components/OutfitCollageLayersPanel.tsx`: focused layers sidebar for thumbnail selection plus pointer and keyboard-accessible layer reordering
- `src/app/lib/routes.ts`: route parsing, navigation helpers, and route guards
- `src/app/lib/api.ts`: shared request/error helpers for frontend API calls, including the development-only `test_user_id` auth override used for local browser QA
- `src/app/lib/closet.ts`: shared types, formatting helpers, and feature-specific API helpers, including clean-image/transparent-PNG preview and save requests plus metadata-suggestion requests
- `src/app/lib/useAiActionState.ts`: shared AI action lifecycle state for create/edit image and metadata flows
- `src/app/lib/useManualCreateAiFlow.ts`: focused manual create-item AI orchestration and staged preview management
- `src/app/lib/useDetectionAiFlow.ts`: focused detection-review AI orchestration and staged preview management
- `src/app/lib/outfitCollage.ts`: shared default-layout and layer-order helpers for saved outfit collages
- `src/app/lib/outfitCollageRenderMath.ts`: shared stage-aspect normalization and resize-aspect helpers that keep saved cards and the editor preview on the same rendering contract
- `src/app/lib/outfitImageBounds.ts`: cached image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `src/app/lib/closetFilters.ts`: closet search, filter, and sort helpers
- `src/app/lib/useItemPhotoState.ts`: shared photo upload and preview state management
- `src/app/lib/useUndoRedoShortcuts.ts`: shared editor keyboard shortcut handling for undo/redo
- `src/app/lib/usePageData.ts`: shared async page-loading hook
- `src/app/lib/useOutfitDraftState.ts`: persisted outfit draft state management
- `tests/`: frontend contract tests run with Node's built-in test runner
- `src/styles/`: fonts, theme, and global styling

## CI

- `.github/workflows/ci.yml`: backend lockfile check, security checks, linting, and tests

## Docs

- `README.md`: current application overview and setup
- `AGENTS.md`: repo-specific frontend and documentation maintenance rules
- `wiki.md`: product purpose and problem statement
- `back-end/README.md`: backend API and environment details
- `front-end/README.md`: frontend routes and integration notes
- `CHANGELOG.md`: release notes plus branch-level unreleased updates when needed
