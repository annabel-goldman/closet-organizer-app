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
- AI outfit generation from closet item metadata, visual descriptions, uploaded flatlay reference analysis, shortlisted candidate photos, and passive per-user feedback from saved edits/deletions
- outfit photo upload, detection persistence, crop refinement, and review support
- AI-assisted image cleanup and metadata suggestion flows for clothing items and outfit detections, including transparent-background post-processing on generated clean images
- persisted staged AI workflows and versioned artifacts for outfit imports and on-demand modeled item previews
- private per-user model reference photos with explicit consent, validation, and purge support
- HTML fallback routes for the SPA frontend

## Local Setup

```bash
bin/setup
bin/rails db:prepare db:seed
bin/dev
```

Local image-cleaning flows and related tests also expect the ImageMagick CLI to be installed, because the transparent-background cleanup step currently runs through MiniMagick.

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
DELETE  /me/model_reference
GET     /ai/status
POST    /ai_workflows
GET     /ai_workflows/:id
POST    /ai_workflows/:id/cancel
PATCH   /ai_workflows/:id/preview
DELETE  /ai_workflows/:id/preview
POST    /ai_workflows/:id/stages/:stage/approve
POST    /ai_workflows/:id/stages/:stage/reject
POST    /auth/:provider/callback
GET     /auth/failure
GET     /users
POST    /users
GET     /users/:id
PATCH   /users/:id
DELETE  /users/:id
POST    /model_reference_images
PATCH   /model_reference_images/reorder
GET     /model_reference_images/:id/photo
DELETE  /model_reference_images/:id
DELETE  /me/model_reference
GET     /clothing_items
POST    /clothing_items
GET     /clothing_items/:id
PATCH   /clothing_items/:id
DELETE  /clothing_items/:id
POST    /clothing_items/:id/generate_clean_image
POST    /clothing_items/:id/generate_metadata_suggestions
POST    /clothing_items/:id/generate_modeled_image
POST    /outfits/:id/generate_modeled_image
GET     /outfits
POST    /outfits
POST    /outfits/generate
POST    /outfits/generate_metadata_suggestions
GET     /outfits/:id
PATCH   /outfits/:id
DELETE  /outfits/:id
POST    /outfits/:id/generate_metadata_suggestions
POST    /outfits/:outfit_id/decorations
PATCH   /outfits/:outfit_id/decorations/:id
DELETE  /outfits/:outfit_id/decorations/:id
GET     /decorations
POST    /decorations
PATCH   /decorations/:id
DELETE  /decorations/:id
GET     /outfit_folders
POST    /outfit_folders
POST    /outfit_folders/generate_metadata_suggestions
GET     /outfit_folders/:id
PATCH   /outfit_folders/:id
DELETE  /outfit_folders/:id
POST    /outfit_folders/:id/generate_metadata_suggestions
POST    /outfit_folders/:outfit_folder_id/decorations
PATCH   /outfit_folders/:outfit_folder_id/decorations/:id
DELETE  /outfit_folders/:outfit_folder_id/decorations/:id
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
- Outfit payloads now preserve per-piece collage presentation through `outfit_items`: each embedded outfit item can include `outfit_item_id`, `layer_order`, and `collage_layout` (`x`, `y`, `width`, `height`, `rotation`) so the frontend can reopen and edit saved collages faithfully. AI-generated outfits also include optional `generation_id`, `generated_by_ai`, and `generated_item_ids` fields. The outfit integration suite covers the round-trip contract that the collage layout returned by `PATCH /outfits/:id` matches the subsequent `GET /outfits/:id` payload used by the saved gallery.
- Decorations are user-owned PNG assets with private proxy-served Active Storage images. The `/decorations` CRUD endpoints power progressive bulk upload and shared image replacement; deleting a library asset cascades to its outfit and magazine placements. `OutfitDecoration` stores flat-lay position, width, rotation, and layer order independently from `OutfitItem` geometry. Outfit folders remain user-scoped collections with ordered many-to-many outfit membership, and `OutfitFolderDecoration` can reference a reusable library asset while retaining backward compatibility with older directly attached magazine clip art. Ownership is checked at every placement boundary, and removing an outfit from a folder purges placements for its retired page.
- `POST /outfits/generate` accepts JSON `{ "occasion": "optional vibe or event" }` or multipart form data with `occasion` plus an optional `reference_photo` flatlay image. It snapshots the current owned closet item IDs, persists the optional reference on an `outfit_generation` workflow, queues `OutfitGenerationJob`, and immediately returns the workflow with `202 Accepted`. The job analyzes a reference into structured target slots, shortlists candidates while preserving required slots and cross-slot visual anchors, applies complete-look rules, and performs visual refinement. It creates the outfit and preference-learning run only after the provider returns and a final cancellation check succeeds, then stores `outfit_id` and `result_name` in workflow metadata. A cancelled late response never creates an outfit, and the temporary reference attachment is purged when the job reaches a terminal state.
- `POST /outfits/generate_metadata_suggestions` accepts an unsaved Outfit Cart draft, while `POST /outfits/:id/generate_metadata_suggestions` accepts the saved editor's current draft. Both take `item_ids`, title, tags, and notes, verify that every item belongs to the authenticated user, and return a structured title/tag/note suggestion grounded in those pieces without persisting an outfit or metadata changes.
- AI outfit feedback is stored as recommender-style logs. Each generated outfit creates an `outfit_generation_run` with candidate item IDs, generated item IDs, the structured reference profile, and generator version. Save/delete behavior appends `outfit_generation_events`: unchanged saves become positive keep signals, item-list edits become added/removed/kept correction signals, layout-only edits do not become item-change feedback, and deletes become weak negative feedback for the generated combination. Runs survive outfit deletion through a nullable `outfit_id`.
- `AiWorkflow` is the durable lifecycle for multi-step AI work. Current kinds are `outfit_upload`, `item_clean`, `outfit_generation`, `modeled_item`, `modeled_outfit`, and `lookbook`; each initializes explicit stages and can report pending, processing, review, succeeded, rejected, deleted, failed, or cancelled state. `POST /ai_workflows/:id/cancel` marks unfinished stages and artifacts cancelled and resets subject state for item cleaning or outfit-photo detection. All durable generation jobs re-check cancellation before publishing, so an external provider response that arrives after cancellation is discarded. Successful jobs automatically approve their generated artifacts/stages where applicable. `PATCH /ai_workflows/:id/preview` accepts an edited image for an authenticated user's completed modeled workflow, replaces only the generated artifact attachment, and records the manual edit timestamp/count without altering the source item or outfit. `DELETE /ai_workflows/:id/preview` purges that generated attachment, marks the artifact and workflow deleted, and likewise leaves the source unchanged; both endpoints also accept legacy `review` workflows created before automatic approval. `AiArtifact` records provider/model/prompt provenance and keeps generated files behind the authenticated workflow payload. Artifact file URLs use Active Storage's proxy route so private generated previews stream through the app instead of redirecting the browser directly to object storage.
- Outfit-photo creation stores `upload_id` and `upload_name` in the `outfit_upload` workflow metadata so the frontend can reopen the persisted upload after background detection finishes. The analysis job serializes startup against cancellation and restores cancelled state if a late provider failure arrives.

- `POST /clothing_items/:id/generate_clean_image` now queues `CleanImageGenerationJob` and returns an `item_clean` workflow with `202 Accepted`. The job generates and removes the background off-request, publishes the cleaned attachment only after a cancellation-safe lock, updates the item cache-facing clean-image state, and records an approved artifact for provenance.
- A user can keep up to three ordered `ModelReferenceImage` records. Uploading the first reference records consent, the first image is the primary identity anchor, individual references can be removed or reordered, and removing the final reference clears consent. Existing single-photo attachments are migrated into position one. Thumbnail bytes are served only through `GET /model_reference_images/:id/photo`, which scopes lookup to the authenticated user rather than exposing a direct storage URL.
- `POST /clothing_items/:id/generate_modeled_image` requires the current user to have at least one validated private model reference and a consent timestamp. It queues `ModeledImageGenerationJob`, which labels and sends all ordered references to the existing OpenRouter modeled-preview prompt, requests a vertical `4:5` head-to-toe cutout on an opaque, uniformly pure-white background without a floor, cast shadow, reflection, halo, or tonal falloff, and automatically publishes the finished artifact as an approved preview.
- `POST /outfits/:id/generate_modeled_image` uses the same consent gate and queues `ModeledOutfitGenerationJob`. An optional multipart `modeled_outfit` payload can snapshot the editor's current `item_ids`, title, tags, and notes plus a temporary `flatlay_snapshot`; item IDs are ownership-checked and the worker generates from that immutable request snapshot rather than re-reading later-saved outfit links. Requests without a draft remain backward-compatible and use the saved outfit. Every requested item must have a display photo, and the combined identity, garment, and flat-lay inputs are limited to the provider's 14-reference maximum. Full-outfit modeling uses Seedream 4.5 through OpenRouter's dedicated `/images` API by default, sends ordered private identity references first, garment references next, and the styled flat lay last as composition-only guidance, then requests a `2K` vertical `4:5` isolated cutout on an opaque, uniformly pure-white background and records returned usage/cost data on the artifact. The flat-lay input is purged at terminal workflow state. The persisted `modeled_outfit` workflow moves directly to `succeeded` when ready, and outfit payloads include that workflow so the frontend can reopen or delete its preview.
- Production defaults Active Job to Solid Queue and connects it to the `queue` database role. `config/queue.yml`, `config/recurring.yml`, `bin/jobs`, and `db/queue_schema.rb` are checked in for the worker lifecycle; `ACTIVE_JOB_QUEUE_ADAPTER` can still override the adapter for controlled environments.

## Important Internal Files

- `app/presenters/api_payloads.rb`
  Centralizes JSON payload shaping for users, clothing items, outfits, uploads, and detections
- `app/controllers/clothing_items_controller.rb`
  Handles clothing item CRUD, photo attachment and cropping, clean-image generation, and metadata suggestions
- `app/controllers/outfit_detections_controller.rb`
  Handles detection-based clean-image and metadata suggestion requests
- `app/controllers/decorations_controller.rb`, `app/controllers/outfit_decorations_controller.rb`, `app/controllers/outfit_folders_controller.rb`, and `app/controllers/outfit_folder_decorations_controller.rb`
  Handle the private reusable PNG library plus user-scoped flat-lay and magazine placements
- `app/controllers/image_variants_controller.rb`
  Handles temporary AI preview generation and metadata suggestions for uploaded but unsaved images
- `app/controllers/ai_status_controller.rb`, `app/controllers/ai_workflows_controller.rb`, `app/controllers/modeled_images_controller.rb`, and `app/controllers/modeled_outfit_images_controller.rb`
  Expose authenticated AI readiness, workflow lifecycle, and on-demand modeled item/full-outfit preview requests
- `app/services/openrouter_image_cleaner.rb`
  Calls OpenRouter image generation for cleaned catalog imagery, private modeled item previews, and labeled full-outfit previews
- `app/services/openrouter_client.rb`
  Owns shared OpenRouter JSON POST transport, authentication/application headers, timeouts, response parsing, and provider error extraction for metadata and outfit-generation services
- `app/jobs/clean_image_generation_job.rb`, `app/jobs/outfit_generation_job.rb`, `app/jobs/modeled_image_generation_job.rb`, and `app/jobs/modeled_outfit_generation_job.rb`
  Run cancellation-safe saved-item cleaning, outfit creation, and prepare/generate/verify modeled-preview lifecycles outside request threads; shared terminal-state checks and failure recording live in `ApplicationJob`
- `app/services/clean_image_background_remover.rb`
  Removes the white studio backdrop from generated clean images and produces the final transparent PNG attachment
- `app/services/openrouter_metadata_suggester.rb`
  Calls OpenRouter structured vision responses for item metadata suggestions
- `app/services/openrouter_outfit_generator.rb`
  Orchestrates reference-aware saved outfit generation from closet item context and wraps AI failures with stage-specific error details
- `app/services/openrouter_outfit_metadata_suggester.rb`
  Produces structured title, tag, and note drafts for the exact pieces currently selected in the saved-outfit editor
- `app/services/openrouter_magazine_suggester.rb`
  Produces a structured magazine concept and ordered owned-outfit selection from saved outfit and piece metadata
- `app/services/openrouter_outfit_reference_analyzer.rb`
  Converts an uploaded flatlay reference into structured target slots used by candidate selection and final refinement
- `app/services/outfit_reference_matcher.rb`
  Scores closet items against structured reference target slots, preserves strong slot candidates, applies gentle user preference nudges, and repairs final generated item lists
- `app/services/outfit_generation_preference_builder.rb`
  Summarizes recent generated-outfit save/edit/delete events into compact per-user preference signals for future generation
- `app/services/openrouter_outfit_candidate_selector.rb`
  Calls OpenRouter structured multimodal responses to shortlist candidate item IDs from metadata, visual descriptions, and reference target slots
- `app/services/openrouter_outfit_visual_refiner.rb`
  Calls OpenRouter structured multimodal responses to choose the final outfit from shortlisted candidates, sending metadata for all candidates and a capped set of available photos
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
- `has_many :outfit_folders`
- `has_many :decorations`
- `has_many :outfit_generation_runs`
- `has_many :outfit_uploads`
- `has_many :ai_workflows`
- `has_many :model_reference_images`, with `model_reference_consent_at`

### `ModelReferenceImage`

- belongs to one user and stores a zero-based position
- has one private `photo` via Active Storage
- validates image content type, a 10 MB per-photo limit, unique ordering, and a maximum of three references per user

### `ClothingItem`

- `name`
- `category`
- `brand`
- `style_notes`
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
- `has_one :outfit_generation_run`

### `OutfitItem`

- `outfit_id`
- `clothing_item_id`
- `layer_order`
- `collage_x`
- `collage_y`
- `collage_width`
- `collage_height`
- `collage_rotation`

### `Decoration` and `OutfitDecoration`

- `Decoration` belongs to one user, has one private PNG image, and is the reusable asset edited from `/decorations`
- `OutfitDecoration` joins an owned decoration to an owned outfit with percentage `x`, `y`, `width`, `rotation`, and `layer_order`
- deleting the library asset removes all of its outfit and magazine placements

### `OutfitFolder`

- belongs to one user and stores a name plus optional occasion/notes; presentation is the frontend's single minimal magazine style
- has ordered `OutfitFolderMembership` records so outfits can be reused across multiple folders
- has page-scoped `OutfitFolderDecoration` records that normally reference the user's reusable decoration library and carry percentage layout/layer data; legacy records may retain their own attached image

### `OutfitGenerationRun`

- `user_id`
- nullable `outfit_id`
- `occasion`
- `reference_profile`
- `candidate_item_ids`
- `generated_item_ids`
- `generator_version`
- `generated_at`
- `has_many :outfit_generation_events`

### `OutfitGenerationEvent`

- `outfit_generation_run_id`
- `event_type` (`generated`, `opened_for_edit`, `saved_unchanged`, `saved_with_item_changes`, `deleted`)
- `final_item_ids`
- `added_item_ids`
- `removed_item_ids`
- `kept_item_ids`

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

### `AiWorkflow`, `AiWorkflowStage`, and `AiArtifact`

- `AiWorkflow`: user, kind, status, provider/model/prompt version, progress counters, optional polymorphic subject, and lifecycle timestamps
- `AiWorkflowStage`: workflow, stable stage key, status, decision, attempts, diagnostics, and error state
- `AiArtifact`: stage, kind/status, provider/model/prompt provenance, diagnostics, optional polymorphic subject, and generated `file` via Active Storage

## Environment

See [back-end/.env.example](./.env.example) for expected variables.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google sign-in.
- `OPENROUTER_API_KEY` is required for outfit detection, metadata suggestion, and image-cleaning features.
- `OPENROUTER_MODEL` defaults to `openai/gpt-4.1-mini`.
- `AI_CLEAN_BACKGROUND_FUZZ` optionally adjusts how aggressively edge-connected near-white pixels are removed from AI-cleaned images.
- `AI_CLEAN_SHARPEN` optionally adjusts the sharpen pass that restores edge definition on the final transparent PNG.
- `OPENROUTER_METADATA_MODEL` can override the metadata suggestion model independently.
- `OPENROUTER_OUTFIT_MODEL` can override the AI outfit generator model independently.
- `OPENROUTER_IMAGE_CLEAN_MODEL` controls catalog cleaning and individual modeled-item previews; it defaults to `google/gemini-2.5-flash-image`.
- `OPENROUTER_MODELED_OUTFIT_MODEL` independently controls full-outfit modeling through OpenRouter's Images API and defaults to `bytedance-seed/seedream-4.5`.
- `OPENROUTER_MODELED_OUTFIT_RESOLUTION` controls full-outfit output resolution and defaults to `2K`.
- `ACTIVE_JOB_QUEUE_ADAPTER` defaults to `solid_queue` in production and can be set to `async` or another supported adapter when needed.
- `AI_CLEAN_BACKGROUND_FUZZ` optionally tunes how aggressively the clean-image post-process removes near-white edge background pixels. It defaults to `12%`.
- `AI_CLEAN_SHARPEN` optionally adds a light sharpen pass after background removal to recover edge crispness in the final transparent PNG. It defaults to `0x0.8`.
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

Current backend coverage includes model tests plus integration/service coverage for auth-sensitive flows, clothing items, outfits, image variants, uploads, clean-image services, and shared OpenRouter transport behavior.

## Frontend Integration

The frontend talks to this app through `/api` in development. `front-end/vite.config.ts` proxies those requests to the Rails server and strips the `/api` prefix before forwarding them here.
