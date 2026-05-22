# Curated Closet API

Rails 8 JSON backend for Curated Closet.

## Stack

- Ruby 3.3.6
- Rails 8.1.3
- SQLite for local development and test
- PostgreSQL in deployment
- Puma
- `has_secure_password`
- OmniAuth Google OAuth 2
- Active Storage for uploaded and generated images
- Kaminari for paginated index endpoints

## What The Backend Handles

- session-backed Google sign-in and logout
- current-user lookup through `GET /me`
- user-scoped clothing item CRUD
- admin-only user directory access
- saved outfit CRUD with owned-item validation
- outfit photo upload, detection persistence, crop refinement, and review support
- AI-assisted image cleanup and metadata suggestion flows for clothing items and outfit detections
- HTML fallback routes for the SPA frontend

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

Heroku resolves gems from the repository root `Gemfile`, which loads this backend `Gemfile`.

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
POST    /clothing_items/:id/generate_metadata_suggestions
GET     /outfits
POST    /outfits
GET     /outfits/:id
PATCH   /outfits/:id
DELETE  /outfits/:id
POST    /outfit_uploads
GET     /outfit_uploads/:id
POST    /outfit_detections/:id/generate_clean_image
POST    /outfit_detections/:id/generate_metadata_suggestions
POST    /image_variants/metadata_suggestions
POST    /image_variants/preview
```

Notes:

- API responses default to JSON.
- `/` resolves to `clothing_items#index` inside the JSON scope.
- HTML browser requests for SPA routes fall back to the frontend shell.
- `ApplicationController` returns `404` JSON for missing records and `422` JSON for validation failures.
- Text input length is capped at every layer: `app/models/concerns/input_length_policy.rb` exposes the limits (username 60, email 254, item name 120, brand 80, category 60, outfit name 120, notes 2_000, tag 40 chars × 30 per record); the `User`/`ClothingItem`/`Outfit` models validate against the same constants and surface friendly errors; the `AddInputLengthConstraints` migration enforces matching `limit:` and `null: false` constraints at the database. SQL injection is mitigated by ActiveRecord's parameterized queries — the only raw SQL fragment in the app (`where("lower(email) = ?", ...)` in `User`) uses bound placeholders.
- `GET /users` is paginated via Kaminari. It accepts `page` and `per_page` query params (default 24, max 100) and returns `{ users: [...], meta: { page, per_page, total_pages, total_count } }`. The index payload omits each user's `clothing_items` array and only includes a `clothing_items_count` field; per-user `GET /users/:id` still returns the full items array.
- Outfit payloads now preserve per-piece collage presentation through `outfit_items`: each embedded outfit item can include `outfit_item_id`, `layer_order`, and `collage_layout` (`x`, `y`, `width`, `height`, `rotation`) so the frontend can reopen and edit saved collages faithfully.

## Important Internal Files

- `app/presenters/api_payloads.rb`
  Centralizes JSON payload shaping for users, clothing items, outfits, uploads, and detections
- `app/controllers/clothing_items_controller.rb`
  Handles clothing item CRUD, photo attachment and cropping, clean-image generation, and metadata suggestions
- `app/controllers/outfit_detections_controller.rb`
  Handles detection-based clean-image and metadata suggestion requests
- `app/controllers/image_variants_controller.rb`
  Handles temporary AI preview generation and metadata suggestions for uploaded but unsaved images
- `app/services/openrouter_image_cleaner.rb`
  Calls OpenRouter image generation for cleaned item imagery
- `app/services/openrouter_metadata_suggester.rb`
  Calls OpenRouter structured vision responses for item metadata suggestions
- `app/services/outfit_upload_analyzer.rb`
  Coordinates upload analysis, detection creation, and crop refinement workflow
- `app/services/managed_tempfiles.rb`
  Tracks tempfiles used during crop and AI image flows
- `app/services/prepared_image_source.rb`
  Normalizes attachment-like image sources used across crop and AI workflows

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
- `category`
- `brand`
- `size`
- `date`
- `tags`
- `user_id`
- `source_outfit_upload_id`
- `source_outfit_detection_id`
- `photo` via Active Storage
- `cleaned_photo` via Active Storage
- clean-image status metadata

Supported `size` enum values:

- `xs`
- `small`
- `medium`
- `large`
- `xl`
- `na`

### `Outfit`

- `user_id`
- `name`
- `tags`
- `notes`
- `has_many :outfit_items`
- `has_many :clothing_items, through: :outfit_items`

### `OutfitItem`

- `outfit_id`
- `clothing_item_id`
- `layer_order`
- `collage_x`
- `collage_y`
- `collage_width`
- `collage_height`
- `collage_rotation`

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

## Environment

See [back-end/.env.example](./.env.example) for expected variables.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google sign-in.
- `OPENROUTER_API_KEY` is required for outfit detection, metadata suggestion, and image-cleaning features.
- `OPENROUTER_MODEL` defaults to `openai/gpt-4.1-mini`.
- `OPENROUTER_METADATA_MODEL` can override the metadata suggestion model independently.
- `OUTFIT_CROP_CYCLE_LIMIT` controls refinement and verification retries.
- Active Storage can be configured for S3-style storage through the provided AWS variables.

## Seeds

`db/seeds.rb` builds a development-scale dataset so pagination and large-list performance are visible locally:

- preset Google-backed admin user `annabel_goldman` (email `annabelgoldman2025@u.northwestern.edu`) with a 20-item demo closet and a few sample outfits
- ~1,050 additional generated users (provider `"seed"`, shared password `password`) with realistic names and preferred styles
- ~5,200 total clothing items distributed across users using a long-tail distribution (some users empty, most with a handful, a few with many)
- ~2,100 total outfits, each linked to 2–5 of its owner's items

Load seeds with:

```bash
bin/rails db:seed
```

To reset and reseed:

```bash
bin/rails db:reset
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

Current backend coverage includes model tests plus integration coverage for auth-sensitive flows, clothing items, outfits, image variants, uploads, and clean-image services.

## Frontend Integration

The frontend talks to this app through `/api` in development. `front-end/vite.config.ts` proxies those requests to the Rails server and strips the `/api` prefix before forwarding them here.
