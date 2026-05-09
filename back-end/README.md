# Digital Closet Organizer API

Rails 8 JSON backend for the Closet Organizer Milestone 1 app.

## Stack

- Ruby 3.3.6
- Rails 8.1.3
- SQLite for local development and test
- PostgreSQL in deployment
- Puma
- `has_secure_password`
- OmniAuth Google OAuth 2
- Active Storage for uploaded and generated images

## What The Backend Handles

- session-backed Google sign-in and logout
- current-user lookup through `GET /me`
- user-scoped clothing item CRUD
- admin-only user directory access
- saved outfit CRUD with owned-item validation
- outfit photo upload, async analysis, and detection persistence
- AI-assisted image cleanup for clothing items and verified detections
- SPA fallback for browser HTML requests

## Internal Structure Notes

- `app/presenters/api_payloads.rb` centralizes JSON payload shaping for users, clothing items, outfits, uploads, and detections.
- `app/services/managed_tempfiles.rb` tracks tempfiles created during crop and image-clean flows so cleanup happens in one place.
- `app/services/prepared_image_source.rb` wraps attachment-like image inputs used by crop and AI-clean flows.

## Local Setup

```bash
bin/setup
bin/rails db:prepare db:seed
bin/dev
```

Default local backend URL:

```text
http://127.0.0.1:3000
```

To run the full monorepo together, use [start.sh](../start.sh) from the repository root.

## Bundler And Deploys

Heroku resolves gems from the repository root `Gemfile`, which in turn loads this backend `Gemfile`.

If you add, remove, or change a gem here, update and commit both lockfiles:

```bash
bundle install
cd back-end && bundle install
```

The root `Gemfile.lock` is used during deploy, and `back-end/Gemfile.lock` is used by local backend commands.

## API Routes

```text
GET     /up
GET     /me
DELETE  /session
POST    /auth/:provider/callback
GET     /auth/failure
GET     /users
POST    /users
GET     /users/:id
PATCH   /users/:id
DELETE  /users/:id
GET     /clothing_items
POST    /clothing_items
GET     /clothing_items/:id
PATCH   /clothing_items/:id
DELETE  /clothing_items/:id
POST    /clothing_items/:id/generate_clean_image
GET     /outfits
POST    /outfits
GET     /outfits/:id
PATCH   /outfits/:id
DELETE  /outfits/:id
POST    /outfit_uploads
GET     /outfit_uploads/:id
POST    /outfit_detections/:id/generate_clean_image
POST    /image_variants/preview
```

Notes:

- API responses default to JSON.
- `/` resolves to `clothing_items#index` inside the JSON scope.
- HTML browser requests for SPA routes fall back to the frontend shell.
- `ApplicationController` returns `404` JSON for missing records and `422` JSON for validation failures.

## Data Model

### `User`

- `username`
- `email`
- `preferred_style`
- `provider`
- `uid`
- `avatar_url`
- `admin`
- `password_digest`
- `has_many :clothing_items`
- `has_many :outfits`
- `has_many :outfit_uploads`

### `ClothingItem`

- `name`
- `size`
- `date`
- `tags`
- `user_id`
- `photo` via Active Storage
- `cleaned_photo` via Active Storage
- clean-image status metadata

Supported `size` enum values:

- `xs`
- `small`
- `medium`
- `large`
- `xl`

### `Outfit`

- `user_id`
- `name`
- `tags`
- `notes`
- `has_many :outfit_items`
- `has_many :clothing_items, through: :outfit_items`

### `OutfitUpload`

- `user_id`
- `status`
- `provider`
- `vision_model`
- `error_message`
- `detected_at`
- `raw_response`
- `source_photo` via Active Storage
- `has_many :outfit_detections`

Supported `status` enum values:

- `pending`
- `processing`
- `succeeded`
- `failed`

### `OutfitDetection`

- `outfit_upload_id`
- `category`
- `confidence`
- `suggested_name`
- `details`
- `position`
- coarse, refined, and final bounding boxes
- `cleaned_photo` via Active Storage
- crop-status and clean-image status metadata

## Seeds

`db/seeds.rb` currently creates:

- one Google-backed admin user: `annabel_goldman`
- email `annabelgoldman2025@u.northwestern.edu`
- a 20-item demo closet with realistic wardrobe tags

Load seeds with:

```bash
bin/rails db:seed
```

## Tests And Quality Checks

Run the backend test suite:

```bash
bin/rails db:test:prepare test
```

Run lint and security checks:

```bash
bin/rubocop
bin/brakeman --no-pager
bin/bundler-audit
```

Current backend coverage includes model tests, integration tests for auth-sensitive flows, clothing items, outfits, uploads, and clean-image services.

Recent cleanup work also keeps backend verification anchored on:

- `bundle exec rails test`
- `bundle exec rubocop`
- presenter-backed payload rendering
- shared tempfile/image-source handling for AI cleanup and crop flows

## Environment

See `back-end/.env.example` for expected variables.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google sign-in.
- `OPENROUTER_API_KEY` is required for outfit detection and image-cleaning features.
- `OPENROUTER_MODEL` defaults to `openai/gpt-4.1-mini`.
- `OUTFIT_CROP_CYCLE_LIMIT` controls refinement and verification retries.
- Active Storage can be configured for S3-style storage through the provided AWS variables.

## Frontend Integration

The frontend talks to this app through `/api` in development. `front-end/vite.config.ts` proxies those requests to the Rails server and strips the `/api` prefix before forwarding them here.
