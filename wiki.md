# Project Closet Organizer Wiki

## Project Purpose

Project Closet Organizer helps users keep track of wardrobe items in one place and turn that data into reusable outfit decisions. The Milestone 1 version focuses on a complete happy path: a new user can sign in, manage closet items, build saved outfits, and import pieces from an uploaded outfit photo.

## Problem Statement

Closet information is often spread across memory, notes, screenshots, and shopping receipts. This project provides a single system to:

- record clothing items with lightweight tag-based metadata
- associate every record with the authenticated user
- manage closet photos and cleaner presentation images
- reuse closet items in saved outfits
- extract visible pieces from an outfit photo and convert them into closet records

## Current Scope (Milestone 1)

- Google authentication with session-backed login/logout
- protected user-specific closet data
- admin-only user directory routes
- clothing item CRUD with photo upload and AI-cleaned image support
- saved outfits built from owned clothing items
- outfit upload and detection review flow
- search, filter, and sort on the primary closet page
- empty, unauthorized, validation, and not-found states across the main UI

## Current Implementation Notes

- The backend lives in `back-end/` and serves JSON by default.
- The frontend uses a lightweight custom router split between `front-end/src/app/App.tsx` and `front-end/src/app/lib/routes.ts`.
- Frontend shared request helpers, page-loading hooks, closet filters, and outfit-draft persistence are factored into focused modules under `front-end/src/app/lib/`.
- `/users` and `/users/:id` HTML requests fall back to the SPA shell, while JSON requests still enforce backend authorization.
- Closet records are scoped to `current_user`; non-admin users cannot read or mutate other users' data.
- Outfit detection and clean-image generation are powered by OpenRouter-backed service objects in the backend.
- Backend API response shaping is centralized in `back-end/app/presenters/api_payloads.rb`.
- Backend crop/image flows use shared tempfile and prepared-image helpers to reduce duplication across controllers and services.
- Active Storage manages uploaded source images and generated cleaned images.

## Demo Data

- `db/seeds.rb` creates one Google-backed admin demo user.
- The seeded admin account is `annabelgoldman2025@u.northwestern.edu`.
- The seed closet contains 20 realistic wardrobe items with varied tags and purchase dates.

## Object-Oriented Design Board

Miro board link:

- https://miro.com/app/board/uXjVGhqlLR8=/

## Future Features (Post-MVP)

- recommendation hints based on closet composition or preferred style
- weather-aware outfit suggestions
- item wear history and rotation tracking
- export/import for closet data
- richer admin and social discovery flows
- better code-splitting and frontend performance tuning

## Similar Products And References

- [Stylebook](https://www.stylebookapp.com/)
- [Acloset](https://www.acloset.app/)
- [Whering](https://whering.co.uk/)

## Working Notes

- Backend and frontend are maintained in one monorepo.
- The active Rails backend lives in `back-end/`; the old duplicate root Rails scaffold was removed earlier in the project.
- CI currently validates the Rails app only.
- The frontend recently went through a cleanup pass that split routing, API helpers, draft persistence, and create-item review UI into smaller modules.
- The backend recently went through a cleanup pass that moved JSON payload shaping into presenters and unified tempfile/image-source handling for AI cleanup flows.
- Deployment target for the course assignment is Heroku.
