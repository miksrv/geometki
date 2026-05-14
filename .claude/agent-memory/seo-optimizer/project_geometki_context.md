---
name: project-geometki-context
description: Core tech stack, URL patterns, analytics IDs, i18n setup, schema types in use, and SEO infrastructure for Geometki
metadata:
  type: project
---

Geometki (https://geometki.com) is a Russian-primary geospatial POI sharing platform for discovering interesting places. Live in production.

**Why:** SEO audit requested to rank Top 10 on Yandex and Google.

**Stack:** Next.js 16/React 19/TypeScript 5, next-i18next (ru default `/`, en via `/en/`), next-seo ^7.2.0 using `generateNextSeo()` helper, Redux Toolkit + RTK Query, Leaflet (ssr:false), schema-dts for JSON-LD types.

**Key patterns:**
- All pages use `getServerSideProps` — fully server-rendered for bots
- Canonical URLs built from `NEXT_PUBLIC_SITE_LINK` env var
- Analytics: Yandex.Metrika 96500810, Google Analytics G-JTW79QN3MM (via next/script `afterInteractive`)
- `buildHreflangTags()` helper in `client/utils/seo.ts` — implemented and used on most main pages
- Custom `PlaceSchema()` and `UserSchema()` helpers in `client/utils/schema.ts`

**URL structure:** Place pages use numeric IDs `/places/[id]` — no human-readable slugs.

**Structured data in use:** Organization (homepage), LocalBusiness/TouristAttraction (place detail), BreadcrumbList (place detail, places listing, user profile), ProfilePage+Person (user profile). PlaceSchema also emitted on homepage and places listing but without canonicalUrl param → `url` field is undefined in those schema blocks.

**Noindex pages (correct):** /auth, /unsubscribe, /places/create, /places/[id]/edit, /users/settings, all /admin/* pages, 404.

**Pages missing hreflang:** /users/[id]/places, /users/[id]/visited, /users/[id]/bookmarks, /users/[id]/photos, /users/[id]/achievements

**How to apply:** Use this as baseline before making any SEO recommendations. Do not recommend things already implemented (hreflang on main pages, canonical tags, structured data on main pages).
