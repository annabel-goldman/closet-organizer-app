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
- multimodal wardrobe indexing and closet-only outfit recommendation ranking
- outfit photo upload, full-source detection persistence, and review support
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
POST    /outfits/generate_metadata_suggestions
GET     /outfits/:id
PATCH   /outfits/:id
DELETE  /outfits/:id
POST    /outfits/:id/generate_metadata_suggestions
GET     /wardrobe_item_analysis
POST    /wardrobe_item_analysis
POST    /outfit_recommendations
GET     /outfit_recommendations/:id
POST    /outfit_recommendations/:id/discard
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
- Outfit payloads preserve per-piece collage presentation through `outfit_items`: each embedded outfit item can include `outfit_item_id`, `layer_order`, and `collage_layout` (`x`, `y`, `width`, `height`, `rotation`) so the frontend can reopen and edit saved collages faithfully. The outfit integration suite covers the round-trip contract that the collage layout returned by `PATCH /outfits/:id` matches the subsequent `GET /outfits/:id` payload used by the saved gallery.
- Large collection payloads eager-load wardrobe image versions and Active Storage attachments before serialization. Outfit and magazine payloads also preload recommendation links, modeled-workflow stages/artifacts, nested clothing item images, and decoration images so request cost stays bounded instead of growing by several queries per displayed card.
- Decorations are user-owned PNG assets with private proxy-served Active Storage images. The `/decorations` CRUD endpoints power progressive bulk upload and shared image replacement; deleting a library asset cascades to its outfit and magazine placements. `OutfitDecoration` stores flat-lay position, width, rotation, and layer order independently from `OutfitItem` geometry. Outfit folders remain user-scoped collections with ordered many-to-many outfit membership and a validated `page_layouts` JSON object for each page's image mode plus percentage-based image/title/body placement. `OutfitFolderDecoration` can reference a reusable library asset while retaining backward compatibility with older directly attached magazine clip art. Ownership is checked at every placement boundary, and removing an outfit from a folder purges decorations and saved layout for its retired page.
- `POST /outfits/generate_metadata_suggestions` accepts an unsaved Outfit Cart draft, while `POST /outfits/:id/generate_metadata_suggestions` accepts the saved editor's current draft. Both take `item_ids`, title, tags, and notes, verify that every item belongs to the authenticated user, and return a structured title/tag/note suggestion grounded in those pieces without persisting an outfit or metadata changes.
- `GET /wardrobe_item_analysis` reports reusable embedding progress. `POST /wardrobe_item_analysis` starts or resumes a durable one-stage `embed` workflow. Existing current Gemini Embedding 2 vectors are preserved; only new or materially changed photographed items are embedded. Item-level failures remain retryable and do not block successful closet records, and provider calls run outside database transactions with sequential backfill writes to avoid SQLite locking.
- `POST /outfit_recommendations` accepts a prompt, optional `locked_item_ids`, and optional structured `draft_metadata` (`name`, `tags`, and `notes`) from the Outfit Cart and returns `202` with a short `retrieve → finalize` workflow. Draft metadata is normalized, persisted in the run constraints, and emphasized as creative-brief context in the query embedding. One query embedding retrieves owned-item dress, separates, or swimwear pools; local assembly then filters large formality/warmth mismatches, applies saved and rejected-outfit preferences, favors the fullest structure the closet can cover, and diversifies at most six finalists. One capped visual request compares those garment collages and returns exactly one outfit, with local-ranking fallback if visual selection fails. Every locked cart item is retained, optional outerwear/accessories may be added, rejected core combinations are suppressed, and incomplete outfits remain valid without missing-coverage commentary when a fuller structure is unavailable. Previously generated or saved structural cores are skipped when alternatives exist, while a capped frequency penalty moves suitable underused pieces into candidate pools and shortlists without overruling the prompt or an explicit cart anchor. The live flow has no excluded-item input, AI planner, iterative repair pass, quality-floor, or score cutoff. `GET /outfit_recommendations/:id` reports progress and returns the completed cart draft. `POST /outfit_recommendations/:id/discard` records a user-owned generated option as rejected when its populated cart is explicitly cleared. Deleting a saved AI-generated outfit records stronger negative `delete_after_save` feedback and prevents that core combination from being recommended again; deleting a manually created outfit does not create recommendation feedback.
- `AiWorkflow` is the durable lifecycle for multi-step AI work. Current kinds are `outfit_upload`, `item_clean`, `modeled_item`, `modeled_outfit`, `lookbook`, `wardrobe_index`, and `outfit_recommendation`; each initializes explicit stages and can report pending, processing, review, succeeded, rejected, deleted, failed, or cancelled state. `POST /ai_workflows/:id/cancel` marks unfinished stages and artifacts cancelled and resets subject state for item cleaning, outfit-photo detection, or outfit recommendations. All durable generation jobs re-check cancellation before publishing, so an external provider response that arrives after cancellation is discarded. Successful jobs automatically approve their generated artifacts/stages where applicable. `PATCH /ai_workflows/:id/preview` accepts an edited image for an authenticated user's completed modeled workflow, replaces only the generated artifact attachment, and records the manual edit timestamp/count without altering the source item or outfit. `DELETE /ai_workflows/:id/preview` purges that generated attachment, marks the artifact and workflow deleted, and likewise leaves the source unchanged; both endpoints also accept legacy `review` workflows created before automatic approval. `AiArtifact` records provider/model/prompt provenance and keeps generated files behind the authenticated workflow payload. Artifact file URLs use Active Storage's proxy route so private generated previews stream through the app instead of redirecting the browser directly to object storage.
- Outfit-photo creation stores `upload_id` and `upload_name` in the `outfit_upload` workflow metadata so the frontend can reopen the persisted upload after background detection finishes. The analysis job serializes startup against cancellation and restores cancelled state if a late provider failure arrives. Detection replacement uses one short database transaction, and completed detections retain the original full source photo without running a separate crop/refinement provider pipeline.

- `WardrobeImageVersion` retains an item's `original`, opaque AI-`generated`, and `transparent` files with parent lineage and one selected display version. Detection versions transfer into the new clothing item on save. `POST /outfit_detections/:id/generate_image` and `POST /outfit_detections/:id/remove_image_background` expose the two import stages independently; matching selection endpoints restore an existing version without deleting the others. `POST /clothing_items/:id/generate_clean_image` remains the asynchronous combined workflow and now preserves both generated outputs before selecting the transparent result.
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
  Owns shared OpenRouter JSON POST transport, authentication/application headers, timeouts, response parsing, and provider error extraction for metadata services
- `app/jobs/clean_image_generation_job.rb`, `app/jobs/modeled_image_generation_job.rb`, and `app/jobs/modeled_outfit_generation_job.rb`
  Run cancellation-safe saved-item cleaning and prepare/generate/verify modeled-preview lifecycles outside request threads; shared terminal-state checks and failure recording live in `ApplicationJob`
- `app/services/clean_image_background_remover.rb`
  Removes the white studio backdrop from generated clean images and produces the final transparent PNG attachment
- `app/models/wardrobe_image_version.rb` and `app/services/wardrobe_image_version_publisher.rb`
  Persist the shared original/generated/transparent image lineage for outfit detections and saved clothing items
- `app/services/openrouter_metadata_suggester.rb`
  Calls OpenRouter structured vision responses for item metadata suggestions
- `app/services/openrouter_outfit_metadata_suggester.rb`
  Produces structured title, tag, and note drafts for the exact pieces currently selected in the saved-outfit editor
- `app/services/openrouter_wardrobe_embedder.rb`, `app/services/wardrobe_item_analyzer.rb`, and the wardrobe analysis jobs
  Preserve current multimodal embeddings while backfilling and refreshing only new or materially changed photographed items
- `app/services/outfit_cart_recommendation_builder.rb` and `app/jobs/outfit_recommendation_run_job.rb`
  Make one query embedding, retain all Outfit Cart anchors, preference-rank and compatibility-filter owned-item combinations, visually compare a six-look shortlist once, and publish one complete or partial outfit asynchronously
- `app/services/outfit_preference_profile_builder.rb` and `app/services/outfit_compatibility_evaluator.rb`
  Build decaying user-specific item/pairing preferences from saved outfits and explicit feedback, and compare saved positive outfits against category-matched corruptions for offline evaluation
- `app/services/openrouter_magazine_suggester.rb`
  Produces a structured magazine concept and ordered owned-outfit selection from saved outfit and piece metadata
- `app/services/outfit_upload_analyzer.rb`
  Coordinates upload analysis and detection creation
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

### `WardrobeItemAnalysis`

- belongs to one `ClothingItem`
- stores the current image and metadata fingerprints so unchanged items are reused
- stores the Gemini multimodal embedding, deterministic dominant colors in RGB/Lab, normalized attributes, provider/model provenance, status, and any retryable error

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

### `Decoration` and `OutfitDecoration`

- `Decoration` belongs to one user, has one private PNG image, and is the reusable asset edited from `/decorations`
- `OutfitDecoration` joins an owned decoration to an owned outfit with percentage `x`, `y`, `width`, `rotation`, and `layer_order`
- deleting the library asset removes all of its outfit and magazine placements

### `OutfitFolder`

- belongs to one user and stores a name plus optional occasion/notes; presentation is the frontend's single minimal magazine style
- has ordered `OutfitFolderMembership` records so outfits can be reused across multiple folders
- stores validated `page_layouts` JSON keyed by `cover` or `outfit:<id>`, including flat-lay/modeled choice and percentage geometry/text for the image, title, and body layers
- has page-scoped `OutfitFolderDecoration` records that normally reference the user's reusable decoration library and carry percentage layout/layer data; legacy records may retain their own attached image

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

### Single-look experiments (not yet promoted)

The live Outfit Cart generator is intentionally separate from this retained comparison harness. The experimental contextual and visual-selection assemblers are not claimed to be validated quality improvements until blind ratings are complete. Experiments reuse existing embeddings and any legacy enrichments without triggering item reanalysis. Saved example descriptions are cached from item metadata and available visual attributes, with up to three relevant examples supplied to judging or selection.

`OutfitExperiment` stores a frozen, per-user, near-duplicate-aware example/holdout split and resumable trial manifests. It never borrows another account's outfits. `OutfitExampleDescription` caches descriptions by content fingerprint. `OutfitProviderAttempt` records each dispatch, model, maximum reservation, usage, latency, and failure. Reservations are cumulative and never refunded after ambiguous failures; all calls are outside database transactions. Unpriced models, oversized inputs, and unbounded output fail closed. The experiment cap is fixed at $5 across resumptions of `single-look-v1` for the account. Production run attempts are also logged but do not consume the experiment allowance.

Run from `back-end` with provider credentials loaded (as with `start.sh`):

```sh
USER_ID=3 LIMIT=20 SPLIT=development bundle exec rails outfits:experiment
USER_ID=3 LIMIT=10 SPLIT=held_out bundle exec rails outfits:experiment
USER_ID=3 OUTPUT_DIR=/private/tmp/outfit-review bundle exec rails outfits:export_review
USER_ID=3 RATINGS_FILE=/private/tmp/outfit-review/ratings.json bundle exec rails outfits:review
```

Replace `USER_ID` with the account under evaluation. `LIMIT` defaults to one prompt. Both new assemblers receive identical saved role pools; the old builder/scorer/judge remain frozen as an evaluation baseline. Holdout outfits and associated feedback are excluded from evaluation preference profiles. `review.html` hides method names and model scores; fill in the generated rating template with human ratings. Eligibility requires ten fully rated held-out comparisons, a higher mean human score than baseline, and no structural or explicit-constraint failures. Ties between safe new methods use reserved cost, then latency. This reports eligibility only; it never changes runtime settings or fabricates missing ratings.

The local September 12 dataset contains 17 saved outfits in the 625-item account, not 23: six other saved outfits belong to a different account. Its split is 11 examples and six held out. The full 30-prompt suite and human review may remain incomplete under the cap; incomplete evidence leaves the methods experimental.

Pilot findings (September 12–13): three development prompts compared the three methods. Both new methods passed structural checks on 3/3 prompts; the prior baseline passed 1/3. Reported provider cost was $0.06577422 across 39 attempts; conservative reservations totaled $0.45035460. These are initial smoke tests, not held-out styling evidence. The full 30-prompt evaluation and blind human ratings remain outstanding; no method has been promoted. Review eligibility requires all 30 prompts to be rated, and uses the ten held-out prompts for quality ranking. The pilot ran before targeted repair was added to the evaluation runner; subsequent comparisons include it.

See [back-end/.env.example](./.env.example) for expected variables.

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google sign-in.
- `OPENROUTER_API_KEY` is required for outfit detection, metadata suggestion, and image-cleaning features.
- `OPENROUTER_MODEL` defaults to `openai/gpt-4.1-mini`.
- `AI_CLEAN_BACKGROUND_FUZZ` optionally adjusts how aggressively edge-connected near-white pixels are removed from AI-cleaned images.
- `AI_CLEAN_SHARPEN` optionally adjusts the sharpen pass that restores edge definition on the final transparent PNG.
- `OPENROUTER_METADATA_MODEL` can override the metadata suggestion model independently.
- `OPENROUTER_EMBEDDING_MODEL` controls wardrobe-item and outfit-query embeddings and defaults to `google/gemini-embedding-2`.
- `OPENROUTER_EMBEDDING_DIMENSIONS` controls stored embedding size and defaults to `768`.
- `OUTFIT_RECOMMENDER_V2` gates the Outfit Cart recommendation API and defaults to enabled. The live generator reuses `OPENROUTER_OUTFIT_JUDGE_MODEL` for one bounded six-candidate visual-selection call; planner, enrichment, iterative repair, quality-floor, and broader judge settings remain limited to retained offline comparison tooling.
- `OPENROUTER_IMAGE_CLEAN_MODEL` controls catalog cleaning and individual modeled-item previews; it defaults to `google/gemini-2.5-flash-image`.
- `OPENROUTER_MODELED_OUTFIT_MODEL` independently controls full-outfit modeling through OpenRouter's Images API and defaults to `bytedance-seed/seedream-4.5`.
- `OPENROUTER_MODELED_OUTFIT_RESOLUTION` controls full-outfit output resolution and defaults to `2K`.
- `ACTIVE_JOB_QUEUE_ADAPTER` defaults to `solid_queue` in production and can be set to `async` or another supported adapter when needed.
- `AI_CLEAN_BACKGROUND_FUZZ` optionally tunes how aggressively the clean-image post-process removes near-white edge background pixels. It defaults to `12%`.
- `AI_CLEAN_SHARPEN` optionally adds a light sharpen pass after background removal to recover edge crispness in the final transparent PNG. It defaults to `0x0.8`.
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
