---
name: server_project_overview
description: Architecture, tech stack, and key conventions of the geometki server-side PHP API
type: project
---

CodeIgniter 4 PHP REST API serving the geometki geolocation/POI platform.

**Why:** Backend for a mapping app where users create, edit, and rate geotagged places.

**Tech stack:**
- CodeIgniter 4 (ResourceController base for all controllers)
- MySQL with soft deletes on most tables
- JWT auth via firebase/php-jwt stored in Authorization header; session tracking via custom SessionLibrary + sessions table
- OAuth integrations: Google, Yandex, VK
- Nominatim (OpenStreetMap) for reverse geocoding
- GD image library for photo/avatar processing
- Custom CORS filter (wildcard origin)

**ID scheme:** All primary keys are VARCHAR(15) generated with `uniqid()` via `ApplicationBaseModel::generateId()` before insert — not auto-increment integers.

**Locale:** Custom `LocaleLibrary` reads a `Locale` HTTP header; supported locales are `en` and `ru`. All place content is stored in `places_content` table with a locale column.

**Key models:** PlacesModel, UsersModel, ActivityModel, PhotosModel, CommentsModel, RatingModel, SessionsModel, PlacesContentModel.

**Key libraries (original):** SessionLibrary (auth + session resolution), PlacesContent (multi-locale content fetching), LevelsLibrary (XP/level system), ActivityLibrary (event logging + notifications), Geocoder (Nominatim integration), NotifyLibrary (in-app notifications), EmailLibrary (outbound email queue via SendingMail model).

**New libraries added 2026-03-23:**
- `AvatarLibrary` — `buildPath(?userId, ?filename, size)` constructs avatar URL; `processUpload(userId, sourcePath)` moves file and generates _small/_medium; `deleteOld(userId, filename)` removes all variants.
- `PlaceFormatterLibrary` — `formatAuthor`, `formatAddress(row, locale)`, `formatCategory(row, locale)`, `formatCover(placeId, photosCount)`, `formatDistance(raw)`, `cleanupFields(row)` for place response shaping.
- `ReputationLibrary` — `recalculate(userId)` computes/persists user reputation from all place ratings.
- `PhotoLibrary` — `processFile(sourcePath, targetDir, createCover)` normalises dimensions/generates preview; `generateCover(sourcePath, targetDir)`.

**Locale:** `LocaleLibrary` is now a global before-filter (`LocaleFilter` registered in `Config/Filters.php`). Do NOT call `new LocaleLibrary()` in controller constructors — it's already applied globally.

**SessionLibrary:** Must be assigned to `$this->session` in the controller constructor, not instantiated per-method.

**Notable model methods added 2026-03-23:**
- `PlacesModel::recordView(placeId, ?userId, updatedAt)` — transactional view+log; best-effort users_place_views.
- `PlacesModel::applyWeeklyViewsSort(order)` / `applyRecommendationSort(userId)` — query-builder sort helpers.
- `PlacesModel::incrementBookmarks/decrementBookmarks/incrementComments/incrementPhotos/decrementPhotos/syncPhotosCount/refreshTrendingScores`.
- `ActivityModel::incrementViews(ids)`.
- `UsersNotificationsModel::getRecentUnread/countOlderUnread/getPaginatedByUser/countByUser/markRead`.
- `UserInterestProfilesModel::refreshForUser(userId)`.

**Spark commands:** `trending:refresh`, `interests:refresh`, `migrate:fix-cover-sizes`.

**How to apply:** When suggesting changes, consider the CI4 model/entity/controller pattern, the custom ID generation, dual-language content architecture, and the library/model boundaries established above.
