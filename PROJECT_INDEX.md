# Project Structure Index

Last updated: 2026-08-28

This file is intentionally concise and focused on repository structure.
For the product purpose and problem statement, see `wiki.md`.

## Top-Level Layout

```text
project-closet-organizer/
├── .github/                    # CI, frontend checks, and Heroku deploy automation
├── AGENTS.md                   # Repo-specific working rules for agents and shared docs maintenance
├── back-end/                   # Rails API app
├── front-end/                  # React + Vite UI app
├── Procfile                    # Heroku runtime entrypoint for back-end/
├── package.json                # Frontend build glue for deployment
├── DEPLOYMENT.md               # Heroku/GitHub Actions deployment runbook
├── README.md                   # Project overview and setup
├── wiki.md                     # Product purpose and problem statement
├── PROJECT_INDEX.md            # This structure index
├── CHANGELOG.md                # Release notes and tag-aligned history
├── start.sh                    # Boots backend and frontend together
└── stop.sh                     # Stops local backend and frontend dev servers without restarting
```

## Backend (`back-end`)

- `app/models`: `user`, ordered private `model_reference_image` records, `clothing_item`, `outfit`, `outfit_item`, generated-outfit feedback logs, `outfit_upload`, `outfit_detection`, and staged `ai_workflow`/`ai_workflow_stage`/`ai_artifact` records
- `app/controllers`: auth/session handling, JSON CRUD controllers, authenticated private model-reference management/thumbnails, outfit collage/layout-aware outfit updates, upload flows, AI readiness/workflow/model-preview endpoints, and SPA fallback
- `app/jobs`: asynchronous outfit-upload analysis, saved-item image cleaning, AI outfit creation, and staged modeled item/full-outfit image generation jobs
- `app/presenters`: API payload shaping for users, clothing items, outfits, uploads, and detections, including saved outfit collage layout data, modeled workflow state, and optional AI generation metadata
- `app/services/`: OpenRouter detection, item and outfit metadata suggestion, two-stage outfit generation, generated-outfit preference feedback, crop refinement, crop verification, Gemini catalog/modeled-item generation, Seedream full-outfit generation through the dedicated Images API, image-cleaning and background-removal logic, and shared tempfile/image-source helpers
- `config/routes.rb`: API routes plus HTML fallback routes
- `db/seeds.rb`: demo admin user plus large-scale dev seed (~1k users, ~5k items, ~2k outfits) for pagination/perf testing
- `test/`: model, integration, and service tests

## Frontend (`front-end`)

- `src/app/App.tsx`: route handling, auth-aware layout, top-level page composition, and cross-route polling/cancellation/result synchronization for durable generation tasks
- `src/app/components/primitives/`: shared button, select, dropdown, and typography primitives that frontend work should reuse first
- `src/app/components/shared/ai/`: reusable AI stage timeline and before/after artifact comparison primitives; active generation status is surfaced by global task toasts
- `src/app/components/shared/ModelReferenceDialog.tsx`: private three-photo model-reference uploader, primary-order controls, authenticated thumbnails, and removal controls surfaced from the existing header
- `src/app/components/shared/ModeledPreviewPanel.tsx`: minimal modeled-item image and confirmed deletion surface; successful previews are published automatically and workflow stages stay out of the UI
- `src/app/components/shared/ModeledPreviewImageEditor.tsx`: shared modeled-item/outfit edit dialog that loads private workflow imagery into the existing crop, rotate, magic-wand, and undo/redo editor and persists the resulting image
- `src/app/components/shared/GenerationTaskToasts.tsx`: global lower-right modeled outfit/item, image-cleaning, outfit-creation, and photo-detection notices with cross-route cancellation, completion states, and result navigation
- `src/app/components/`: routed pages, the closet outfit-cart tray, item editor flows, extracted create-item/restricted-state components, and supporting UI
- `public/demo/curated-closet-demo.mp4`: production-served product demo linked from the logged-out homepage and repository documentation
- `src/app/components/OutfitCollageCanvas.tsx`: saved-outfit collage renderer plus the `react-moveable`-backed edit-modal move/resize/rotate interactions and the shared normalized-layout/stage-aspect contract used by both saved and editable outfit previews
- `src/app/components/OutfitPreviewCarousel.tsx`: outfit-editor preview carousel that keeps the editable flat lay as the base slide and unlocks arrow/touch navigation to the latest modeled artifact
- `src/app/components/OutfitCollageLayersPanel.tsx`: focused layers sidebar for thumbnail selection plus pointer and keyboard-accessible layer reordering
- `src/app/lib/routes.ts`: route parsing, navigation helpers, and route guards
- `src/app/lib/api.ts`: shared request/error helpers for frontend API calls
- `src/app/lib/closet.ts`: shared types, formatting helpers, and feature-specific API helpers, including AI workflow polling, modeled-preview requests, AI readiness, and metadata/image suggestions
- `src/app/lib/wardrobeTaxonomy.ts`: canonical clothing type options and category alias normalization for item forms and AI metadata suggestions
- `src/app/lib/outfitCollage.ts`: shared default-layout and layer-order helpers for saved outfit collages
- `src/app/lib/outfitCollageRenderMath.ts`: shared stage-aspect normalization and resize-aspect helpers that keep saved cards and the editor preview on the same rendering contract
- `src/app/lib/outfitImageBounds.ts`: cached image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `src/app/lib/outfitFlatlaySnapshot.ts`: renders the current normalized outfit collage into a private 4:5 PNG used as temporary modeled-outfit composition guidance
- `src/app/lib/modeledPreview.ts`: modeled-artifact selection and flat-lay/modeled swipe-resolution helpers
- `src/app/lib/generationTasks.ts`: workflow-kind-aware labels, running-state rules, and completion copy for the global task toasts
- `src/app/lib/closetFilters.ts`: closet search, filter, and sort helpers
- `src/app/lib/useItemPhotoState.ts`: shared photo upload and preview state management
- `src/app/lib/useUndoRedoShortcuts.ts`: shared keyboard shortcut wiring for undo/redo controls outside the image editor
- `src/app/lib/usePageData.ts`: shared async page-loading hook
- `src/app/components/MyOutfitsPage.tsx`: saved outfit gallery/editor with global flat-lay/model view switching, missing-preview placeholders, draft-level AI title/tag/note autofill, live unsaved-draft full-look modeling, automatically published previews, carousel navigation, and preview deletion
- `src/app/lib/useOutfitDraftState.ts`: persisted outfit draft state management
- `tests/`: frontend contract tests run with Node's built-in test runner
- `src/styles/`: fonts, theme, and global styling

## CI

- `.github/workflows/ci.yml`: backend lockfile check, security checks, linting, and tests
- `.github/workflows/deploy.yml`: deploys successful `main` CI runs to the Heroku app `closet-organizer`

## Docs

- `README.md`: current application overview and setup
- `DEPLOYMENT.md`: non-secret Heroku, GitHub Actions, OAuth, and production config runbook
- `AGENTS.md`: repo-specific frontend and documentation maintenance rules
- `wiki.md`: product purpose and problem statement
- `back-end/README.md`: backend API and environment details
- `front-end/README.md`: frontend routes and integration notes
- `CHANGELOG.md`: release notes plus branch-level unreleased updates when needed
