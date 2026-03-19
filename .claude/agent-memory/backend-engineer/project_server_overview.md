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

**Key libraries:** SessionLibrary (auth + session resolution), PlacesContent (multi-locale content fetching), LevelsLibrary (XP/level system), ActivityLibrary (event logging + notifications), Geocoder (Nominatim integration), NotifyLibrary (in-app notifications), EmailLibrary (outbound email queue via SendingMail model).

**How to apply:** When suggesting changes, consider the CI4 model/entity/controller pattern, the custom ID generation, and the dual-language content architecture.
