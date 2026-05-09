# Closet Organizer Frontend

React + Vite client for the Closet Organizer Milestone 1 app.

This app began from a Figma-exported bundle, but the current implementation is wired to the Rails backend and supports authenticated closet management, outfits, admin-only user browsing, photo upload, and outfit-image import.

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

To run the full monorepo together, use [start.sh](../start.sh) from the repository root.

## Backend Connection

The frontend API layer is split between shared request helpers in `src/app/lib/api.ts` and feature-facing helpers/types in `src/app/lib/closet.ts`.

- `VITE_API_BASE_URL` defaults to `/api`
- Vite proxies `/api` to the Rails backend
- `BACKEND_HOST` and `BACKEND_PORT` control the proxy target during local development
- authenticated requests use `credentials: "include"`

If the Rails API is running on the default port, no extra configuration is required.

## Current Routes

Routes are coordinated in `src/app/App.tsx` and parsed/navigation helpers live in `src/app/lib/routes.ts`.

- `/` logged-out landing page
- `/closet` signed-in user closet
- `/outfits` saved outfit builder and editor
- `/users` admin-only users directory
- `/users/:id` admin-only user detail page
- `/items/:id` clothing item detail editor
- `/items/new?userId=:id&mode=manual` manual item creation page
- `/items/new?userId=:id&mode=image` image upload, detection review, and item creation page
- unknown routes render a frontend not-found state

## Important Source Files

- `src/app/App.tsx`
  Main entry point, auth-aware page composition, header/footer layout, and top-level screen switching
- `src/app/lib/routes.ts`
  Route parsing, route guards, auth error messaging, and navigation helpers
- `src/app/lib/api.ts`
  Shared fetch helpers and API error handling
- `src/app/lib/closet.ts`
  Shared types, formatting helpers, and feature-specific API helpers
- `src/app/lib/closetFilters.ts`
  Closet search, tag filtering, and sort helpers
- `src/app/lib/usePageData.ts`
  Shared async page-loading hook used by several routed screens
- `src/app/lib/useOutfitDraftState.ts`
  Persistent per-user outfit draft state management
- `src/app/components/ClothingCard.tsx`
  Closet grid card used on the main closet page
- `src/app/components/MyOutfitsPage.tsx`
  Outfit CRUD, flash feedback, and draft-driven lookbook flow
- `src/app/components/UsersDirectoryPage.tsx`
  Admin-only users directory screen
- `src/app/components/UserDetailPage.tsx`
  Admin-only user summary and closet contents screen
- `src/app/components/ItemDetailPage.tsx`
  Edit/delete flow for a clothing item
- `src/app/components/CreateItemPage.tsx`
  Manual item creation plus orchestration for the image upload/detection review flow
- `src/app/components/create-item/`
  Extracted detection review and image-mode create-item components
- `src/app/components/shared/AccessRestrictedState.tsx`
  Shared access-restricted state used across admin-only pages
- `src/app/lib/useItemPhotoState.ts`
  Shared image selection and preview state for item and outfit flows

## Current Behavior Notes

- The app loads the signed-in user through `GET /me`, not by browsing arbitrary users.
- Non-admin users are blocked from the users directory in both backend authorization and frontend navigation.
- Shared page data loading is handled through `usePageData` to keep route components focused on page behavior.
- Item create and edit flows send multipart form data so photos can be attached, cropped, or removed.
- Image-based item creation submits one photo to `POST /outfit_uploads` and renders structured detections returned by the backend.
- The outfit flow stores a draft item selection in local storage per user.
- The repo still contains a large reusable UI component set under `src/app/components/ui/`.

## Build And Integration Notes

- `VITE_API_BASE_URL` defaults to `/api`.
- `vite.config.ts` proxies `/api` to the Rails backend and strips the prefix before forwarding.
- The production deploy flow builds the frontend and copies `dist/` into `back-end/public`.

## Build

Create a production build:

```bash
npm run build
```
