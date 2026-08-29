# Curated Closet Frontend

React + Vite client for Curated Closet.

The current frontend supports authenticated closet management, item creation and editing, item visual descriptions, staged AI review, private modeled-preview consent, AI-assisted metadata, image cleanup, outfit generation flows, saved outfits, admin-only user pages, and outfit-photo import that can be reviewed and converted into closet items.

Original design source:
[Closet Organizer Mockup](https://www.figma.com/design/uZi7nkn4N3N3KNIANPF5yR/Closet-Organizer-Mockup)

## Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Motion
- Radix UI components
- Lucide icons

## Local Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Default dev URL:

```text
http://127.0.0.1:5173
```

To run the frontend and backend together, use [start.sh](../start.sh) from the repository root.

## UI Architecture

When building or refactoring frontend UI, follow the shared control rules in [AGENTS.md](../AGENTS.md).

- Prefer the shared primitives in `src/app/components/primitives/` before introducing custom button, dropdown, select-trigger, or recurring typography markup.
- Extend the primitive layer when a shared variation is needed instead of duplicating control styles in feature files.
- Keep app-specific composition in page and feature components, while shared interaction and visual patterns stay in the primitives layer.

Primary shared primitives:

- `src/app/components/primitives/PrimitiveButton.tsx`
- `src/app/components/primitives/PrimitiveSelect.tsx`
- `src/app/components/primitives/PrimitiveDropdownMenu.tsx`
- `src/app/components/primitives/PrimitiveDropdownTriggerButton.tsx`
- `src/app/components/primitives/PrimitiveText.tsx`

The repo still includes lower-level helpers under `src/app/components/ui/`, but frontend feature work should reach for the primitives layer first when the interaction matches.

## Current Routes

Routes are parsed in `src/app/lib/routes.ts` and composed lazily by `src/app/App.tsx`, so page-only editor and magazine code is downloaded when its route is opened instead of inflating the initial bundle.

- `/` logged-out landing page with an invite-only confirmation before Google sign-in and a
  [two-minute product demo](https://closet-organizer-165f918adeda.herokuapp.com/demo/curated-closet-demo.mp4)
- `/closet` signed-in closet home with search, filters, and sorting
- `/outfits` saved outfit gallery and editor
- `/users` admin-only users directory
- `/users/:id` admin-only user detail page
- `/items/:id` clothing item detail editor
- `/items/new?userId=:id&mode=manual` manual item creation page
- `/items/new?userId=:id&mode=image` image upload, detection review, and item creation page
- unknown routes render a frontend not-found state

## Current Behavior

- The app loads the signed-in user through `GET /me`.
- Selecting sign in opens an invite-only confirmation explaining that Google emails require
  administrator approval and visitors should contact `annabel.m.goldman@gmail.com`. Google
  authentication starts only after the visitor selects `Continue to sign in`.
- Non-admin users are blocked from `/users` and `/users/:id` in both backend authorization and frontend navigation.
- The admin users directory at `/users` is paginated (24 per page) and uses a `clothing_items_count` field per user instead of shipping each user's full items array.
- The closet page now treats outfit selection like a cart: `Add to Outfit` updates a cart button in the closet action row beside `Add Item`, the selected pieces can be reviewed in a right-side tray, and the tray can capture outfit name, tags, and notes before creating the outfit. The cart's icon-only `AI fill details` header action uses the selected pieces to draft all three fields through the unsaved-outfit metadata endpoint, while leaving creation to the user. The `/outfits` page now focuses on browsing, editing, and deleting saved outfits. Its page-level `Model view` toggle switches every gallery card from the flat lay to the saved modeled image and uses a neutral placeholder where no modeled preview exists. Editing opens a modal with the outfit preview on the left, direct collage editing controls (move, resize, rotate, layer reordering, and searchable add-item thumbnails), and editable metadata on the right. Its matching `AI fill details` action uses the exact current editor pieces—including unsaved additions or removals—to draft the title, tags, and notes, but leaves saving to the user. Both actions appear beside their surface's close control through the shared dialog/sheet header-action slot.
- `/outfits` includes separate `All outfits` and `My Magazines` views. The magazine library lets users create a magazine, add or reorder saved outfits, open the finished magazine, or delete the magazine without deleting its source outfits. Each magazine presents a themed cover followed by one portrait page per look, using each outfit's modeled preview or a consistent missing-preview treatment. In decorate mode, uploaded clip-art images are private magazine assets tied to the current page and can be dragged, resized, rotated, and deleted without modifying the outfit or modeled image.
- The saved outfits collection is cached in `App.tsx` after the first `/outfits` load. Navigating away and back reuses that cache, while outfit creation, edits, deletes, AI generation, and clothing-item edits patch the cached records directly. Magazine loading and editor/viewer state live in `components/outfits/useOutfitMagazines.ts` rather than the route component.
- The saved-outfit collage editor is library-backed: `react-moveable` owns the move/resize/rotate controls, while `OutfitCollageCanvas` keeps the rendered image viewport and persisted collage layout data in sync.
- The saved card and edit modal intentionally share the same collage-layout math: the editor seeds its layouts from the saved API payload, supports adding/removing closet pieces while editing, and both views normalize those layouts through the same render-math helpers so the saved preview matches what the editor shows after save.
- Item and outfit text inputs are length-capped through `src/app/lib/inputLengthPolicy.ts`, which mirrors the backend `InputLengthPolicy` constants and applies them as `maxLength` on the relevant `<input>` and `<textarea>` controls.
- Closet filtering, fuzzy search, and sorting are handled through focused helpers in `src/app/lib/closetFilters.ts`. The closet search field shows filter-aware item suggestions while typing (click fills the query, Enter opens the highlighted item).
- Item create and edit flows send multipart form data so photos can be uploaded, cropped, removed, or sourced from detected outfit-photo regions.
- Item create and edit flows use the shared wardrobe taxonomy from `src/app/lib/wardrobeTaxonomy.ts`, so AI suggestions and legacy category aliases are normalized into the canonical type picker before validation.
- Item edit flows include freeform visual descriptions that are saved with the clothing item and reused by AI outfit generation.
- The item editor can request AI metadata suggestions for type, name, brand, and tags, and can request cleaned item imagery for catalog-style presentation; the backend now strips the generated white studio background before returning the final cleaned PNG. Manual creation warns before saving while a clean-image request is still pending so the newly created item is not accidentally paired with stale imagery.
- The existing header exposes a private model-reference manager with authenticated thumbnails for up to three photos. Users can add multiple angles, choose the primary identity anchor by reordering, remove one photo, or remove the complete set and revoke consent. When a user has opted in, saved outfit cards and the outfit editor expose the primary `Model this look` action, while the item detail editor retains `Model on me` for one-piece previews. From the editor, outfit modeling snapshots the current unsaved item selection, order, title, tags, notes, and saved-frame flat-lay canvas into a persisted `prepare → modeled → verify` workflow, so the requested preview matches the visible draft without requiring a save. Saved collage frames remain authoritative when image-content measurements arrive; tall and wide garments are proportionally contained inside them, and the browser uses that same rendering contract for the private 4:5 composition PNG. Seedream receives the composition after the identity and garment inputs as styling guidance, while the individual garment images remain authoritative for item identity. Full outfits use Seedream 4.5 through OpenRouter's Images API, with identity references ordered before garment references and a `2K`, vertical `4:5`, head-to-toe result that matches the app's portrait preview canvas; catalog cleanup and individual item modeling remain on Gemini 2.5 Flash Image. `useGenerationTaskManager` owns the one app-wide registry and non-overlapping polling loop for durable generation workflows: modeled outfits, modeled items, saved-item image cleaning, AI outfit creation, and outfit-photo detection all render lower-right task toasts, continue across route changes, expose cancellation while pending/processing, and synchronize completed results back into the app-level item/outfit caches. Successful notices use a pale-green completion state and dismiss after three seconds; failed notices remain visible in light red and provide a one-click copy action for the backend error message. Successful previews are approved automatically. Once ready, the outfit editor keeps the flat lay as its base preview and reveals arrow plus touch-swipe navigation to the modeled version in the same canvas. Modeled item images and the outfit carousel's modeled slide expose a shared edit control that opens the existing full-screen image editor for crop presets, rotation, magic-wand background erasure, and edit-level undo/redo; applying edits replaces only the authenticated generated artifact. Editor image sources have stable identities, so unrelated app updates do not restart loading. A confirmed trash control permanently purges that generated file while preserving the underlying item, outfit, and flat lay. Both surfaces use the same neutral token palette, typography, and rectangular controls.
- The `/outfits` page can queue an AI-generated saved outfit with an optional uploaded flatlay reference, close the dialog immediately, and continue elsewhere while the global toast tracks or cancels the workflow. Gallery-level modeling actions are shown only while the page is in `Model view`: cards without a preview read `Model this look`, while cards with a preview read `Regenerate model` and confirm that the existing modeled image will be replaced. The outfit editor keeps its own action so the current unsaved outfit draft can still be modeled. The backend analyzes the reference into structured target slots, shortlists candidates from closet metadata and visual descriptions while preserving strong matches for required slots and cross-slot visual anchors like sequins, satin, burgundy leather, patent shine, or glam styling, enforces core complete-look rules like available footwear for dress looks, repairs missing required slot matches when possible, and refines the final look with candidate photos. On success, `App.tsx` fetches the new outfit into its cache and the toast uses the generated outfit name. Generated outfits retain the subtle `AI generated` label, and later saves/deletes feed passive backend preference learning.
- Image-based item creation accepts multiple photos in one selection and submits each photo independently to `POST /outfit_uploads` with bounded concurrency. Detections append to one review strip as each photo finishes, while crop previews and image-editor actions continue to use the correct source photo for every detected item. Users can review and save early results without waiting for the remaining photos.
- Each photo in a multi-item import persists its own `detect → crop` workflow without exposing the internal stage card. Per-photo detection continues in global task toasts after navigation, remains independently cancellable, and the completed toast's `View` action restores all currently tracked uploads and detections in the image-import flow. AI workflow status is available through the shared API helpers rather than a separate AI workspace.
- Manual item creation and existing item detail editing expose undo/redo controls outside the expanded image editor, with saved item-detail undo/redo persisting the restored metadata and image attachments back through the API.
- Outfit drafts are stored per user in local storage through `useOutfitDraftState`.

## Important Source Files

- `src/app/App.tsx`
  Auth-aware navigation shell, lazy route composition, outfit cart, and generation-result cache reconciliation
- `src/app/lib/routes.ts`
  Route parsing, route guards, and navigation helpers
- `src/app/lib/api.ts`
  Shared fetch helpers and API error formatting
- `src/app/lib/closet.ts`
  Compatibility-facing closet domain types and feature APIs while focused modules are extracted incrementally
- `src/app/lib/api/workflows.ts` and `src/app/lib/types/ai.ts`
  Durable workflow API calls, payload normalization, and AI domain types
- `src/app/lib/apiConfig.ts` and `src/app/lib/imageSources.ts`
  Shared backend-origin policy and authenticated Active Storage proxy/image decode pipeline used by editors, bounds measurement, and flat-lay snapshots
- `src/app/lib/useGenerationTaskManager.ts`
  Single app-level, non-overlapping poll/cancel/dismiss lifecycle for durable generation tasks
- `src/app/lib/useClosetControls.ts`
  Closet search, filters, sorting state, and derived visible items
- `src/app/lib/outfitCollage.ts`
  Shared default-layout, layer-order, and layout-normalization helpers for saved outfit collages
- `src/app/lib/outfitCollageRenderMath.ts`
  Shared stage-aspect normalization and resize-aspect helpers that keep saved cards and the editor preview on the same rendering contract
- `src/app/lib/outfitImageBounds.ts`
  Cached image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `src/app/lib/imageEditorGeometry.ts`
  Aspect-ratio-safe media fitting shared by crop and magic-wand image-editor views
- `tests/outfit-collage-contracts.test.ts`
  Node-based frontend contract tests covering saved-view/editor layout parity and the resize-aspect fallback that prevents reselection drift
- `src/app/lib/closetFilters.ts`
  Closet search, fuzzy matching, filter-aware suggestion helpers, and sort helpers
- `src/app/lib/wardrobeTaxonomy.ts`
  Canonical clothing type options plus category alias normalization for item forms and AI metadata suggestions
- `src/app/lib/useUndoRedoShortcuts.ts`
  Shared keyboard shortcut wiring for undo/redo controls outside the image editor
- `src/app/components/ClosetSearchField.tsx`
  Closet page search input with filter-aware item suggestions (click to fill, Enter to open item)
- `public/demo/curated-closet-demo.mp4`
  Public product demo linked from the logged-out landing page and copied into the production build
- `tests/closetFilters.test.ts`
  Node-based tests for closet fuzzy search and filter-aware suggestions
- `src/app/lib/usePageData.ts`
  Shared async page-loading hook
- `src/app/lib/asyncPool.ts`
  Small order-preserving bounded-concurrency helper used by multi-photo item imports
- `src/app/lib/useItemPhotoState.ts`
  Shared image selection and preview state
- `src/app/lib/useOutfitDraftState.ts`
  Persistent per-user outfit draft state
- `src/app/components/ItemEditorWorkspace.tsx`
  Shared add/edit item workspace layout
- `src/app/components/CreateItemPage.tsx`
  Manual item creation plus bounded multi-photo detection orchestration, progressive result aggregation, and restoration of background outfit-photo detection results
- `src/app/components/ItemDetailPage.tsx`
  Edit/delete flow plus the in-context automatically published modeled preview for an existing clothing item
- `src/app/components/MyOutfitsPage.tsx`
  Saved outfit gallery/editor, draft-level AI title/tag/note autofill, and automatically published full-look modeled-preview actions
- `src/app/components/outfits/useOutfitMagazines.ts`
  Magazine collection, membership, dialog, deletion, and viewer state
- `src/app/components/OutfitFolderDialog.tsx`
  Folder metadata, ordered outfit selection, and magazine-theme editor
- `src/app/components/OutfitMagazineDialog.tsx`
  Animated portrait magazine viewer and page-scoped clip-art layout editor
- `src/app/components/shared/ModeledPreviewPanel.tsx`
  Minimal modeled-item image surface with a confirmed deletion control; workflow stages remain internal
- `src/app/components/shared/GenerationTaskToasts.tsx`
  App-level generation, completion, failure, cancellation, and result-navigation notices for durable AI workflows that persist across route changes
- `src/app/components/OutfitCartSheet.tsx`
  Cart-style right-side tray for reviewing selected closet items, drafting editable metadata with AI, and creating an outfit directly from the closet page
- `src/app/components/OutfitCollageCanvas.tsx`
  Shared saved-outfit collage renderer plus the edit-modal `react-moveable` interaction layer and the shared normalized-layout/stage-aspect contract used by both gallery and editor views
- `src/app/components/OutfitCollageLayersPanel.tsx`
  Focused layers sidebar for thumbnail selection plus pointer and keyboard-accessible layer reordering
- `src/app/components/ItemMetadataFields.tsx`
  Shared name, type, brand, visual descriptions, tag, and AI autofill fields
- `src/app/components/AiMetadataAutofillButton.tsx`
  Shared AI metadata trigger control
- `src/app/components/create-item/`
  Detection review and image-mode create-item components
- `src/app/components/shared/AccessRestrictedState.tsx`
  Shared access-restricted state for admin-only pages

## Backend Connection

The frontend API layer uses shared request helpers in `src/app/lib/api.ts`, focused workflow calls in `src/app/lib/api/workflows.ts`, AI types in `src/app/lib/types/ai.ts`, and the compatibility-facing closet domain module in `src/app/lib/closet.ts`.

- `VITE_API_BASE_URL` defaults to `/api`
- Vite proxies `/api` and `/rails/active_storage` to the Rails backend in development so API requests and local Active Storage media stay same-origin from the browser's perspective
- `BACKEND_HOST` and `BACKEND_PORT` control the proxy target during local development
- authenticated requests use `credentials: "include"`

## Build And Deployment Notes

- `vite.config.ts` proxies `/api` to the Rails backend and strips the prefix before forwarding.
- The production deploy flow builds the frontend and copies `dist/` into `back-end/public`.
- `vite.config.ts` imports `@tailwindcss/vite` and `@vitejs/plugin-react` during the production build, so those packages must remain in `dependencies` instead of `devDependencies` for Heroku-style `NODE_ENV=production` installs.
- The repository root `package.json` pins Node `22.x` so Heroku resolves a predictable runtime for the frontend build step.

Create a production build:

```bash
npm run build
```

Run the frontend contract tests:

```bash
npm test
```

Run the static quality gates used by CI:

```bash
npm run lint
npm run typecheck
```
