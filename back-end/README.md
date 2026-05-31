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
- AI-assisted image cleanup and metadata suggestion flows for clothing items and outfit detections, including a visible clean-image step followed by optional transparent-PNG cleanup from that same cleaned image
- HTML fallback routes for the SPA frontend

## Local Setup

```bash
bin/setup
bin/rails db:prepare db:seed
bin/dev
```

Local image-cleaning flows and related tests also expect the ImageMagick CLI to be installed, because the transparent-background cleanup step currently runs through MiniMagick.

One-time item PNG backfills use the same cleaner pipeline, so they also require a configured `OPENROUTER_API_KEY` and ImageMagick.

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
POST    /clothing_items/:id/generate_transparent_png
POST    /clothing_items/:id/generate_metadata_suggestions
GET     /outfits
POST    /outfits
GET     /outfits/:id
PATCH   /outfits/:id
DELETE  /outfits/:id
POST    /outfit_uploads
GET     /outfit_uploads/:id
POST    /outfit_detections/:id/generate_clean_image
POST    /outfit_detections/:id/generate_transparent_png
POST    /outfit_detections/:id/generate_metadata_suggestions
POST    /image_variants/metadata_suggestions
POST    /image_variants/preview
POST    /image_variants/transparent_preview
```

Notes:

- API responses default to JSON.
- `/` resolves to `clothing_items#index` inside the JSON scope.
- HTML browser requests for SPA routes fall back to the frontend shell.
- `ApplicationController` returns `404` JSON for missing records and `422` JSON for validation failures.
- In development and test only, `ApplicationController` also accepts `X-Test-User-Id` so local browser QA can impersonate an existing user without going through Google OAuth on every run.
- Clothing item create/update requests can include `clothing_item[photo]` and `clothing_item[cleaned_photo]` in the same multipart payload so the frontend can keep the original attached photo while also staging or saving a single AI-cleaned catalog image. The payload can also include `clothing_item[remove_cleaned_photo]`.
- Text input length is capped at every layer: `app/models/concerns/input_length_policy.rb` exposes the limits (username 60, email 254, item name 120, brand 80, category 60, outfit name 120, notes 2_000, tag 40 chars × 30 per record); the `User`/`ClothingItem`/`Outfit` models validate against the same constants and surface friendly errors; the `AddInputLengthConstraints` migration enforces matching `limit:` and `null: false` constraints at the database. SQL injection is mitigated by ActiveRecord's parameterized queries — the only raw SQL fragment in the app (`where("lower(email) = ?", ...)` in `User`) uses bound placeholders.
- `GET /users` is paginated via Kaminari. It accepts `page` and `per_page` query params (default 24, max 100) and returns `{ users: [...], meta: { page, per_page, total_pages, total_count } }`. The index payload omits each user's `clothing_items` array and only includes a `clothing_items_count` field; per-user `GET /users/:id` still returns the full items array.
- Outfit payloads now preserve per-piece collage presentation through `outfit_items`: each embedded outfit item can include `outfit_item_id`, `layer_order`, and `collage_layout` (`x`, `y`, `width`, `height`, `rotation`) so the frontend can reopen and edit saved collages faithfully. The outfit integration suite also covers the round-trip contract that the collage layout returned by `PATCH /outfits/:id` matches the subsequent `GET /outfits/:id` payload used by the saved gallery.

## Important Internal Files

- `app/presenters/api_payloads.rb`
  Centralizes JSON payload shaping for users, clothing items, outfits, uploads, and detections
- `app/controllers/clothing_items_controller.rb`
  Handles clothing item CRUD, photo attachment and cropping, clean-image actions, transparent-PNG cleanup, and metadata suggestions
- `app/controllers/outfit_detections_controller.rb`
  Handles detection-based clean-image, transparent-PNG cleanup, and metadata suggestion requests
- `app/controllers/image_variants_controller.rb`
  Handles temporary clean-image previews, transparent-PNG previews, and metadata suggestions for uploaded but unsaved images
- `app/services/openrouter_image_cleaner.rb`
  Calls OpenRouter image generation for the final saved clean-image output, asking the model itself to choose a white or deep-charcoal studio backdrop based on garment contrast while keeping explicit edge margin and no shadows
- `app/services/clean_image_background_remover.rb`
  Performs the ImageMagick-based transparent-background cleanup pass by sampling the dominant corner backdrop color from the cleaned image
- `app/services/transparent_png_variant_generator.rb`
  Wraps the background-removal pass and returns the resulting transparent PNG for preview/save flows
- `app/services/account_snapshot_exporter.rb`
  Serializes one user's owned records plus attachment payloads into a portable snapshot archive
- `app/services/account_snapshot_previewer.rb`
  Validates a snapshot archive against the current schema and prints the destructive replace summary before apply
- `app/services/account_snapshot_applier.rb`
  Hard-replaces one target account's owned content from a snapshot while preserving the target user identity row
- `app/services/user_clothing_item_png_backfill.rb`
  Runs a one-time per-user backfill that sends existing `ClothingItem.photo` attachments through the clean-image PNG pipeline
- `app/services/openrouter_metadata_suggester.rb`
  Calls OpenRouter structured vision responses for item metadata suggestions
- `app/services/outfit_upload_analyzer.rb`
  Coordinates upload analysis, detection creation, and crop refinement workflow
- `app/services/managed_tempfiles.rb`
  Tracks tempfiles used during crop and AI image flows
- `app/services/prepared_image_source.rb`
  Normalizes attachment-like image sources used across crop and AI workflows

## AI Flow Architecture

- `ClothingItem` and `OutfitDetection` define the source-photo policy for AI cleanup so controllers do not have to rebuild source precedence inline.
- `ImageVariantsController` remains the preview-only entrypoint for unsaved images and uses the same clean-image and transparent-background generator services as the saved-record flows.
- `CleanImageAttachmentGenerator` is the persistence boundary for saved clean-image actions, while `TransparentPngAttachmentGenerator` overwrites the saved cleaned image with the transparent result when requested.
- Account snapshot and sync flows stay outside the AI orchestration path. They can copy `cleaned_photo`, but they do not invoke the AI generator services.

## One-Time Maintenance Tasks

Mirror one account between environments with a portable snapshot archive:

1. Export from the source environment:

```bash
ACCOUNT_SNAPSHOT_PATH=/tmp/account-snapshot.tar.gz \
  bin/rails "data:export_account_snapshot[annabelgoldman2025@u.northwestern.edu]"
```

2. Preview the destructive apply in the target environment:

```bash
ACCOUNT_SNAPSHOT_PATH=/tmp/account-snapshot.tar.gz \
  bin/rails "data:preview_account_snapshot[annabelgoldman2025@u.northwestern.edu]"
```

3. Apply in the target environment:

```bash
ACCOUNT_SNAPSHOT_PATH=/tmp/account-snapshot.tar.gz \
  bin/rails "data:apply_account_snapshot[annabelgoldman2025@u.northwestern.edu,CONFIRMATION_TOKEN_IF_PROD]"
```

Notes:

- The snapshot scope is `ClothingItem`, `Outfit`, `OutfitItem`, `OutfitUpload`, `OutfitDetection`, and the related Active Storage image attachments.
- Apply hard-replaces only the matched target user's owned records. It does not overwrite the target user's auth/account identity fields.
- `ClothingItem.photo`, `ClothingItem.cleaned_photo`, `OutfitUpload.source_photo`, and `OutfitDetection.cleaned_photo` are copied exactly from the source archive. The mirror flow does not regenerate images.
- Set `ACCOUNT_SNAPSHOT_PATH` to read or write a `.tar.gz` snapshot file. If you omit it, the export task writes the archive to stdout and the preview/apply tasks read it from stdin.
- Production applies require the confirmation token printed by the preview step.
- `ACCOUNT_SNAPSHOT_STORAGE_SERVICE` optionally overrides which Active Storage service the target environment writes into. Otherwise the current environment default is used.
- The target user must already exist in the target environment so the mirror can preserve that account's identity/auth fields.

Backfill cleaned PNGs for one user's existing clothing-item photos:

```bash
bin/rails "data:backfill_user_clothing_item_pngs[annabelgoldman2025@u.northwestern.edu]"
```

Notes:

- The task only processes `ClothingItem.photo` attachments for the matched user.
- It skips items that already have a `cleaned_photo` by default.
- Set `FORCE=true` to rerun items that already have cleaned PNG output while still using the original attached item photo as the cleaner input.

Import only the production clothing items missing locally for one user, then backfill cleaned PNGs for just those imported originals:

```bash
bin/rails "data:import_missing_production_items_and_backfill_pngs[annabelgoldman2025@u.northwestern.edu]"
```

Notes:

- This is a legacy one-off maintenance path. Prefer the account snapshot mirror tasks when you need a full account replace between environments.
- This task does not replace the local account data already on disk.
- "Already exists locally" is matched by the original attached item-photo checksum.
- It imports only `ClothingItem` records and their original `photo` attachments, then runs PNG cleaning on the imported local items.

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
- clean-image status metadata plus variant/cutout-result flags

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
- `OPENROUTER_VISION_MAX_TOKENS` defaults to `500` for structured detection and crop-analysis requests.
- `OPENROUTER_METADATA_MAX_TOKENS` defaults to `300` for item metadata suggestion requests.
- `OPENROUTER_IMAGE_CLEAN_MAX_TOKENS` defaults to `300` for AI clean-image generation requests.
- `AI_CLEAN_BACKGROUND_FUZZ` optionally tunes how aggressively the clean-image post-process removes the sampled edge backdrop color. It defaults to `12%`.
- `AI_CLEAN_SHARPEN` optionally adds a light sharpen pass after background removal to recover edge crispness in the final transparent PNG. It defaults to `0x0.8`.
- `OUTFIT_CROP_CYCLE_LIMIT` controls refinement and verification retries.
- Active Storage can be configured for S3-style storage through the provided AWS variables.
- `ACCOUNT_SNAPSHOT_PATH`, `ACCOUNT_SNAPSHOT_TARGET_EMAIL`, `ACCOUNT_SNAPSHOT_CONFIRMATION_TOKEN`, and `ACCOUNT_SNAPSHOT_STORAGE_SERVICE` support the snapshot mirror tasks.
- `PRODUCTION_DATABASE_URL`, `PRODUCTION_ACCOUNT_EMAIL`, `LOCAL_ACCOUNT_EMAIL`, and `SYNC_ACCOUNT_STORAGE_SERVICE` remain available for the older legacy prod-sync maintenance tasks.

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
