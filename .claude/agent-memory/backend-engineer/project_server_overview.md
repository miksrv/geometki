---
name: server_project_overview
description: Architecture, tech stack, and key conventions of the geometki server-side PHP API
type: project
---

CodeIgniter 4 PHP REST API serving the geometki geolocation/POI platform.

**Why:** Backend for a mapping app where users create, edit, and rate geotagged places.

**Tech stack:**
- CodeIgniter 4 (ResourceController base for all controllers), PHP 8.2+
- MySQL with soft deletes on most tables
- JWT auth via firebase/php-jwt in the Authorization header; session tracking via `SessionLibrary` + sessions table (`Session` header for anonymous sessions)
- OAuth clients: `GoogleClient`, `YandexClient`, `VkClient`
- Geocoding: `Geocoder` / `NominatimClient` (geocoder-php Nominatim + Yandex providers)
- GD image library for photo/avatar processing
- `CorsFilter`: allowlist from `cors.allowedOrigins` env; falls back to `*` when unset

**ID scheme:** primary keys are 13-char hex strings generated in `ApplicationBaseModel::generateId()` (beforeInsert, `random_bytes`) — not auto-increment integers.

**Locale:** `LocaleFilter` (global before-filter in `Config/Filters.php`) applies `LocaleLibrary`, which reads the `Locale` header (`en`/`ru`). Do NOT call `new LocaleLibrary()` in controllers. Place content lives in `places_content` with a locale column.

**SessionLibrary:** assign to `$this->session` in the controller constructor, not per method.

**Categories:** no table; `Config/Categories.php` whitelists the keys, names/texts live on the client. `Categories` controller only serves `GET /categories/:name/locations` (landing perelinking).

**Library boundaries (app/Libraries):** `AvatarLibrary` (avatar paths/upload/variants), `PhotoLibrary` (photo processing, covers), `PlaceFormatterLibrary` (place response shaping: author, address, cover, distance), `ReputationLibrary`, `LevelsLibrary`, `AchievementsLibrary`, `ActivityLibrary`, `NotifyLibrary`, `EmailLibrary`, `PlacesContent`, `PlaceTags`, location dedup/slugs (`LocationMatcher`, `LocationMerge`, `LocationSlugLibrary`), OSM candidates (`OsmCollector`, `OsmScoring`, `OsmSourcesClient`, `OsmTiles`).

**Spark commands (app/Commands):** `trending:refresh`, `interests:refresh`, `achievements:evaluate`, `locations:rebuild`, `osm:collect`, `osm:rescore`, `digest:weekly`, `system:generate-place-slugs`, `system:calculate-tags-count`, `system:generate-users-online`, `system:send-email`, `system:test-email`.

**Error handling convention:**
- All user-visible strings go through `lang('File.key')` — no hardcoded English in controllers; key naming `ControllerName.camelCaseKey`
- I/O and external-service calls wrapped in `try/catch (Throwable $e)` with `log_message('error', '{exception}', ['exception' => $e])`, returning `$this->failServerError(lang('...'))`
- Language files in `app/Language/en/` and `app/Language/ru/` — always keep in sync
- Reference impl: `Photos.php` + `Language/{en,ru}/Photos.php`

**How to apply:** follow the CI4 model/entity/controller pattern, the custom ID generation, dual-language content and the library/model boundaries above.
