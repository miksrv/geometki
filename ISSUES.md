# Issues

Open bugs and improvements only. When an item is fixed or done, delete its line entirely
(no strikethrough, no "done" marks). Written in English, one line per item.

## Bugs

- Server: `GET /auth/me` called from the home page SSR (`client/pages/index.tsx`) runs `SessionLibrary::update()` with the Next server's IP, overwriting `sessions.user_ip` until the browser's next poll; forward `X-Forwarded-For` from SSR requests (or read the user id without `auth/me`). `user_ip` is not read anywhere yet.

- Server: `Places::create` / `Places::update` ignore the result of `PlacesContentModel::saveContent()`, so a failed text save (e.g. two concurrent first saves of a new locale hitting the `place_locale` unique key) still answers 200; check it and fail the request.

## Data

- Regions: "Башкортостан" and "Республика Башкортостан" are two region records, so the home page "Popular regions" block and the location lists show the region twice; merge them in the database.

## Improvements

- Home page (EN): many place and collection titles stay in Russian because they have no English text; prefer items with an English title in "Where to go" and the collections on `/en`, or transliterate.
- Search: the short-term (≤3 characters) `LIKE` branch of `PlacesContent::search()` has no `LIMIT`, so a 1-character query scans and returns nearly every place; cap it.
- Server tests: `GET /stats` has no test for the new `categories` field (counts per whitelisted category, soft-deleted places excluded).
- SEO: the Open Graph image `client/public/images/pages/main.jpg` is 1768×1538, social networks crop it; add a 1200×630 image and an explicit `twitter:image`.
