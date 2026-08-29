# Changelog

## Unreleased

- Extended the Outfit Cart metadata fields and AI feedback message across the full usable width of the sidebar while preserving space for its header actions.
- Removed the redundant supporting sentence from the model reference photos dialog.
- Moved magazine creation and editing out of constrained dialogs into dedicated full-page workspaces. Opening a magazine now launches an independent immersive reader tab with animated book-like page turns, keyboard navigation, decoration controls, and flat-lay fallback pages when a modeled image is unavailable.
- Added fuzzy search to the outfits gallery across outfit names, tags, notes, and contained closet pieces, with clear and empty-result states.
- Moved the `My Outfits` header action beside `Closet` so the app's two primary destinations stay grouped together.
- Polished the outfits gallery's Flatlay/Model switch with a fixed-size overlapping crossfade, subtle scale/vertical easing, a stable toggle width, and a reduced-motion fallback.
- Replaced the magazine editor's text-only outfit checklist with a scrollable visual picker that favors modeled previews, falls back to saved flat lays, and supports fuzzy search across outfit and contained-piece metadata.
- Added AI magazine autofill: an icon-only action expands the current title/notes into a cohesive concept and selects and orders matching owned saved outfits, leaving the complete draft editable and unsaved until confirmation.
- Simplified magazines to one minimal white presentation, removing the style selector and the retired editorial/scrapbook theme field across the frontend and backend.
- Open the outfit editor on the modeled preview when editing from Model view, with left-arrow navigation back to the flat lay.
- Updated multi-photo item detection so every selected source photo appears in the upload strip before analysis; users can focus each source independently and replace, delete, crop, or erase its background without collapsing the rest of the batch.
- Simplified the shared image-editing screen by removing the dynamic `Adjust …` heading and redundant crop/background-removal instructional copy while retaining the tool labels and controls.
- Removed 40 unreachable frontend modules—including the retired staged-AI review surfaces and unused generated UI-kit components—and removed the 27 direct packages used only by that dead subtree, reducing maintained frontend source without changing the production feature graph.
- Refactored the AI and image workflow foundations without changing their user-facing behavior: a single app-level task manager now owns durable workflow polling and cancellation, repeated OpenRouter request setup and Rails job terminal-state handling are centralized, and image downloads share one authenticated Active Storage proxy pipeline.
- Fixed the item image editor so unrelated app updates—including background generation polling—no longer reload the source image or leave the editor stuck behind its loading state; editor sources now have explicit stable identities and component regression coverage.
- Split closet controls, magazine state, AI workflow APIs/types, and route-level page bundles out of oversized frontend modules. Added strict TypeScript checking, ESLint, Vitest component coverage, and matching CI checks alongside the existing contract tests and production build.
- Added the icon-only `AI fill details` action to the Outfit Cart so selected pieces can draft an editable outfit name, tags, and notes before creation; both cart and saved-outfit autofill actions now sit beside their modal close control in a shared header-action row.
- Removed the redundant `My Outfits` page heading and added an `All outfits` / `My Magazines` view switch. The magazine library now collects existing magazines in one place with actions to create a magazine, add or reorder its outfits, open it, or delete it, while outfit-only actions stay within the outfits view.
- Added a subtle divider between each saved outfit card's visual preview and its title/action area.
- Expanded `Add Multiple Items` into a true multi-photo import: users can select several photos at once, each photo runs as an independent cancellable workflow with bounded concurrency, and completed detections populate the shared review strip immediately without waiting for the full batch.
- Simplified saved-outfit cards by removing the `Saved Look` and `AI generated` labels along with the piece count, tags, and notes, while retaining outfit details in the editor.
- Fixed flat-lay item proportions by keeping saved collage frames authoritative when asynchronous image-content measurements arrive, containing tall and wide garments proportionally inside those frames, and using the same containment math for modeled-outfit snapshot guidance.
- Updated modeled item and outfit generation to request a photorealistic isolated person cutout on an opaque, uniformly pure-white background with no floor, tonal falloff, cast/contact shadow, reflection, or halo, making the background easier to remove with the image editor's magic wand.
- Fixed the shared image editor to fit source images with one proportional scale, preserve the intrinsic aspect ratio through crop and magic-wand views, and avoid independent width/height rounding that could make portrait images look slightly stretched horizontally.
- Fixed transparent modeled-outfit previews in both the outfit carousel and modeled gallery cards so their empty background renders pure white instead of light gray.
- Added user-owned outfit folders for trips and occasions, with ordered many-to-many outfit membership, folder filtering on `/outfits`, a minimal animated cover-and-look magazine viewer that favors modeled previews, and private page-specific clip-art uploads that can be moved, resized, rotated, or deleted without changing the source outfits.
- Added the current styled flat-lay canvas as a temporary composition reference for full-outfit model generation, preserving the user's item sizing, rotation, layering, and visual arrangement as wearable styling guidance while keeping individual garment images authoritative for item identity.
- Fixed modeled-outfit requests that could stop before queueing by routing every item download used for the flat-lay snapshot and image-bounds measurement through the app's same-origin Active Storage proxy.
- Generalized the lower-right generation task toast across modeled outfits, modeled items, saved-item image cleaning, AI outfit creation, and outfit-photo detection, allowing navigation during processing and cancellation from any signed-in page; successful notices turn pale green and dismiss automatically after three seconds, while failed notices remain light red with a one-click error-copy action. Completed notices link back to their result, including restoring a finished outfit-photo import, while durable jobs discard late provider results after cancellation.
- Reused the existing full-screen item image editor for generated modeled item and outfit previews, adding crop presets, rotation, magic-wand background erasure, edit-level undo/redo, and authenticated persistence of the edited preview.
- Allowed `Model this look` to run immediately against the outfit editor's current unsaved pieces, order, title, tags, and notes by snapshotting the validated draft into the background workflow.
- Added a page-level `Model view` toggle to the saved-outfits gallery so every card switches from its flat lay to its modeled image, with a consistent neutral model placeholder when no generated preview exists; card actions read `Model this look` for empty previews and `Regenerate model` for existing previews, with replacement confirmation before regeneration.
- Added an icon-only `AI fill details` action with a descriptive tooltip to the saved-outfit editor, generating a draft title, tags, and notes from the editor's current owned closet pieces without saving until the user reviews and confirms the changes.
- Aligned the model-reference dialog heading and supporting copy with the app's shared Cormorant Garamond display and Outfit body typography primitives.
- Simplified modeled previews so successful item and outfit generations are approved automatically and immediately available; users now discard unwanted previews with the existing confirmed delete control, and the internal prepare/generate/verify status card is no longer shown.
- Split full-outfit modeling from the catalog-cleaning model and moved it to Seedream 4.5 through OpenRouter's dedicated Images API, sending private identity references first, supporting up to 14 total references, requesting `2K` vertical output, and recording provider usage/cost diagnostics.
- Fixed modeled item and outfit generation to request a vertical `4:5` portrait canvas with head-to-toe framing instead of allowing landscape output.
- Moved modeled-outfit generation into a global lower-right task toast that persists across page navigation, supports cancellation from any signed-in page, and changes to a generated-preview notice when the artifact is ready; cancelled provider responses are now discarded instead of being attached late.
- Added a confirmed delete control directly on approved modeled item and outfit images, permanently purging the generated file while preserving the underlying closet item, outfit, and flat lay.
- Updated modeled item and outfit prompts to place the person against a seamless plain white studio background; the latest cutout prompt above further removes grounding shadows and all background variation.
- Fixed modeled-preview rejection so it rejects the generated artifact, removes it from the outfit carousel and item preview, and persists the workflow as rejected instead of leaving the image in review.
- Expanded private model references from one photo to an ordered set of up to three, with authenticated thumbnails, primary-reference ordering, individual/all removal, existing-photo migration, and multi-angle identity context for item and outfit generation.
- Fixed generated modeled-preview images to stream through the app's same-origin Active Storage proxy instead of relying on a browser-visible storage redirect.
- Added a flat-lay/modeled carousel to the saved-outfit editor, revealing directional controls and touch-swipe navigation as soon as a modeled artifact is available, keeping its page indicator below the image canvas, and avoiding redundant labels over the imagery.
- Added outfit-first `Model this look` previews on saved outfit cards and the outfit editor, generating one private full-look image from every outfit piece plus the user's model reference photo.
- Added persisted `modeled_outfit` workflow payloads, background generation, automatic artifact publication, and deletion lifecycle support while retaining the item-level modeled preview.
- Reused the shared modeled-preview image treatment across item and outfit surfaces, with generated full looks tied to the requested editor snapshot.
- Added durable staged AI workflow, stage, and artifact records with user-scoped status payloads for outfit imports and modeled previews.
- Added a private per-user model-reference photo with validation, explicit consent timestamp, and purge endpoint; no model-reference URL is exposed in user payloads.
- Added an on-demand `Model on me` surface to the existing item editor, backed by Solid Queue and an OpenRouter modeled-preview prompt, with in-place polling and automatic publication when generation succeeds.
- Added production Solid Queue configuration, worker entrypoint, queue schema, and queue adapter readiness reporting.
- Updated architecture documentation and project index for the new workflow, artifact, queue, and private-reference boundaries.
- Added a two-minute product demo to the public frontend assets and linked it from the logged-out homepage and project documentation.
- Added an invite-only confirmation before Google sign-in, with approval instructions and an explicit `Continue to sign in` action.
- Updated Brakeman to `8.0.5` so the CI security scan continues enforcing the latest scanner release.
- Updated affected Ruby dependencies—including ERB, Faraday, JWT, Puma, Nokogiri, OAuth2, SQLite3, and related transitive gems—to patched releases that resolve current security advisories.
- Allowed `gabbyggoldman@gmail.com` to create an account and sign in through Google.
- Added passive AI outfit feedback learning: generated outfits now log recommendation runs, candidate impressions, generated item IDs, save/edit/delete events, and per-user preference signals that gently influence future candidate selection, visual refinement, and reference matching.
- Documented the Heroku production app, GitHub Actions deploy flow, required config variable names, OAuth URLs, and operational commands in `DEPLOYMENT.md` without committing secret values.
- Renamed the item editor's user-facing `Style notes` field to `Visual description`, retuned AI metadata suggestions toward objective item descriptions, and added a one-time regeneration task for closet item visual descriptions.
- Improved flatlay-based AI outfit generation by analyzing uploaded references into structured target slots, preserving strong closet matches for required slots during candidate selection, and repairing final outfits to include missing required reference pieces when available.
- Tuned flatlay matching to preserve cross-slot visual anchors such as sequins, burgundy leather, patent shine, satin, and glam styling so generated looks can prioritize cohesive vibe over literal item-type matching.
- Improved reference-slot repair so generated outfits can replace an already-selected weak top or bottom with a stronger palette/silhouette match instead of stopping once the slot is merely filled.
- Added a root-level `stop.sh` helper that stops local Rails and Vite dev servers without restarting them, using the same port arguments as `start.sh`.
- Added `accessory` to the canonical frontend item type picker and normalized bag-like item types into `accessory`.
- Added `swimwear` to the canonical frontend item type picker and normalized swimwear aliases such as bikini and swimsuit to that type.
- Added a sticky round outfit-cart button on the closet page that appears once the top cart button scrolls out of view.
- Added a lower-right confirmation toast when closet items are added to or removed from the outfit cart.
- Added an optional flatlay reference upload to AI outfit generation so the selector and visual refiner can match the closest available closet outfit to an uploaded look.
- Added search to the saved-outfit editor's add-item popover so large closets can find pieces without scanning the full thumbnail grid.
- Cached the saved-outfits collection at the app level so visiting `/outfits` reuses already-loaded data and only updates the cache after outfit create, edit, delete, AI generation, or clothing-item changes.
- Restored the canonical clothing type picker for item add/edit flows, including category alias normalization and frontend validation against the supported wardrobe taxonomy.
- Restored undo/redo controls for manual item creation, detected-item metadata drafts, and saved item-detail changes, with keyboard shortcuts where the workflow can safely restore state.
- Restored the manual add-item pending AI-clean save dialog so users can create with the current image immediately or create now and attach the cleaned image when it finishes.
- Restored add/remove piece controls inside the saved-outfit editor modal so existing outfits can pull additional items directly from the closet while editing.
- Restored the expanded image editor for detected outfit-photo items, so newly detected items can be cropped, erased with the magic wand, AI-cleaned, and saved with the edited preview.
- Restored the expanded item-image editor on item detail pages, including crop, magic-wand erase, and AI-clean actions from the image preview dialog.
- Hardened AI outfit generation so failures return the failing AI stage and provider details, final visual refinement sends a capped number of candidate photos, and dress-based looks require available footwear instead of saving a single-item outfit while treating bags as an optional preference.
- Updated AI outfit generation prompts so generated looks prefer including a complementary bag when the closet has a suitable bag-like accessory.
- Reworked AI outfit generation into a two-stage flow: OpenRouter first picks a text-only candidate shortlist from closet metadata and visual descriptions, then refines the final saved outfit with photos for only those candidate items.
- Randomized the closet item context sent to AI outfit generation so generated looks are less biased toward alphabetically early items such as beige pieces.
- Added per-item visual descriptions plus an AI outfit generator on `/outfits` that creates a saved look from closet metadata and visual descriptions.
- Restricted Google sign-in to an explicit approved-account allowlist and added a clear unauthorized-account login message.
- Reused the already-loaded session closet data when navigating between protected pages so returning to `/closet` no longer refetches the full item list during the same app session.
- Removed size and purchase-date fields from the item create/edit UI, item metadata previews, closet search/sort surfaces, and profile item rows.
- Added filter-aware closet search suggestions with fuzzy typo matching: typing in the closet search field now opens an item dropdown that respects active tag, color, and brand filters, click fills the search query, and Enter opens the highlighted item.
- Fixed Heroku frontend deploys by keeping the Vite build-time plugins (`@tailwindcss/vite` and `@vitejs/plugin-react`) in production dependencies and pinning the root Node runtime to `22.x`.
- Added a configurable post-removal sharpen step to AI-cleaned transparent PNG outputs so item edges render a bit crisper after background removal.
- Added automated saved-outfit collage contract coverage for backend round-trips and frontend layout math so saved cards, the editor preview, and resize-ratio fallback stay aligned.
- Updated CI to install ImageMagick alongside `libvips` so the MiniMagick-backed clean-image background removal path and its tests run in GitHub Actions.
- Routed local Active Storage image URLs through the Vite dev server so outfit collage previews can measure image bounds without cross-origin console errors while developing at `127.0.0.1:5173`.
- Slimmed the `/outfits` saved-look cards so the collage stage reads closer to the editor preview proportions instead of feeling visually too wide.
- Updated the `/outfits` gallery to use three saved-look cards per row on larger screens so the slimmer cards fill the page more naturally.
- Reworked the mobile Edit Outfit modal so the collage preview stays dominant, with the layers strip pinned to the left of the canvas instead of stacking above it.
- Changed the mobile Edit Outfit modal to scroll as a single vertical flow, with the outfit editor taking the first screen and the detail form living below it.
- Fixed the `/outfits` collage renderer so local Active Storage images load again from the Rails origin without tripping browser CORS enforcement on the visible `<img>` elements.
- Switched outfit collage rendering to measure each image's visible alpha bounds and use those same content bounds in both the saved view and editor.
- Unified the saved-look and edit-modal outfit previews onto the same normalized renderer path in `OutfitCollageCanvas` so edited and saved composition stay in lockstep.
- Moved the saved-look and edit-modal outfit previews back onto a single shared stage-aspect contract in `OutfitCollageCanvas` so saved outfits render the same composition you see while editing.
- Reduced the saved-look card preview size on `/outfits` and capped the edit-modal collage preview by viewport height so the full outfit stays visible without preview-pane scrolling.
- Relaxed the outfit collage editor bounds so pieces can now sit partially off-canvas, allowing looks where up to half of an item extends beyond the white outfit stage.
- Added a background-removal post-process to the AI clean-image pipeline so generated item photos are attached as transparent PNG cutouts instead of keeping the white studio backdrop.
- Rebuilt the saved-outfit collage editor on `react-moveable`, replacing the custom drag/resize/rotate control math with library-backed corner handles, top rotation control, and a cleaner DOM-target interaction model.
- Simplified the edit-modal layers panel into a slim left-side thumbnail strip so the collage preview keeps more vertical room and better matches the outfit canvas proportions.
- Corrected the outfit edit collage editor so the resize outline now follows the actual visible photo bounds with corner-only resize controls, and fixed the edit modal's breakpoint width cap so the preview workspace can expand properly on larger screens.
- Added persisted outfit-collage layout data on `outfit_items` so saved looks can store per-piece position, size, rotation, and layer order for edit-modal collage editing.
- Expanded the outfit edit modal so the collage preview now appears at full size in the left panel while editing saved looks.
- Removed the outfit cart footer helper copy so the selected-items tray has more room to show outfit pieces before creation.
- Redesigned the closet-to-outfit flow into a cart-style builder: adding an item now updates a closet-page cart button with a notification badge, the cart opens a right-side review tray with inline outfit name, tag, and notes fields, and creating an outfit from that tray now ends with a success popup that links back to Closet or into My Outfits.
- Removed the standalone create-outfit form from the `/outfits` page so new outfits now enter the system through the closet cart, while `/outfits` stays focused on browsing and editing saved looks.
- Refreshed the `/outfits` gallery into larger, photo-led saved-look cards so outfit pieces are previewed visually first instead of appearing primarily as text rows.
- Replaced the inline `/outfits` edit section with a focused edit modal that keeps the outfit preview visible on the left while title, tags, and notes are edited on the right.
- Added project-wide text input length limits enforced at every layer: a shared `InputLengthPolicy` module (Rails) with model validations on `User`, `ClothingItem`, and `Outfit`; a new migration that mirrors the caps as database `limit:` constraints and marks load-bearing identifier columns (`users.username`, `users.provider`, `users.uid`, `clothing_items.name`, `outfits.name`) as `null: false` with backfill for legacy blank rows; and a matching `inputLengthPolicy.ts` on the frontend that exposes `maxLength` on the item, outfit name, notes, and tag inputs.
- Documented the SQL injection posture: every query uses ActiveRecord's parameterized API or strong params; the only raw SQL fragment (`where("lower(email) = ?", ...)`) uses bound placeholders so user-supplied values are never interpolated into SQL.
- Added Kaminari-backed pagination to the admin users index (`GET /users?page=&per_page=`) returning a `{ users, meta }` envelope, surfaced a paginated grid with Previous/Next/page controls on the admin users directory, and switched the directory cards to a `clothing_items_count` field so per-user item arrays no longer ship with the index payload.
- Expanded `db/seeds.rb` to a development-scale dataset (~1,050 users, ~5,200 clothing items, ~2,100 outfits with linked items) so pagination and large-list performance are visible during local development.
- Renamed the app to Curated Closet, added branded sign-in/logo assets plus a new favicon, refreshed the home sign-in copy, redirected signed-in visits to `/` back to `/closet`, and switched signed-out auth fallbacks to a single standalone sign-in screen without the main app shell.
- Added persisted clothing item categories and detection-source links so AI-detected item types survive into saved closet records.
- Added AI metadata suggestion endpoints for clothing items, outfit detections, and temporary image previews, and passed richer metadata/reference-image context into AI clean-image generation.
- Refined the add, edit, and detect-item flows with a shared editor workspace, category-aware metadata panels, richer detection previews, safer overwrite confirmation dialogs, compact AI action buttons, and footer/filter polish.
- Added explicit loading feedback while detected-item metadata is still being prepared so the detect workflow no longer leaves the details pane blank during AI autofill.
- Tuned the closet page for narrow mobile/PWA installs by keeping filter controls in a horizontal row, tightening trigger spacing, and using a denser two-column mobile item grid with slightly squarer cards.
- Hardened local startup checks so `start.sh` can surface missing Ruby/Node toolchains earlier and fall back to common local Ruby install paths more gracefully.

## v2.0.2 - 2026-05-14

- Reworked the add, edit, and detect-item flows into a more structured item editing workspace with clearer separation between metadata, photo management, and detection review.
- Added richer detection review UI, including larger preview treatment, thumbnail strip navigation, and stronger crop inspection for image-based item creation.
- Extended shared primitive controls and item form components to support the refreshed item workflow without falling back to new ad hoc button, dropdown, or typography styles.

## v2.0.1 - 2026-05-10

- Fixed accessible labels for closet filter controls so the closet search and filter bar reads more clearly for assistive technology.
- Tightened the filter control semantics in the main app shell without changing the underlying closet filtering behavior.

## v2.0.0 - 2026-05-10

- Kicked off Milestone 2 with improved keyboard access and aria-label coverage for the item image preview experience.
- Expanded image preview interaction options so preview controls are easier to discover and use without a mouse.

## v1.0.12 - 2026-05-15

- Added `erb_lint` gem and `.erb_lint.yml` config to lint ERB templates for safety, indentation, whitespace, and unused capture issues.
- Added `bin/erblint` executable wrapper to run ERB linting locally.
- Integrated ERB linting as a `Style: ERB templates` step in `bin/ci` and the GitHub Actions `lint` job.

## v1.0.11 - 2026-05-09

- Split the frontend app shell into smaller route, filter, API, async-loading, and draft-persistence modules to make the main app flow easier to follow.
- Extracted the create-item image-review flow into focused components and simplified the outfits form state so create and edit behavior share cleaner paths.
- Moved backend API payload shaping into `ApiPayloads` and unified AI-cleanup tempfile and prepared-image handling across controllers and services.

## v1.0.10 - 2026-05-04

- Persisted full outfit draft state per user so name, notes, tags, and selected item IDs survive navigation between Closet and My Outfits.
- Synced My Outfits create-form fields directly with stored draft data to prevent losing in-progress outfit details while adding items.
- Kept draft item IDs filtered to available closet items when loading persisted drafts, preventing stale references after item deletes.

## v1.0.9 - 2026-05-04

- Refreshed the root `README.md`, `wiki.md`, and `PROJECT_INDEX.md` so the repository-level documentation matches the Milestone 1 app state.
- Rewrote `back-end/README.md` to document current auth flows, outfits endpoints, image-clean routes, and seeded demo data.
- Rewrote `front-end/README.md` to document the current signed-in closet flow, admin-only routes, outfits page, and frontend 404 behavior.

## v1.0.8 - 2026-05-04

- Added visible auth feedback for failed Google sign-in attempts and successful logout on the frontend landing flow.
- Added a dedicated frontend 404 state for unknown SPA routes instead of falling back to the closet page.
- Fixed outfit item tag labels to read from the current array-based tag model and removed duplicate env-loader logic from `start.sh`.

## v1.0.7 - 2026-05-04

- Updated Google sign-in to reuse an existing seeded user when the Google account email already exists in the database.
- Preserved seeded admin access by attaching the real Google UID to the existing user record instead of creating a duplicate account.
- Added regression test coverage for same-email and case-insensitive Google sign-in reuse.

## v1.0.6 - 2026-05-04

- Simplified demo seed data so the database now creates the real Northwestern admin account instead of additional Google users you cannot sign into locally.
- Seeded `annabelgoldman2025@u.northwestern.edu` with admin access and a 20-item demo closet.
- Removed extra seeded demo users so the development data better matches the team’s actual login flow.

## v1.0.5 - 2026-05-04

- Fixed the manual add-item back button so it consistently returns users to the closet page.
- Restricted users-directory navigation to admin users by adding an admin-only `Users` header button and removing non-admin UI paths into `/users`.
- Preserved the existing route-level authorization while making the UI navigation match the intended access rules more closely.

## v1.0.4 - 2026-05-04

- Merged the tag-based closet search and relaxed item schema work with the new outfits and lookbook experience from `main`.
- Preserved the polished closet filter bar updates alongside the My Outfits page, outfit draft persistence, and outfits CRUD support.
- Synced the branch to the current Milestone 1 codebase and tagged the combined release head.

## v1.0.3 - 2026-05-04

- Reworked clothing item metadata into a relaxed tag-based schema for create, edit, seed, and API payload flows.
- Added closet search, tag filtering, and sort controls aligned with the new tag-driven item model.
- Polished the closet filter bar layout so the search field and dropdown controls feel cleaner and more consistent.

## v1.0.2 - 2026-05-03

- Fixed deployed routing so browser visits to `/users` and `/users/:id` render the frontend app instead of raw JSON responses.
- Preserved JSON authorization behavior for API requests while restoring correct SPA fallback behavior for HTML requests.
- Added full outfits support across back-end and front-end, including outfit CRUD endpoints, user-scoped authorization, and outfit-to-item associations.
- Introduced new data models and schema updates for outfits and outfit items, including ownership validation and uniqueness constraints.
- Added the My Outfits experience with create/edit/delete flows and outfit item grouping from closet pieces.
- Added persistent outfit draft behavior so selected item IDs are saved per user and restored from local storage.
- Added and refined flash/toast notifications for outfit load/save/update/delete outcomes and draft confirmations.
- Added automated test coverage for outfit flows and validations, including integration tests and model tests for Outfit and OutfitItem.

## v1.0.1 - 2026-05-03

- Refined unauthorized user flows for admin-only pages and protected routes.
- Prevented unauthorized users from briefly seeing restricted page content before redirecting or showing an access-restricted view.
- Simplified the logged-out landing page shell and polished header/footer copy.

## v1.0.0 - 2026-05-03

- Milestone 1 MVP release for Closet Organizer.
- Added Google-authenticated access to the closet experience.
- Restricted the users directory to admin users only.
- Improved the shared app shell, logged-out route protection, and landing-page authorization messaging.
