---
name: project-geometki-context
description: Core SEO stack, URL patterns, analytics IDs, schema helpers and conventions for Geometki
metadata:
  type: project
---

Geometki (https://geometki.com) is a Russian-primary geospatial POI sharing platform. Live in production.

**Why:** owner wants Top 10 on Yandex and Google.

**Stack:** Next.js 16 Pages Router / React 19, next-i18next (ru default `/`, en at `/en/`), next-seo v7 via `generateNextSeo()` from `next-seo/pages` inside `<Head>` and `JsonLdScript` from `next-seo`, RTK Query SSR, Leaflet (ssr:false), schema-dts for JSON-LD types. Do not suggest switching SEO libraries.

**Key patterns:**
- Pages use `getServerSideProps` — fully server-rendered for bots
- Canonical URLs from `NEXT_PUBLIC_SITE_LINK`; hreflang via `buildHreflangTags()` in `client/utils/seo.ts`
- JSON-LD helpers `PlaceSchema()` / `UserSchema()` in `client/utils/schema.ts`
- Sitemap: `client/pages/sitemap.tsx`, data from the API `GET /sitemap`
- Analytics: Yandex.Metrika 96500810, Google Analytics G-JTW79QN3MM (next/script in `_app.tsx`)
- robots.txt disallows /auth, /unsubscribe, /places/create, /places/*/edit, /places/landing, /users/settings, /admin, /search

**URLs:** places are `/places/{id}-{slug}` (`buildPlaceUrl` in `client/utils/place.ts`, bare id still resolves). Category / location / location×category landings `/places/{category}`, `/places/{location}`, `/places/{location}/{category}` exist behind `NEXT_PUBLIC_LANDING_*` flags (features/20-location-seo-pages.md, `client/utils/placesLanding.ts`). `/places` with geo or multi-category filters is noindex; collections are noindex unless `indexable` (and always on /en).

**How to apply:** use as the baseline before any SEO recommendation; don't recommend what is already implemented.
