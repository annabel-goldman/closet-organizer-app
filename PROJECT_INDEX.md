# Project Structure Index

Last updated: 2026-11-05

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

- `app/models`: users, private model references, clothing items with reusable wardrobe embeddings, durable outfit recommendation runs/options, legacy experiment and preference records, wardrobe image versions, saved outfits/items, reusable decorations, outfit folders, imports/detections, and staged AI workflow records
- `app/controllers`: auth/session handling, JSON CRUD controllers, authenticated private model-reference and decoration-library management, outfit collage/layout-aware outfit updates and decoration placements, outfit-folder and magazine-decoration persistence, upload flows, wardrobe-analysis/outfit-recommendation endpoints, AI readiness/workflow/model-preview endpoints, and SPA fallback
- `app/jobs`: asynchronous outfit upload, resumable wardrobe embedding, single-result outfit recommendation, saved-item image cleaning, and staged modeled item/full-outfit jobs, with shared cancellation and failure helpers in `ApplicationJob`
- `app/presenters`: API payload shaping for users, clothing items, outfits, uploads, and detections, including saved outfit collage layout data and modeled workflow state
- `app/services/`: OpenRouter detection and metadata, Gemini wardrobe embeddings, preference-aware Outfit Cart retrieval and bounded visual selection, legacy offline outfit-comparison tooling, Gemini catalog/modeled-item generation, Seedream full-outfit generation, image-version publishing/cleaning, and shared provider/tempfile/image helpers
- `config/routes.rb`: API routes plus HTML fallback routes
- `app/services/outfit_structure.rb`: deterministic eligibility checks for ownership, kept pieces and exclusions; advisory coverage/role diagnostics for incomplete looks
- `app/services/outfit_examples.rb`, `outfit_experiment_runner.rb`, `outfit_experiment_review.rb`: cached examples, duplicate-aware frozen split, resumable three-method comparisons, and blind-rating promotion eligibility
- `app/services/outfit_provider_budget.rb`: atomic maximum-cost reservations and durable provider-attempt accounting, including failed requests
- `app/services/outfit_baseline_*.rb`: frozen prior builder/scorer/judge for evaluation only
- `config/outfit_evaluation_prompts.json` and `lib/tasks/outfit_experiment.rake`: frozen 20/10 prompt split and experiment/review commands
- `db/seeds.rb`: demo admin user plus large-scale dev seed (~1k users, ~5k items, ~2k outfits) for pagination/perf testing
- `test/`: model, integration, and service tests

## Frontend (`front-end`)

- `src/app/App.tsx`: auth-aware shell, lazy route composition, Outfit Cart generation/draft state, and cache reconciliation for durable image-generation results
- `src/app/components/primitives/` and `src/app/components/ui/`: the reachable shared controls, typography, collection/compact search inputs, bounded scrollable picker-popover shell, and lower-level dialog/sheet/form helpers; unused generated UI-kit modules are intentionally not retained
- `src/app/components/shared/CollectionLayout.tsx`, `CollectionCard.tsx`, `CollectionNotice.tsx`, and `InfiniteCollectionSentinel.tsx`: shared collection-page headers, toolbars, responsive grids, content-shaped skeletons, card/media composition, automatic scroll-pagination status, image loading, and inline notices used across closet items, outfits, magazines, and decorations
- `src/app/components/shared/ModelReferenceDialog.tsx`: private three-photo model-reference uploader, primary-order controls, authenticated thumbnails, and removal controls surfaced from the existing header
- `src/app/components/shared/ModeledPreviewPanel.tsx`: minimal modeled-item image and confirmed deletion surface; successful previews are published automatically and workflow stages stay out of the UI
- `src/app/components/shared/ModeledPreviewImageEditor.tsx`: shared modeled-item/outfit edit dialog that loads private workflow imagery into the existing crop, rotate, magic-wand, and undo/redo editor and persists the resulting image
- `src/app/components/MyDecorationsPage.tsx` and `src/app/components/decorations/`: private searchable progressive PNG library, shared image-editor adapter, and reusable decoration picker
- `src/app/components/shared/GenerationTaskToasts.tsx`: global lower-right modeled outfit/item, wardrobe-analysis, image-cleaning, and photo-detection notices with cross-route cancellation, completion states, and result navigation
- `src/app/components/`: routed pages, the closet outfit-cart tray, item editor flows, extracted create-item/restricted-state components, and supporting UI
- `public/demo/curated-closet-demo.mp4`: production-served product demo linked from the logged-out homepage and repository documentation
- `src/app/components/OutfitCollageCanvas.tsx`: saved-outfit collage renderer plus the `react-moveable`-backed move/resize/rotate interactions shared by clothing pieces and visible-bounds-cropped decorations, with one normalized-layout/stage-aspect contract used by saved and editable outfit previews
- `src/app/components/OutfitPreviewCarousel.tsx`: outfit-editor preview carousel that keeps the editable flat lay as the base slide and unlocks arrow/touch navigation to the latest modeled artifact
- `src/app/components/OutfitCollageLayersPanel.tsx`: focused clothing-and-decoration layers sidebar with thumbnail selection, removal/addition controls, a shared searchable picker layout for both asset types, and pointer/keyboard-accessible clothing layer reordering
- `src/app/lib/routes.ts`: route parsing, navigation helpers, and route guards
- `src/app/lib/api.ts`: shared request/error helpers for frontend API calls
- `src/app/lib/closet.ts`: compatibility-facing closet domain types, formatting helpers, and feature APIs while focused modules are extracted incrementally
- `src/app/lib/api/workflows.ts` and `src/app/lib/types/ai.ts`: durable AI workflow requests, normalization, and domain types without coupling the task manager back to the large closet module
- `src/app/lib/apiConfig.ts` and `src/app/lib/imageSources.ts`: shared backend URL policy plus authenticated, proxy-safe browser image fetch/decode helpers
- `src/app/lib/asyncPool.ts`: order-preserving bounded-concurrency utility for independent multi-photo upload workflows
- `src/app/lib/wardrobeTaxonomy.ts`: canonical clothing type options and category alias normalization for item forms and AI metadata suggestions
- `src/app/lib/outfitCollage.ts`: shared default-layout and layer-order helpers for saved outfit collages
- `src/app/lib/outfitCollageRenderMath.ts`: shared proportional media-containment and resize-aspect helpers that keep saved frame geometry stable across gallery, editor, and generated snapshot rendering
- `src/app/lib/outfitImageBounds.ts`: cached, proxy-safe image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `src/app/lib/imageEditorGeometry.ts`: aspect-ratio-safe source-image fitting for the shared crop and magic-wand editor
- `src/app/lib/outfitFlatlaySnapshot.ts`: downloads item and reusable decoration imagery through the same-origin proxy and renders the current saved-frame outfit collage into a private 4:5 PNG using the same proportional containment math and decoration placement data as the visible flat lay
- `src/app/lib/modeledPreview.ts`: modeled-artifact selection and flat-lay/modeled swipe-resolution helpers
- `src/app/lib/generationTasks.ts`: workflow-kind-aware labels, running-state rules, and completion copy for the global task toasts
- `src/app/lib/useGenerationTaskManager.ts`: the single non-overlapping polling, cancellation, dismissal, and owner-reset lifecycle for cross-route generation tasks
- `src/app/lib/closetFilters.ts`: closet search, filter, and sort helpers
- `src/app/lib/useClosetControls.ts`: closet-page filter/search/sort state and derived results extracted from the app shell
- `src/app/lib/useIncrementalCollection.ts`: bounded collection rendering with automatic next-batch loading when the shared scroll sentinel approaches the viewport
- `src/app/lib/useItemPhotoState.ts`: shared photo upload and preview state management
- `src/app/lib/useUndoRedoShortcuts.ts`: shared keyboard shortcut wiring for undo/redo controls outside the image editor
- `src/app/lib/usePageData.ts`: shared async page-loading hook
- `src/app/components/MyOutfitsPage.tsx`: saved outfit gallery/editor with model viewing, draft metadata/model generation, and preview editing/deletion
- `src/app/components/OutfitCartSheet.tsx`: Closet-side generator and editable draft tray; its sparkle action generates one outfit or treats all selected cart pieces as required anchors
- `src/app/components/OutfitGalleryPreview.tsx`: fixed-frame, reduced-motion-aware crossfade between each gallery card's flat lay and modeled preview
- `src/app/components/SearchSuggestionField.tsx` and `ClosetSearchField.tsx`: shared searchable combobox behavior, suggestion rendering, and keyboard navigation used by closet and outfit search
- `src/app/components/outfits/useOutfitMagazines.ts`: magazine-library loading, outfit hydration, and deletion state for the `/outfits` collection view
- `src/app/components/CreateItemPage.tsx`: manual item creation and progressive multi-photo item import, including per-source pre-detection focus/edit/replace/delete state, independent cancellable detection workflows, bounded batch AI generation/background removal, and durable version transfer into saved items
- `src/app/components/MagazineEditorPage.tsx`, `MagazineEditorForm.tsx`, and `src/app/components/magazines/`: route-level magazine create/edit loading plus metadata, searchable outfit selection, ordered membership, AI concept autofill, and the shared direct-manipulation page designer/renderer
- `src/app/components/MagazineReaderPage.tsx`: independently routable fullscreen cover-and-look reader with saved modeled/flat-lay page layouts, animated turns, and a top-edge return-to-editor action
- `src/app/lib/magazineLayout.ts`: normalized per-page image-mode, text, and percentage-position defaults shared by magazine authoring and reading
- `src/app/lib/useOutfitDraftState.ts`: persisted outfit draft state management
- `tests/`: Node contract tests plus Vitest/jsdom component and hook regression tests
- `src/styles/`: fonts, theme, and global styling

## CI

- `.github/workflows/ci.yml`: backend lockfile/security/lint/test checks plus frontend lint, strict type-checking, contract/component tests, and production build
- `.github/workflows/deploy.yml`: deploys successful `main` CI runs to the Heroku app `closet-organizer`

## Docs

- `README.md`: current application overview and setup
- `DEPLOYMENT.md`: non-secret Heroku, GitHub Actions, OAuth, and production config runbook
- `AGENTS.md`: repo-specific frontend and documentation maintenance rules
- `wiki.md`: product purpose and problem statement
- `back-end/README.md`: backend API and environment details
- `front-end/README.md`: frontend routes and integration notes
- `CHANGELOG.md`: release notes plus branch-level unreleased updates when needed
