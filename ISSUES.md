# Issues

Open bugs and improvements only. When an item is fixed or done, delete its line entirely
(no strikethrough, no "done" marks). Written in English, one line per item.

## Bugs

- Server: `GET /auth/me` called from the home page SSR (`client/pages/index.tsx`) runs `SessionLibrary::update()` with the Next server's IP, overwriting `sessions.user_ip` until the browser's next poll; forward `X-Forwarded-For` from SSR requests (or read the user id without `auth/me`). `user_ip` is not read anywhere yet.

- Server: `Places::create` / `Places::update` ignore the result of `PlacesContentModel::saveContent()`, so a failed text save (e.g. two concurrent first saves of a new locale hitting the `place_locale` unique key) still answers 200; check it and fail the request.

## Improvements

- Home page (EN): many place and collection titles stay in Russian because they have no English text; prefer items with an English title in "Where to go" and the collections on `/en`, or transliterate.
- Search: the short-term (≤3 characters) `LIKE` branch of `PlacesContent::search()` has no `LIMIT`, so a 1-character query scans and returns nearly every place; cap it.
- Server tests: `GET /stats` has no test for the new `categories` field (counts per whitelisted category, soft-deleted places excluded).
- Server CI: no static analysis; add PHPStan (level 0–1, `codeigniter/phpstan-codeigniter`, a baseline) to `api-checks`. Level 0 alone would have caught the `$this` inside a `static fn` in `Places::texts()` (HTTP 500 in 1.16.0).
- Server tests: almost no controller is called for real (only `PlacesTextsEndpointTest` uses `FeatureTestTrait`); most "unit" tests copy the logic into helpers. Add `FeatureTestTrait` smoke tests on SQLite that every public GET endpoint answers without 500.
- Server tests: the migrations cannot run on an empty database (`AddActivity` references `comments` before `AddComments` creates it), so feature tests build tables by hand; fix it with a new migration so tests can run the full schema.
- Process: 1.16.0 features went straight into the release PR (#358) with no review and no server tests; ship each feature through its own reviewed PR.
- SEO: the Open Graph image `client/public/images/pages/main.jpg` is 1768×1538, social networks crop it; add a 1200×630 image and an explicit `twitter:image`.
