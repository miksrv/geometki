---
name: Geometki project context
description: Core technical and SEO context for the Geometki platform — stack, locale setup, key patterns
type: project
---

Geometki (https://geometki.com) is a Russian-language crowdsourced platform for discovering interesting places (геометки) across Russia. The live site is in production.

**Why:** SEO audit requested to reach Top 10 on Yandex and Google.

**Stack:** Next.js 16, React 19, TypeScript, next-i18next (ru default, en secondary via /en/ prefix), next-seo ^6.8.0, Redux Toolkit, Leaflet for maps, schema-dts for schema typing.

**Key patterns:**
- All pages use `getServerSideProps` (no SSG) — fully server-rendered for bots
- Canonical URLs built from `NEXT_PUBLIC_SITE_LINK` env var (defaults to localhost in .env — production must override this)
- i18n: RU is default locale (no prefix), EN uses `/en/` prefix
- Analytics: Yandex.Metrika counter 96500810, Google Analytics G-JTW79QN3MM — both injected via dangerouslySetInnerHTML in _app.tsx

**URL structure:** Place pages use numeric IDs: `/places/[id]` — no slugs exist yet.

**Structured data in use:** LocalBusiness (places), Person (users), BreadcrumbList (places, places list, users), ProfilePage (user pages).

**How to apply:** Use this context when making any SEO recommendations or implementation tasks for this project.
