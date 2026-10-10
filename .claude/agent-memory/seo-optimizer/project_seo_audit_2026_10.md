---
name: project-seo-audit-2026-10
description: Open items from the 2026-10-06 SEO audit (older audits' issues are fixed)
metadata:
  type: project
---

Audit of 2026-10-06 (live curl checks against geometki.com / api.geometki.com). Re-checked 2026-10-10.

**Fixed since, do not re-flag:** `_document.tsx` with dynamic `<html lang>`; `PlaceSchema` gets `canonicalUrl`; fixed sitemap `lastmod`; hreflang on `/users/[id]/*`; homepage EN canonical slash; `maximum-scale=1` removed; robots.txt blocks /admin and /search; `WebSite`+`SearchAction` on homepage; no locale-flicker blank render; Analytics via next/script; Twitter cards. The `Sitemap::index` route is now in its own `sitemap` group (was wrongly under `visited`) — after deploys, confirm `curl https://api.geometki.com/sitemap` returns places/users. Place slugs and the landing pages were implemented (see project_geometki_context.md). The `/tags` and `/categories` pages were removed.

**Still open:**
- No `rel="prev"`/`rel="next"` on paginated listings.
- No image-sitemap entries (`<image:image>`) for place covers/galleries.
- `client/pages/users/[id]/index.tsx` sets the user profile to `noindex: true` unconditionally — a deliberate decision is pending (index profiles above a content threshold?); ask before changing.
- `site.webmanifest` has no `start_url`; user profile and users listing descriptions are boilerplate.
- EN content completeness unknown: if most places have only `ru` content in `places_content`, `/en/places/…` is thin/duplicate content. Needs a DB check (`SELECT COUNT(*) FROM places_content WHERE locale='en'` vs total) before investing in EN SEO.

**How to apply:** check this list before re-auditing; re-verify an item against the code before reporting it.
