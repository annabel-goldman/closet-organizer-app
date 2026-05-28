# Curated Closet Frontend

React + Vite client for Curated Closet.

The current frontend supports authenticated closet management, item creation and editing, AI-assisted metadata and image cleanup flows, saved outfits, admin-only user pages, and outfit-photo import that can be reviewed and converted into closet items.

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

Routes are coordinated in `src/app/App.tsx` and parsed in `src/app/lib/routes.ts`.

- `/` logged-out landing page
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
- Non-admin users are blocked from `/users` and `/users/:id` in both backend authorization and frontend navigation.
- The admin users directory at `/users` is paginated (24 per page) and uses a `clothing_items_count` field per user instead of shipping each user's full items array.
- The closet page now treats outfit selection like a cart: `Add to Outfit` updates a cart button in the closet action row beside `Add Item`, the selected pieces can be reviewed in a right-side tray, and the tray can capture outfit name, tags, and notes before creating the outfit. The `/outfits` page now focuses on browsing, editing, and deleting saved outfits, and editing opens a modal with the outfit preview on the left, direct collage editing controls (move, resize, rotate, and layer reordering), and editable metadata on the right.
- The saved-outfit collage editor is library-backed: `react-moveable` owns the move/resize/rotate controls, while `OutfitCollageCanvas` keeps the rendered image viewport and persisted collage layout data in sync.
- The saved card and edit modal intentionally share the same collage-layout math: the editor seeds its layouts from the saved API payload, and both views normalize those layouts through the same render-math helpers so the saved preview matches what the editor shows after save.
- Item and outfit text inputs are length-capped through `src/app/lib/inputLengthPolicy.ts`, which mirrors the backend `InputLengthPolicy` constants and applies them as `maxLength` on the relevant `<input>` and `<textarea>` controls.
- Closet filtering, fuzzy search, and sorting are handled through focused helpers in `src/app/lib/closetFilters.ts`. The closet search field shows filter-aware item suggestions while typing (click fills the query, Enter opens the highlighted item).
- Item create and edit flows send multipart form data so photos can be uploaded, cropped, removed, or sourced from detected outfit-photo regions.
- The item editor can request AI metadata suggestions for type, name, brand, and tags, and can request cleaned item imagery for catalog-style presentation; the backend now strips the generated white studio background before returning the final cleaned PNG.
- A staged AI-cleaned result can be submitted as a single `cleaned_photo` attachment while the original uploaded photo remains available separately.
- Existing item editing is now save-less: metadata fields autosave after a short debounce, metadata blur/selection commits save immediately for smaller history steps, direct image changes save immediately, and the metadata header keeps persistent `Undo` / `Redo` controls for reversing persisted changes.
- The item image workflow is now two clear steps without a hidden working image. `AI clean image` generates the visible catalog-style image shown to the user directly, and the model chooses either a white or dark-charcoal studio background based on the garment in the uploaded image; `Make transparent PNG` then removes that visible backdrop from the cleaned image when the user wants a transparent result.
- The AI request lifecycle now uses a shared frontend state model (`idle`, `running`, `succeeded`, `failed`, `invalidated`) instead of each editor screen inventing its own booleans. `closet.ts` remains the only wire-aware API layer, while the editor flows use focused hooks to coordinate local AI preview state.
- The manual create-item editor now records local metadata edits in the same undo stack as image and AI changes, and both the create and edit item workspaces support `Cmd/Ctrl+Z` undo plus `Cmd/Ctrl+Shift+Z` redo.
- If an AI image request is still processing when the user creates an item, the create flows now warn before proceeding and offer a choice between saving with the current image or creating immediately and auto-attaching the finished result once it completes.
- Image-based item creation submits an outfit photo to `POST /outfit_uploads`, renders detections, and supports promoting a reviewed detection into a closet item.
- Outfit drafts are stored per user in local storage through `useOutfitDraftState`.

## Important Source Files

- `src/app/App.tsx`
  Top-level route handling, auth-aware page composition, and navigation shell
- `src/app/lib/routes.ts`
  Route parsing, route guards, and navigation helpers
- `src/app/lib/api.ts`
  Shared fetch helpers and API error formatting
- `src/app/lib/closet.ts`
  Shared types plus frontend-facing API helpers for clothing items, outfits, uploads, clean-image/transparent-PNG preview and save flows, and metadata suggestions
- `src/app/lib/useAiActionState.ts`
  Shared AI action status model used by the create-item and saved-item editors
- `src/app/lib/useManualCreateAiFlow.ts`
  Manual create-item AI orchestration for clean-image, transparent-PNG, and metadata preview flows, including staged clean preview management and in-flight invalidation
- `src/app/lib/useDetectionAiFlow.ts`
  Detection-review AI orchestration for staged cleaned previews and transparent-PNG follow-ups
- `src/app/lib/outfitCollage.ts`
  Shared default-layout, layer-order, and layout-normalization helpers for saved outfit collages
- `src/app/lib/outfitCollageRenderMath.ts`
  Shared stage-aspect normalization and resize-aspect helpers that keep saved cards and the editor preview on the same rendering contract
- `src/app/lib/outfitImageBounds.ts`
  Cached image-content-bounds measurement helpers for saved-outfit collage rendering and editing
- `tests/outfit-collage-contracts.test.ts`
  Node-based frontend contract tests covering saved-view/editor layout parity and the resize-aspect fallback that prevents reselection drift
- `src/app/lib/closetFilters.ts`
  Closet search, fuzzy matching, filter-aware suggestion helpers, and sort helpers
- `src/app/components/ClosetSearchField.tsx`
  Closet page search input with filter-aware item suggestions (click to fill, Enter to open item)
- `tests/closetFilters.test.ts`
  Node-based tests for closet fuzzy search and filter-aware suggestions
- `src/app/lib/usePageData.ts`
  Shared async page-loading hook
- `src/app/lib/useItemPhotoState.ts`
  Shared image selection and preview state
- `src/app/lib/useUndoRedoShortcuts.ts`
  Shared keyboard shortcut hook for editor-level undo/redo
- `src/app/lib/useOutfitDraftState.ts`
  Persistent per-user outfit draft state
- `src/app/components/ItemEditorWorkspace.tsx`
  Shared add/edit item workspace layout
- `src/app/components/CreateItemPage.tsx`
  Manual item creation plus image-based create flow composition, now delegating AI request/state orchestration into dedicated hooks
- `src/app/components/ItemDetailPage.tsx`
  Autosaving existing-item editor with persistent Undo/Redo plus split AI clean/transparent actions driven by the shared AI action state model
- `src/app/components/OutfitCartSheet.tsx`
  Cart-style right-side tray for reviewing selected closet items and creating an outfit directly from the closet page
- `src/app/components/OutfitCollageCanvas.tsx`
  Shared saved-outfit collage renderer plus the edit-modal `react-moveable` interaction layer and the shared normalized-layout/stage-aspect contract used by both gallery and editor views
- `src/app/components/OutfitCollageLayersPanel.tsx`
  Focused layers sidebar for thumbnail selection plus pointer and keyboard-accessible layer reordering
- `src/app/components/ItemMetadataFields.tsx`
  Shared name, size, date, brand, tag, and AI autofill fields
- `src/app/components/AiMetadataAutofillButton.tsx`
  Shared AI metadata trigger control
- `src/app/components/create-item/`
  Detection review and image-mode create-item components
- `src/app/components/shared/AccessRestrictedState.tsx`
  Shared access-restricted state for admin-only pages

## Backend Connection

The frontend API layer is split between shared request helpers in `src/app/lib/api.ts` and feature-facing helpers/types in `src/app/lib/closet.ts`.

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
