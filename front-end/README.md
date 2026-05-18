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
- `/outfits` saved outfit builder and editor
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
- Closet filtering and sorting are handled through focused helpers in `src/app/lib/closetFilters.ts`.
- Item create and edit flows send multipart form data so photos can be uploaded, cropped, removed, or sourced from detected outfit-photo regions.
- The item editor can request AI metadata suggestions for type, name, brand, and tags, and can request cleaned item imagery for catalog-style presentation.
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
  Shared types plus frontend-facing API helpers for clothing items, outfits, uploads, clean-image flows, and metadata suggestions
- `src/app/lib/closetFilters.ts`
  Closet search, filter, and sort helpers
- `src/app/lib/usePageData.ts`
  Shared async page-loading hook
- `src/app/lib/useItemPhotoState.ts`
  Shared image selection and preview state
- `src/app/lib/useOutfitDraftState.ts`
  Persistent per-user outfit draft state
- `src/app/components/ItemEditorWorkspace.tsx`
  Shared add/edit item workspace layout
- `src/app/components/CreateItemPage.tsx`
  Manual item creation plus orchestration for the image-based create flow
- `src/app/components/ItemDetailPage.tsx`
  Edit and delete flow for an existing clothing item
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
- Vite proxies `/api` to the Rails backend in development
- `BACKEND_HOST` and `BACKEND_PORT` control the proxy target during local development
- authenticated requests use `credentials: "include"`

## Build And Deployment Notes

- `vite.config.ts` proxies `/api` to the Rails backend and strips the prefix before forwarding.
- The production deploy flow builds the frontend and copies `dist/` into `back-end/public`.

Create a production build:

```bash
npm run build
```
