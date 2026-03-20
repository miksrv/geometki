# Client SEO Roadmap

> Auto-generated SEO audit — 2026-03-20. Each task is self-contained and actionable by an AI agent.

## Summary

The audit covered all 20 page files in `pages/`, the `utils/schema.ts` structured-data helpers, the `AppLayout` / `Header` shared components, `next.config.js`, `next-i18next.config.js`, `public/robots.txt`, `pages/sitemap.tsx`, and every shared component that renders images or links. The site uses `next-seo` (via `<NextSeo />`) consistently across all indexable pages, and `getServerSideProps` is present everywhere — both are strong foundations. The most critical gaps are: (1) a copy-paste bug in `sitemap.tsx` that emits **user URLs that map to places rather than users**, (2) Open Graph images on three static pages that use **relative URLs** (rejected by most social crawlers), (3) **no Twitter Card tags anywhere**, (4) **no `hreflang` link tags** for the ru/en locale pair, (5) the `PlaceSchema` and `UserSchema` utilities are missing `author`, `datePublished`, and `dateModified` fields that are commented out, and (6) the `canonical` URL for paginated sub-pages (user photos, user places, user bookmarks) ignores the current page number, producing duplicate canonicals across all paginated pages. Medium-priority issues include empty `title` attributes on several links (penalises accessibility and is visible to crawlers), missing `Organization` schema on the homepage, weak description on the tags page, and the activity-feed on the homepage using a client-side infinite-scroll that prevents crawlers from reading past the first page of items.

---

## Tasks

### SEO-1: Fix sitemap user-URL generation — users section maps places, not users

**Priority:** High
**Affected files:** `pages/sitemap.tsx`
**Description:**
On line 32 of `sitemap.tsx` the `usersPages` array is built by iterating over `data?.places` instead of `data?.users`. This means every URL emitted under the users section is `/users/{placeId}` (a place's numeric ID) rather than a real user profile URL. Additionally, `user.updated.date` is accessed but the objects being iterated are `Place` shapes, so the field may be absent or wrong. Fix by changing `data?.places?.map((user) => …)` to `data?.users?.map((user) => …)` and verify that the `SitemapGetList` API response actually includes a `users` array; if not, add that endpoint on the server side and update `api/api.ts` accordingly.

---

### SEO-2: Open Graph `og:image` URLs are relative — social crawlers will reject them

**Priority:** High
**Affected files:** `pages/index.tsx`, `pages/map.tsx`, `pages/categories.tsx`
**Description:**
The `openGraph.images[].url` values for the three static pages (`'/images/pages/main.jpg'`, `'/images/pages/map.jpg'`, `'/images/pages/categories.jpg'`) are relative paths. The Open Graph specification requires absolute URLs; Facebook, Twitter, and Slack scrapers will silently ignore relative values and render the share card without an image. Fix each by prepending the absolute site origin, e.g. change `url: '/images/pages/main.jpg'` to `url: \`${SITE_LINK}images/pages/main.jpg\``(where`SITE_LINK`is already imported from`@/config/env`in all three files). Apply the same fix to`pages/categories.tsx`and`pages/map.tsx`.

---

### SEO-4: No `hreflang` alternate link tags for the ru/en locale pair

**Priority:** High
**Affected files:** `pages/_app.tsx`, `pages/index.tsx`, `pages/places.tsx`, `pages/places/[id]/index.tsx`, `pages/users/[id]/index.tsx`, `pages/map.tsx`, `pages/categories.tsx`, `pages/tags.tsx`, `pages/users.tsx`, `pages/users/levels.tsx`
**Description:**
The site serves Russian (default, `/`) and English (`/en/`) versions of all pages but emits no `<link rel="alternate" hreflang="…">` tags. Search engines use these to determine which locale to show users and to avoid treating the two language versions as duplicate content. The canonical URL for the Russian version is `SITE_LINK + path` and for English is `SITE_LINK + 'en/' + path`. Using `next-seo`'s `additionalLinkTags` or `languageAlternates` prop, add two entries per page: `{ rel: 'alternate', hrefLang: 'ru', href: ruUrl }` and `{ rel: 'alternate', hrefLang: 'en', href: enUrl }`. An `x-default` entry pointing to the Russian URL is also recommended. A single helper function `buildHreflangTags(path, i18n.language)` should be created in `utils/seo.ts` to avoid repetition across pages.

---

### SEO-5: `PlaceSchema` and `UserSchema` have `author`, `datePublished`, and `dateModified` commented out

**Priority:** High
**Affected files:** `utils/schema.ts`, `pages/places/[id]/index.tsx`
**Description:**
In `utils/schema.ts` the `author`, `dateModified`, and `datePublished` fields of `PlaceSchema` are commented out with a note that `canonicalUrl` is unavailable inside the utility. Similarly in `pages/places/[id]/index.tsx` the `placeSchema` memo has the same three fields commented out. These fields are important for Google's `LocalBusiness` and `Article` rich results. Fix by accepting an optional `canonicalUrl` parameter in `PlaceSchema(place, canonicalUrl?)` and passing it from the page. Uncomment the `author`, `dateModified`, and `datePublished` fields in both `utils/schema.ts` and the inline schema in `pages/places/[id]/index.tsx`. The `formatDateISO` utility already exists in `utils/helpers.ts` and can be used directly.

---

### SEO-6: Paginated canonical URLs on user sub-pages ignore the page number

**Priority:** High
**Affected files:** `pages/users/[id]/photos.tsx`, `pages/users/[id]/places.tsx`, `pages/users/[id]/bookmarks.tsx`
**Description:**
All three user sub-page variants set their `canonical` prop to `${canonicalUrl}users/${id}/photos` (or `/places` / `/bookmarks`) without appending `?page=${currentPage}` for pages 2 and beyond. This means every paginated page declares the same canonical as page 1, which instructs search engines to consolidate all paginated pages into one and discard the additional content. Fix by computing the canonical as: `` `${canonicalUrl}users/${id}/photos${currentPage > 1 ? '?page=' + currentPage : ''}` `` (and equivalently for places and bookmarks). The same pattern is already correctly applied on `pages/users.tsx` and `pages/places.tsx`.

---

### SEO-7: `LocalBusiness` schema is missing the required `url` field

**Priority:** High
**Affected files:** `utils/schema.ts`, `pages/places/[id]/index.tsx`
**Description:**
Both the shared `PlaceSchema` utility and the inline `placeSchema` memo in `pages/places/[id]/index.tsx` produce a `LocalBusiness` JSON-LD object without a `url` field. According to Google's guidelines for `LocalBusiness`, the `url` property pointing to the canonical page is strongly recommended and improves eligibility for rich results. After fixing SEO-5 to accept `canonicalUrl`, also add `url: \`${canonicalUrl}places/${place.id}\`` to both schema outputs.

---

### SEO-8: `InteractionCounter` in place schema is missing the required `interactionType` field

**Priority:** High
**Affected files:** `utils/schema.ts`, `pages/places/[id]/index.tsx`
**Description:**
Both the `PlaceSchema` utility and the inline `placeSchema` in the place detail page include an `interactionStatistic` block but omit the mandatory `interactionType` property. Without it the `InteractionCounter` schema is invalid and will fail Google's Rich Results Test. Add `interactionType: 'https://schema.org/ViewAction'` to both occurrences of the `interactionStatistic` object.

---

### SEO-9: Homepage `og:type` is `'website'` but uses `article`-specific OG fields

**Priority:** Medium
**Affected files:** `pages/places.tsx`
**Description:**
`pages/places.tsx` sets `openGraph.type` to `'http://ogp.me/ns/article#'` (a non-standard type string; the correct value is just `'article'`) while simultaneously omitting the `article.publishedTime` and `article.modifiedTime` fields. Social platforms that parse the type will expect article metadata which is absent. Either change the type to `'website'` (consistent with a listing page) and remove the partial `article` fields, or populate a proper `article` object. The namespace URI form is incorrect; the correct `next-seo` value for an article type is the string `'article'`.

---

### SEO-10: `Organization` / `WebSite` schema absent on homepage

**Priority:** Medium
**Affected files:** `pages/index.tsx`
**Description:**
The homepage already injects `PlaceSchema` and `UserSchema` JSON-LD blobs but has no `Organization` or `WebSite` schema. Google uses `Organization` schema (with `name`, `url`, `logo`, `sameAs`) to power the Knowledge Panel and to associate the domain with the brand. Add an `Organization` block in the `<Head>` of `pages/index.tsx` with at minimum `name: 'Geometki'`, `url: SITE_LINK`, `logo: \`${SITE_LINK}android-chrome-512x512.png\``(which already exists in`public/`). A `WebSite`schema with`potentialAction: SearchAction` would also enable Google Sitelinks Search Box for this domain.

---

### SEO-11: `BreadcrumbList` final item missing `item` (URL) field

**Priority:** Medium
**Affected files:** `pages/places/[id]/index.tsx`, `pages/places.tsx`, `pages/users/[id]/index.tsx`
**Description:**
In all three pages, the last entry in the `BreadcrumbList` `itemListElement` array is defined with only `@type`, `name`, and `position` — the `item` field (the URL) is absent. Google's schema documentation states that the last breadcrumb's `item` field is optional but recommends including it for completeness. More importantly, intermediate breadcrumb entries in `pages/places.tsx` use `canonicalUrl + link.link` where `link.link` starts with `/`, so the resulting URL has a double slash (`https://geometki.com//places`). Fix by stripping the leading slash from `link.link` before concatenation, or by using `new URL(link.link, canonicalUrl).href` for robust joining.

---

### SEO-12: Tags page description is a raw comma-joined list of all tags with no sentence context

**Priority:** Medium
**Affected files:** `pages/tags.tsx`
**Description:**
The `description` prop on the Tags page is constructed as `tagsList?.map(({ title }) => title)?.join(',')?.substring(0, 220)` — a plain comma-separated dump of tag names with no introductory phrase. This provides poor snippet quality in search results. Prefix the list with a meaningful sentence, e.g. `` `${t('features-of-places')}: ${tagsList.map(({title}) => title).join(', ').substring(0, 180)}` ``. Also note the page currently has no `openGraph` block at all, so no `og:title` or `og:description` will be emitted; add a minimal `openGraph` prop reusing the title and description.

---

### SEO-13: Users list page has no `openGraph` block

**Priority:** Medium
**Affected files:** `pages/users.tsx`
**Description:**
`pages/users.tsx` sets `<NextSeo title>`, `description`, and `canonical` but passes no `openGraph` prop. This means no `og:title`, `og:description`, `og:type`, or `og:url` meta tags are rendered, so sharing the users index URL on social platforms will produce a bare link with no preview card. Add an `openGraph` object reusing `title`, the `description` already computed, and `type: 'website'`, `url: canonicalUrl + 'users'`.

---

### SEO-14: `users/levels` page has no `openGraph` block

**Priority:** Medium
**Affected files:** `pages/users/levels.tsx`
**Description:**
Same issue as SEO-13: `pages/users/levels.tsx` only sets `title`, `canonical`, and `description` in `<NextSeo>` without an `openGraph` prop. Add a minimal `openGraph` block with `type: 'website'`, `siteName: t('geotags')`, `title: t('user-levels')`, `description: t('user-levels-description-1')`, and `url: \`${canonicalUrl}users/levels\``.

---

### SEO-15: User sub-pages (`/photos`, `/places`, `/bookmarks`) have no `openGraph` block

**Priority:** Medium
**Affected files:** `pages/users/[id]/photos.tsx`, `pages/users/[id]/places.tsx`, `pages/users/[id]/bookmarks.tsx`
**Description:**
All three user sub-pages define a `<NextSeo>` with `title`, `description`, and `canonical` but no `openGraph` prop. The photos page in particular could include actual photo thumbnails in `openGraph.images`. Add `openGraph` to each: for photos, reuse `photosList?.slice(0, 3).map(…)` as images (same pattern as `users/[id]/index.tsx`); for places and bookmarks use `type: 'website'` with no images. Include `siteName`, `url`, `title`, and `description` in all three.

---

### SEO-16: Place cover image displayed as CSS `background-image`, invisible to crawlers

**Priority:** Medium
**Affected files:** `sections/place/place-header/PlaceHeader.tsx`
**Description:**
The hero cover image for each place is rendered as a CSS `background-image` in two `<div>` elements (`.desktop` and `.mobile` variants) rather than as a semantic `<img>` or Next.js `<Image>`. Search engines cannot index background images: the cover image — the most prominent visual asset of a place — is therefore invisible to Google Images. Replace the `<div style={{ backgroundImage: ... }}>` pattern with a Next.js `<Image>` component with appropriate `alt={place.title}`, `priority`, and `fill` layout so the image participates in image indexing. Use CSS to achieve the same cover/crop effect via `objectFit="cover"` on the `<Image>`.

---

### SEO-17: Category icon `<Image>` on `PlacesListItem` has empty `alt` attribute

**Priority:** Medium
**Affected files:** `components/shared/places-list/PlacesListItem.tsx`
**Description:**
The category icon image (line 27) uses `alt={''}`. While decorative images can legitimately use empty `alt`, this icon communicates meaningful semantic information — the category of the place (e.g., "cave", "castle", "waterfall") — which aids accessibility and can provide context to crawlers. Change the `alt` to the category name: `alt={place.category?.title || ''}` using the API model's human-readable `title` field rather than the internal `name` key.

---

### SEO-18: Logo `<Link>` and several other navigation links have empty `title` attributes

**Priority:** Medium
**Affected files:** `components/layout/app-bar/Logo.tsx`, `sections/user/user-header/UserHeader.tsx`, `components/layout/footer/Footer.tsx`, `sections/place/place-description/PlaceDescription.tsx`
**Description:**
Multiple `<Link>` and `<a>` elements pass `title={''}` explicitly. An empty string title is slightly worse than omitting the attribute altogether: it renders a blank tooltip and provides no additional semantic value. For the Logo link, replace with `title={t('geotags')}` (the site name) or remove the attribute. For the user-level link in `UserHeader` (line 78), set `title={user?.levelData?.title}`. For the footer copyright link (Footer.tsx line 18), set `title={'MikSoft'}` or remove. Remove the empty `title` from tag links in `PlaceDescription.tsx` (line 157) or set it to `\`#${tag}\``.

---

### SEO-19: No `charset` meta tag in global `<Head>`

**Priority:** Medium
**Affected files:** `pages/_app.tsx`
**Description:**
The global `<Head>` in `_app.tsx` sets `viewport`, `theme-color`, and PWA-related tags but does not include `<meta charSet="utf-8" />`. Without an explicit charset declaration browsers may trigger a security-related charset-sniffing scan before rendering. Next.js adds `<meta charset="utf-8">` via its `_document.tsx` default, but since this project does not appear to have a custom `_document.tsx`, explicitly declaring it inside the global `<Head>` in `_app.tsx` is safest and serves as documentation. Add `<meta charSet={'utf-8'} />` as the first child of the `<Head>` component in `_app.tsx`.

---

### SEO-20: Sitemap homepage and index page (`/`) is missing from the sitemap

**Priority:** Medium
**Affected files:** `pages/sitemap.tsx`
**Description:**
The `staticPages` array in `sitemap.tsx` is `['map', 'places', 'users', 'users/levels', 'categories']`. The homepage (`/` for Russian and `/en` for English) is never emitted. Both the Russian root URL (`SITE_LINK`) and the English root URL (`SITE_LINK + 'en'`) should be included, likely with `priority: '1.0'` and `changefreq: 'daily'`. Add two explicit `makeUrlNode` calls before the static-pages block: one for the bare root URL and one for `'en'`.

---

### SEO-21: Sitemap URL `Content-Type` is `text/xml` instead of `application/xml`

**Priority:** Medium
**Affected files:** `pages/sitemap.tsx`
**Description:**
`context.res.setHeader('Content-Type', 'text/xml')` is used. Googlebot and most XML parsers accept both, but the sitemap protocol and W3C spec recommend `application/xml`. More importantly, the sitemap also omits the `xmlns:xsi` and `xsi:schemaLocation` namespace declarations that enable validators to confirm well-formedness. Change the Content-Type header to `'application/xml; charset=UTF-8'` to be fully compliant.

---

### SEO-22: `next/font` is not used — web fonts are likely render-blocking

**Priority:** Medium
**Affected files:** `pages/_app.tsx`, `styles/globals.sass`
**Description:**
The project imports no fonts via `next/font` (neither `next/font/google` nor `next/font/local`). If Google Fonts or any external font is loaded via a `<link>` in a SASS file or a `_document.tsx`, that request will be render-blocking and will harm LCP and FID scores (Core Web Vitals that affect search ranking). Audit `styles/globals.sass` and any custom `_document.tsx` for `@import url(…)` or `<link rel="stylesheet">` font references. Migrate all font loading to `next/font` which automatically applies `font-display: swap`, preloads the correct subset, and self-hosts the font for zero external round-trips.

---

### SEO-23: Place detail page `og:type` uses namespace URI instead of the short-form string

**Priority:** Low
**Affected files:** `pages/places/[id]/index.tsx`, `pages/places.tsx`
**Description:**
Both pages set `openGraph.type` to `'http://ogp.me/ns/article#'`. The `next-seo` library expects the standard short-form string `'article'` — not the full OGP namespace URI. Passing the URI form may result in `next-seo` emitting a malformed `<meta property="og:type">` tag. Change both to `type: 'article'`.

---

### SEO-24: `PlaceSchema` uses `LocalBusiness` type for natural/outdoor POIs

**Priority:** Low
**Affected files:** `utils/schema.ts`
**Description:**
All places — including caves, waterfalls, ruins, and archaeological sites — are typed as `LocalBusiness` in JSON-LD. `LocalBusiness` implies a commercial entity with business hours and customer contact, which will confuse Google's entity classifier for natural or heritage POIs. Consider using `TouristAttraction` as the primary schema type (a subclass of `Place`) for most categories, falling back to `LocalBusiness` only for categories that are genuinely commercial venues. This change requires passing the place's `category.name` into `PlaceSchema` and returning the appropriate `@type` value based on a lookup map.

---

### SEO-25: Activity feed on homepage uses client-side infinite scroll — later items not indexed

**Priority:** Low
**Affected files:** `pages/index.tsx`
**Description:**
The homepage fetches activity items progressively via an infinite-scroll pattern (`useEffect` + `scroll` listener triggering RTK Query with `date` offsets). Only the initial page of activity items (fetched via `getServerSideProps`) is present in the server-rendered HTML; all subsequent items loaded on scroll are invisible to crawlers. This is low priority because activity feed items are not the primary indexable content on the homepage (places and users are), but if crawlability of the feed is desired, either render more items server-side or link to a dedicated `/activity` page with pagination.

---

### SEO-26: `robots.txt` does not disallow private/utility routes

**Priority:** Low
**Affected files:** `public/robots.txt`
**Description:**
The current `robots.txt` allows all crawlers to access all paths. Several routes should be disallowed to prevent crawl budget waste and accidental indexing: `/auth` (already `noindex` in the page but better blocked at the crawl level), `/unsubscribe`, `/places/create`, `/places/*/edit`, and `/users/settings`. Add `Disallow` directives for each. The sitemap entry (`Sitemap: https://geometki.com/sitemap.xml`) is correctly present and should be retained.

---

### SEO-27: `UserSchema` on the homepage is missing `url` and `sameAs` fields

**Priority:** Low
**Affected files:** `utils/schema.ts`
**Description:**
The `UserSchema` function returns a `Person` object with `identifier`, `image`, and `name` but no `url` (the canonical profile URL) or `sameAs` (external social profile links). Adding `url` is important for Google to resolve the entity correctly. The function signature should accept `canonicalUrl` as a second parameter (consistent with the fix in SEO-5) and include `url: \`${canonicalUrl}users/${user.id}\`` in the returned object.

---

### SEO-28: Place detail page has two separate JSON-LD `<script>` tags instead of one

**Priority:** Low
**Affected files:** `pages/places/[id]/index.tsx`
**Description:**
Two separate `<script type="application/ld+json">` tags are emitted: one for the `BreadcrumbList` and one for the `LocalBusiness`. While Google can parse multiple JSON-LD blocks on a single page, the best practice is to emit a single JSON-LD array `[breadcrumb, place]` or to use `@graph` to keep the structured data self-contained and easier to validate. Merge both into a single `<script>` that outputs `JSON.stringify([breadCrumbSchema, placeSchema])` (matching the pattern already used on `pages/index.tsx`).
