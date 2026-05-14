---
name: seo-audit-2026-05
description: Full SEO audit of Geometki re-run 2026-05-13; prior audit was March 2026 (ROADMAP-SEO.md no longer exists)
metadata:
  type: project
---

Full re-audit conducted 2026-05-13. ROADMAP-SEO.md from March 2026 no longer exists. Prior issues that are now FIXED include: analytics now uses next/script (not dangerouslySetInnerHTML), hreflang tags implemented via buildHreflangTags() on main pages, Twitter Card tags added on all pages.

**Still unresolved / new issues found as of 2026-05-13:**

CRITICAL:
- Sitemap (/pages/sitemap.tsx line 25): /tags page missing from staticPages list
- Sitemap: /users/[id] sub-pages (places, visited, bookmarks, photos, achievements) not in sitemap
- Locale flicker in _app.tsx (lines 72-85): googlebot sees a blank div during the isLocaleReady:false render phase — renders `<div style={{ minHeight: '100vh' }} />` with no content or meta tags
- PlaceSchema called without canonicalUrl on homepage (index.tsx line 93) and places listing (places/index.tsx line 253) — schema url field is undefined for all items

HIGH:
- No _document.tsx — html lang attribute not explicitly set (Next.js i18n sets it but no custom Document to control it)
- Viewport: maximum-scale=1 blocks user zoom (accessibility signal; Google downranks pages that block zoom)
- Homepage canonical bug (index.tsx line 29): EN canonical = SITE_LINK + 'en' (no trailing slash) but all other pages use SITE_LINK + 'en/'
- User sub-pages /users/[id]/places, /visited, /bookmarks, /photos, /achievements missing hreflang tags
- Meta description on places listing (places/index.tsx line 224): truncated at 220 chars from a joined title list — not keyword-optimized, highly variable

MEDIUM:
- No WebSite schema with SearchAction on homepage (site has search functionality)
- No FAQ or HowTo schema anywhere — missed featured snippet opportunities
- Sitemap uses new Date().toISOString() for static pages (always today's date) — waste of crawl budget signal
- Place detail: meta description truncated at 300 chars from raw content (can include line breaks from markdown remnants)
- No og:image on tags page (/pages/tags.tsx)
- User sub-pages have no hreflang link tags
- Description on user profile pages is just "{name} - {t('user-profile')}" — not useful content
- robots.txt: /admin/* not explicitly blocked (admin pages are noindexed but not blocked from crawling)

LOW:
- No sitemap index file — single sitemap will scale poorly as places/users grow
- Missing x-robots-tag HTTP headers as backup to meta robots
- No breadcrumb structured data on users sub-pages (visited, places, bookmarks)
- Level images in /users/levels use empty alt text (alt='')
- site.webmanifest has no `start_url` field
- Users listing description (users/index.tsx line 70) truncated at 220 chars from user names — not useful for SEO

**How to apply:** When implementing fixes, prioritize in the CRITICAL > HIGH > MEDIUM > LOW order above. Check this list to avoid re-auditing already confirmed issues.
