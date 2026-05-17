# Project Closet Organizer

Project Closet Organizer is a monorepo with a Rails JSON API in `back-end/` and a React + Vite client in `front-end/`. The current app supports Google-authenticated closet management, item creation and editing, AI-assisted metadata and image cleanup, outfit building, and outfit-photo import that detects visible clothing pieces.

## Current Scope

- Google sign-in with session-backed authentication
- Protected user-specific closet data
- CRUD for clothing items
- Search, filter, and sort on the closet page
- Saved outfits built from closet items
- Outfit-photo upload and detection review flow
- Flash/error/empty-state handling across the main user journey
- Heroku deployment from the repository root

## Current App Capabilities

- Sign in with Google and load the current user through `/me`
- View and manage the signed-in user closet at `/closet`
- Create, edit, delete, and photo-manage clothing items
- Generate AI metadata suggestions for item type, name, brand, and tags
- Generate cleaned catalog-style item images
- Save outfits from owned closet items at `/outfits`
- Upload an outfit photo, review detections, and convert detections into closet items
- Restrict `/users` and `/users/:id` to admin users only
- Show frontend not-found and unauthorized states instead of raw backend responses

## Team Members

- Annabel Goldman
- Adedamola Adejumobi
- David Gerchik
- Kailyn Mohammed
- Reem Khalid

## Deployment

Heroku deployment link:

- https://closet-organizer-app-6a29560f355b.herokuapp.com/

## Repository Layout

- `front-end/`: React 19 + Vite client application
- `back-end/`: Rails backend used for local development, CI, and deployment
- `.github/`: CI workflows and automation
- `Procfile`: Heroku process definitions that run the app from `back-end/`
- `package.json`: root deployment glue that builds `front-end/` into `back-end/public`
- `start.sh`: root-level launcher that boots both apps together
- `PROJECT_INDEX.md`: concise repository structure index
- `wiki.md`: product purpose and problem statement

## Current Code Organization

- Frontend route parsing, closet filtering, shared API helpers, page-loading hooks, and outfit-draft persistence are split into focused modules under `front-end/src/app/lib/`.
- Shared frontend control patterns live under `front-end/src/app/components/primitives/` and should be reused before introducing custom button, dropdown, select-trigger, or typography markup.
- The add/edit item workflow is centered on `ItemEditorWorkspace.tsx`, `CreateItemPage.tsx`, `ItemDetailPage.tsx`, and extracted review components under `front-end/src/app/components/create-item/`.
- Backend JSON response shaping lives in `back-end/app/presenters/api_payloads.rb`.
- Backend image-preparation, metadata suggestion, and tempfile lifecycle helpers live under `back-end/app/services/`.

## Getting Started

### Start Both Apps

From the repository root:

```bash
./start.sh
```

This starts:

- Rails at `http://127.0.0.1:3000`
- Vite at `http://127.0.0.1:5173`

Override ports if needed:

```bash
BACKEND_PORT=3001 FRONTEND_PORT=5174 ./start.sh
```

Or use the script shorthand:

```bash
./start.sh port=4100
./start.sh backend-port=3100 frontend-port=5174
```

Important for Google sign-in:

- Google OAuth requires exact backend origins and callback URLs.
- If you choose a new local `BACKEND_PORT`, that port must already be registered in the Google auth app settings.
- If it is not registered yet, speak with the owner of the Google auth screen/client configuration and ask them to add both the new local backend origin and the matching callback URL before using that port.
- In practice, that means adding entries like `http://localhost:3100` and `http://localhost:3100/auth/google_oauth2/callback` for any new backend port you want to use locally.

### Start Apps Separately

Backend:

```bash
cd back-end
bin/setup
bin/rails db:prepare db:seed
bin/dev
```

Frontend:

```bash
cd front-end
npm install
npm run dev
```

## Environment Notes

- `start.sh` loads `.env` files from the repo root, `back-end/`, and `front-end/` when present.
- Google auth expects `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Outfit detection and AI cleanup use OpenRouter credentials defined in [back-end/.env.example](./back-end/.env.example).
- Production image storage is intended to use S3-compatible credentials through Active Storage.
- In local development, the frontend talks to Rails through the Vite `/api` proxy.

## Seeds

`back-end/db/seeds.rb` currently creates:

- one admin Google-backed user: `annabel_goldman`
- the Northwestern email `annabelgoldman2025@u.northwestern.edu`
- a 20-item demo closet with realistic wardrobe tags

## Testing And CI

- Rails tests run in GitHub Actions through `.github/workflows/ci.yml`
- CI also runs `brakeman`, `bundler-audit`, and `rubocop`
- Recent local verification:
  `npm run build`
  `bundle exec rails test`
  `bundle exec rubocop`

## Documentation

- Project overview: [README.md](./README.md)
- Structure index: [PROJECT_INDEX.md](./PROJECT_INDEX.md)
- Project wiki: [wiki.md](./wiki.md)
- Backend details: [back-end/README.md](./back-end/README.md)
- Frontend details: [front-end/README.md](./front-end/README.md)
