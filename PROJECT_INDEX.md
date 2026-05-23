# Project Structure Index

Last updated: 2026-05-22

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
- `app/controllers`: auth/session handling, JSON CRUD controllers, outfit collage/layout-aware outfit updates, upload flows, AI helper endpoints, and SPA fallback
- `app/presenters`: API payload shaping for users, clothing items, outfits, uploads, and detections, including saved outfit collage layout data
- `app/services/`: OpenRouter detection, metadata suggestion, crop refinement, crop verification, image-cleaning and background-removal logic, and shared tempfile/image-source helpers
- `config/routes.rb`: API routes plus HTML fallback routes
- `db/seeds.rb`: demo admin user plus large-scale dev seed (~1k users, ~5k items, ~2k outfits) for pagination/perf testing
- `test/`: model, integration, and service tests

## Frontend (`front-end`)

- `src/app/App.tsx`: route handling, auth-aware layout, and top-level page composition
- `src/app/components/primitives/`: shared button, select, dropdown, and typography primitives that frontend work should reuse first
- `src/app/components/`: routed pages, the closet outfit-cart tray, item editor flows, extracted create-item/restricted-state components, and supporting UI
- `src/app/components/OutfitCollageCanvas.tsx`: saved-outfit collage renderer plus the `react-moveable`-backed edit-modal move/resize/rotate interactions and the shared normalized-layout/stage-aspect contract used by both saved and editable outfit previews
- `src/app/components/OutfitCollageLayersPanel.tsx`: focused layers sidebar for thumbnail selection plus pointer and keyboard-accessible layer reordering
- `src/app/lib/routes.ts`: route parsing, navigation helpers, and route guards
- `src/app/lib/api.ts`: shared request/error helpers for frontend API calls
- `src/app/lib/closet.ts`: shared types, formatting helpers, and feature-specific API helpers, including AI preview and metadata-suggestion requests
- `src/app/lib/outfitCollage.ts`: shared default-layout and layer-order helpers for saved outfit collages
- `src/app/lib/outfitImageBounds.ts`: cached image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `src/app/lib/closetFilters.ts`: closet search, filter, and sort helpers
- `src/app/lib/useItemPhotoState.ts`: shared photo upload and preview state management
- `src/app/lib/usePageData.ts`: shared async page-loading hook
- `src/app/lib/useOutfitDraftState.ts`: persisted outfit draft state management
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
