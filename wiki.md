# Curated Closet Wiki

## Project Purpose

Curated Closet helps users keep track of wardrobe items in one place and turn that data into reusable outfit decisions. The app focuses on capturing clothing items, organizing them with lightweight metadata, and turning uploaded outfit photos into reusable closet records.

## Problem Statement

Closet information is often spread across memory, notes, screenshots, and shopping receipts. This project provides a single system to:

- record clothing items with lightweight tag-based metadata
- associate every record with the authenticated user
- manage closet photos and cleaner presentation images
- reuse closet items in saved outfits
- extract visible pieces from an outfit photo and convert them into closet records

## Image and visual sources

When the team adds stock photography, use royalty-free sources such as:

- [Unsplash](https://unsplash.com/)
- [Pixabay](https://pixabay.com/)
- [RGBStock](https://www.rgbstock.com/images/)

Record the file path, photographer, and source URL in this section.

Icons use [Lucide](https://lucide.dev/) (MIT). The app logo is `front-end/public/brand-mark.png`. UI primitives include [shadcn/ui](https://ui.shadcn.com/) (MIT); see `front-end/ATTRIBUTIONS.md`.

## Visual improvements (Kailyn Mohammed)

1. **Custom error and empty states** — shared `VisualStatePanel` with Lucide icons for 404, 403 (access restricted), and closet empty states. For **new users with an empty closet** (no items and no active filters), the closet page now shows **“Start with your first piece”** with an **Add Item** menu (detect from image or add manually). Previously, an empty closet used the same **“No matching items found”** copy as a filtered search with no results. **“No matching items found”** is reserved for when filters or search are active but nothing matches.
2. **Shared header and footer** — `SiteHeader` and `SiteFooter` components used across authenticated pages and the signed-out landing flow.
3. **Home landing** — refactored signed-out home into `HomeLanding` (brand mark, sign-in, consistent layout).
