---
name: SEO audit March 2026 — completed
description: Full SEO audit of Geometki completed 2026-03-15, findings written to ROADMAP-SEO.md
type: project
---

Full SEO audit completed 2026-03-15. 46 numbered findings written to `/Users/mik/Projects/geometki/ROADMAP-SEO.md`.

**Critical issues found (fix first):**
1. Sitemap bug: usersPages reads from data?.places instead of data?.users (line 31 sitemap.tsx)
2. Sitemap missing: homepage, /tags, hreflang annotations
3. No hreflang link tags on any page (confirmed live)
4. Analytics scripts use dangerouslySetInnerHTML instead of next/script
5. Viewport has maximum-scale=1 (accessibility + ranking issue)
6. Index page canonical: 'en' missing trailing slash vs 'en/' on other pages

**Key structural gaps:**
- No _document.tsx file exists (lang attribute not explicitly set)
- No DefaultSeo or titleTemplate in _app.tsx
- No Twitter Card tags on any page
- No WebSite schema with SearchAction
- No Yandex Webmaster verification
- OG images use relative paths (should be absolute)

**Why:** These findings represent the baseline state before any SEO work begins. Use this to track what has been fixed in future conversations.

**How to apply:** When user asks about SEO fixes, check this against ROADMAP-SEO.md to understand what was audited and what may have changed.
