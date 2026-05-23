# Changelog

## Unreleased

- Added a configurable post-removal sharpen step to AI-cleaned transparent PNG outputs so item edges render a bit crisper after background removal.
- Added automated saved-outfit collage contract coverage for backend round-trips and frontend layout math so saved cards, the editor preview, and resize-ratio fallback stay aligned.
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
