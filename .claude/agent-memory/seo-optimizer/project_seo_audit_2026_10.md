---
name: project-seo-audit-2026-10
description: Full SEO audit of Geometki re-run 2026-10-06; supersedes seo-audit-2026-05 (that file's issues are now mostly fixed, see below)
metadata:
  type: project
---

Full re-audit conducted 2026-10-06, including live curl checks against
https://geometki.com and https://api.geometki.com. Full report written to
`/tmp/geometki-seo-audit.md` (ephemeral — regenerate on next audit rather
than assuming it still exists).

**Why:** Owner wants a fresh technical SEO / organic-growth audit, with
emphasis on programmatic-SEO opportunities given the site's geo-content
volume.

**Fixed since [[project-seo-audit-2026-05]] (do not re-flag):** `_document.tsx`
now exists with dynamic `<html lang>`; `PlaceSchema()` now gets
`canonicalUrl` on homepage/listing; `/tags` added to sitemap static pages;
sitemap `lastmod` now a fixed constant instead of `new Date()`; all `/users/
[id]/*` sub-pages now have hreflang; homepage EN canonical trailing-slash
bug fixed; `maximum-scale=1` viewport restriction removed; robots.txt now
blocks `/admin` and `/search`; `WebSite`+`SearchAction` schema added to
homepage; locale-flicker blank render in `_app.tsx` is gone.

**New critical finding — production sitemap ships zero place/user pages:**
`https://geometki.com/sitemap.xml` live contains only the 11 static URLs,
no place or user detail pages at all. Root cause:
`server/app/Config/Routes.php` has the `Sitemap::index` route accidentally
grouped under `$routes->group('visited', ...)` at line 222-223, colliding
with the real "visited places" route group also named `'visited'` at line
210. `curl https://api.geometki.com/sitemap` → 404; `curl .../visited` →
hits the wrong (auth) endpoint. Client (`client/pages/sitemap.tsx`) silently
falls back to empty arrays when the API call fails, so the sitemap "works"
but is empty of dynamic content. This is a one-line fix (rename the group to
`'sitemap'`) with outsized impact — likely the single biggest organic-traffic
lever available right now. Re-check `curl https://api.geometki.com/sitemap`
after any future fix to confirm it returns `{places:[...], users:[...]}`.

**Still unresolved / newly flagged as of 2026-10-06:**
- `/tags` page (`client/pages/tags.tsx`) still has no `og:image`, and its
  meta description is a naive `.join(', ').substring(0, 180)` of tag titles
  — same issue noted in the May audit, not yet fixed.
- No `rel="prev"`/`rel="next"` link tags anywhere on paginated listings
  (`places/index.tsx`, `users/index.tsx`).
- No image-sitemap entries (`<image:image>`) despite place pages having
  cover + gallery photos — can't be fixed meaningfully until the sitemap
  route bug above is fixed first.
- `client/pages/users/[id]/index.tsx:108` sets the main user profile page
  to `noindex: true` unconditionally — worth a deliberate decision (index
  profiles above a content threshold) rather than leaving it blanket-blocked;
  this wasn't on the May list, may be a recent/deliberate change — ask before
  "fixing".

**Programmatic SEO opportunities (biggest remaining lever, not previously
captured in memory):**
- Places have **no slug field at all** — `server/app/Database/Migrations/2023-05-25-164800_AddPlaces.php`
  has no `slug` column; URLs are `/places/{numericId}` only
  (`client/pages/places/[id]/index.tsx`). No slug support anywhere in
  categories/regions either. Adding slugs (`/places/{slug}-{id}`) is an L
  effort (migration + redirects + routing + sitemap/canonical updates) but
  meaningfully helps CTR and Yandex relevance signals.
- `client/pages/places/index.tsx` already has the right bones for city/
  region/category landing pages: indexable canonical + `ItemList` schema per
  category/region/tag combo (lines ~71-92, ~268-282), and the
  region/locality/district taxonomy already exists server-side
  (`server/app/Database/Migrations/2023-05-18-020436_AddLocationRegions.php`).
  What's missing is dedicated landing templates with unique intro copy/H1
  per city×category combination instead of a generic filtered listing view.
  This is the standard high-ROI programmatic-SEO play for a geo-POI site and
  the data model is already there — just needs content templates and
  (ideally) pretty URLs from the slug work above.

**Data-completeness question raised, not resolvable from code alone:**
Place content is stored per-locale (`places_content` table, `locale` ENUM
`ru`/`en`, separate title/content columns —
`server/app/Database/Migrations/2023-08-29-181638_AddPlacesContent.php`,
and `Places.php` controller is locale-aware throughout). Could not verify
from the repo what fraction of places actually have a filled `en` row. If
most places only have `ru` content, `/en/places/{id}` pages are
English-chrome-around-Russian-text — a duplicate/thin-content risk on
google.com for English queries and a misleading hreflang pairing. Recommend
a direct DB check (`SELECT COUNT(*) FROM places_content WHERE locale='en'`
vs. total places) before investing further in EN-locale SEO work.

**How to apply:** Check this list (and [[project-seo-audit-2026-05]] for
full history) before re-auditing already-confirmed-fixed items. Treat the
sitemap route bug as the top-priority item in any future SEO/dev work for
this project — it is a pure bug, not a judgment call, and should be
surfaced proactively even outside an explicit audit request.
