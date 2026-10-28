# Geometki API Reference

The Geometki REST API is a CodeIgniter 4 PHP backend that powers the Geometki geospatial POI platform. All responses are JSON. The base URL in production is `https://api.geometki.com/` (append route paths directly, e.g. `https://api.geometki.com/places`). For local development the server runs on `http://localhost:8080/`.

---

## Authentication

Most read endpoints are public. Write operations require authentication.

**JWT Bearer token** — include the token returned by any auth endpoint in the `Authorization` header:

```
Authorization: Bearer <token>
```

Guests are tracked by a `Session` header carrying the anonymous session id (the `session` value returned by a guest's first `PUT /rating`; `GET /auth/me` starts no session for a guest). It does not authenticate; it ties rating votes and activity to a visitor.

**Locale** — send a `Locale: ru` or `Locale: en` header (default `ru`); translated fields are returned in that language.

**Error response format** (all error responses follow this envelope):

```json
{
  "messages": {
    "error": "Human-readable error message"
  }
}
```

Validation errors may return a map of field names to messages:

```json
{
  "messages": {
    "email": "The email field is required.",
    "password": "Invalid credentials."
  }
}
```

**HTTP status codes used:**

| Code | Meaning |
|------|---------|
| 200  | OK |
| 201  | Created |
| 400  | Validation / bad request |
| 401  | Unauthorized |
| 403  | Forbidden (not allowed, or already authenticated on auth endpoints) |
| 404  | Not found |
| 409  | Already exists |
| 429  | Too many requests |
| 500  | Server error |

Auth endpoints `POST /auth/login` and `POST /auth/registration` are rate-limited to 10 requests a minute per IP (`429` with a `Retry-After` header).

---

## Endpoints

#### `GET /`

API info, e.g. for health checks. **Auth required:** No

```json
{ "name": "Geometki API", "version": "1.0.0", "status": "ok" }
```

---

### Auth

#### `POST /auth/registration`

Register a new user with email and password.

**Auth required:** No (returns 403 if already authenticated)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique display name |
| email | string | Yes | Valid email address (6–50 chars) |
| password | string | Yes | Password (8–50 chars) |

**Response:**

```json
{
  "session": "abc123sessionid",
  "auth": true,
  "user": {
    "id": "a1b2c3d4e5f6g7h",
    "name": "traveler42",
    "email": "user@example.com",
    "role": "user",
    "locale": "ru",
    "avatar": null
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

`user` is the stored account row (`id`, `name`, `email`, `avatar`, `role`, `locale`, …); the exact set of fields differs slightly between the auth flows.

**Error responses:**

- `403` — User is already authenticated
- `400` — Validation errors (name taken, email taken, invalid format)
- `429` — Rate limit exceeded

---

#### `POST /auth/login`

Authenticate with email and password.

**Auth required:** No (returns 403 if already authenticated)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Registered email address |
| password | string | Yes | Account password (8–50 chars) |

**Response:** Same shape as `POST /auth/registration`.

**Error responses:**

- `403` — Already authenticated
- `400` — Invalid credentials or validation errors
- `429` — Rate limit exceeded

---

#### `POST /auth/magic-link`

Request a passwordless login link by email. Always answers the same way, whether or not the email is registered or rate-limited, so it never reveals account existence. The emailed link points to `{siteUrl}/auth?token=…` (plus `&return=…` when `returnPath` was given).

**Auth required:** No (returns 403 if already authenticated)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Email address (max 255 chars) |
| returnPath | string | No | Site-relative path (must start with `/`) to return to after login |

**Response:** `{ "sent": true }`

**Error responses:**

- `403` — Already authenticated
- `400` — Invalid email

---

#### `POST /auth/magic-link/verify`

Exchange a magic-link token for a login; creates the account on first use.

**Auth required:** No (returns 403 if already authenticated)

**Request body (JSON):** `{ "token": "<token from the link>" }`

**Response:** Same shape as `POST /auth/registration`, plus `"isNewUser": true` when the account was just created.

**Error responses:**

- `403` — Already authenticated
- `400` — Token missing, invalid, or expired

---

#### `GET /auth/me`

Retrieve the current session and, when authenticated, the user and a JWT token. For a signed-in user also updates the session; for a guest it writes nothing and returns `{"session": <the sent session or null>, "auth": false}`. The token is regenerated only when the one sent is within 5 minutes of expiry; otherwise the same token is returned.

**Auth required:** No (returns partial response if unauthenticated)

**Response (unauthenticated):**

```json
{
  "session": "abc123sessionid",
  "auth": false
}
```

**Response (authenticated):**

```json
{
  "session": "abc123sessionid",
  "auth": true,
  "user": {
    "id": "a1b2c3d4e5f6g7h",
    "name": "traveler42",
    "email": "user@example.com",
    "role": "user",
    "locale": "ru",
    "avatar": "photo.jpg",
    "levelData": {
      "level": 3,
      "experience": 150,
      "nextLevel": 300
    }
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

---

#### `GET /auth/google`

Initiate or complete Google OAuth2 authentication. If called without a `code` parameter, returns a redirect URL to Google's consent screen. If called with a `code` parameter (OAuth2 callback), authenticates/registers the user.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | string | No | OAuth2 authorization code from Google |

**Response (no code — redirect step):**

```json
{
  "auth": false,
  "redirect": "https://accounts.google.com/o/oauth2/auth?..."
}
```

**Response (with code — authenticated):** Same shape as `POST /auth/registration`.

**Error responses:**

- `403` — Already authenticated
- `400` — Service returned empty profile, or account is bound to a different OAuth provider

---

#### `GET /auth/yandex`

Initiate or complete Yandex OAuth2 authentication. Same flow as `GET /auth/google`.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | string | No | OAuth2 authorization code from Yandex |

**Response (no code):**

```json
{
  "auth": false,
  "redirect": "https://oauth.yandex.ru/authorize?..."
}
```

**Response (with code):** Same shape as `POST /auth/registration`.

---

#### `GET /auth/vk`

Initiate or complete VK OAuth2 authentication. Same flow as `GET /auth/google`.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | string | No | OAuth2 authorization code from VK |
| state | string | No | OAuth2 state parameter |
| device_id | string | No | VK device ID |

**Response (no code):**

```json
{
  "auth": false,
  "redirect": "https://oauth.vk.com/authorize?..."
}
```

**Response (with code):** Same shape as `POST /auth/registration`.

---

### Places

#### `GET /places`

List places with optional filtering, sorting, and pagination.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| sort | string | No | Sort field: `views`, `views_week`, `trending`, `recommended`, `rating`, `comments`, `bookmarks`, `category`, `distance`, `created_at`, `updated_at`. `recommended` falls back to `trending` for guests; `distance` needs coordinates |
| order | string | No | Sort direction: `ASC` or `DESC` (default `DESC`) |
| category | string | No | Filter by category key, or a comma-separated list (e.g. `castle`, `cave,abandoned,industrial`) |
| author | string | No | Filter by user ID |
| country | integer | No | Filter by country ID |
| region | integer | No | Filter by region ID |
| district | integer | No | Filter by district ID |
| locality | integer | No | Filter by locality/city ID |
| location | string | No | Filter by a location slug (any level) — see `GET /locations/resolve`. Applied in addition to the id-based params above; an unknown slug matches no places |
| search | string | No | Full-text search in place titles and content |
| bookmarkUser | string | No | Return only places bookmarked by this user ID |
| notVisited | boolean | No | Signed-in visitors only: drop the places they have a visit at (the "not been there yet" view); ignored for guests |
| excludePlaces | string | No | Comma-separated list of place IDs to exclude |
| lat | float | No | Viewer latitude for distance calculation |
| lon | float | No | Viewer longitude for distance calculation |
| limit | integer | No | Max results (default 20, max 40) |
| offset | integer | No | Pagination offset (default 0) |

**Response:**

```json
{
  "items": [
    {
      "id": "a1b2c3d4e5f6g",
      "slug": "vodopad-gadelsha",
      "lat": 51.7686,
      "lon": 55.1014,
      "category": "waterfall",
      "rating": 4,
      "views": 312,
      "photos": 5,
      "comments": 3,
      "bookmarks": 7,
      "updated": "2025-11-01T12:00:00+00:00",
      "title": "Waterfall Gadelsha",
      "address": {
        "country": { "id": 1, "name": "Russia", "slug": "russia" },
        "region": { "id": 5, "name": "Bashkortostan", "slug": "bashkortostan" },
        "district": { "id": 22, "name": "Baymaksky District", "slug": "baymakskiy-rayon" },
        "locality": { "id": 101, "name": "Gadelsha", "slug": "gadelsha" }
      },
      "cover": {
        "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg",
        "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg"
      },
      "distance": 12.4
    }
  ],
  "count": 1245
}
```

Note: for a signed-in visitor every item also carries `bookmarked` and `visited` (booleans: a bookmark, at least one visit). `distance` (km) is only present when `lat`/`lon` query parameters are provided. `cover` is only present when a cover image exists. `address` sub-fields are only present when geocoding data is available; each sub-field's `slug` is the location's path segment for the landing pages (see `GET /locations/resolve`) and is `null` until a slug has been assigned.

---

#### `GET /places/:id`

Get full details for a single place by ID. Increments the view counter.

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| lat | float | No | Viewer latitude for distance calculation |
| lon | float | No | Viewer longitude for distance calculation |

**Response:**

```json
{
  "id": "a1b2c3d4e5f6g",
  "slug": "vodopad-gadelsha",
  "lat": 51.7686,
  "lon": 55.1014,
  "rating": 4.2,
  "views": 313,
  "photos": 5,
  "comments": 3,
  "bookmarks": 7,
  "updated": "2025-11-01T12:00:00+00:00",
  "created": "2024-03-15T09:30:00+00:00",
  "title": "Waterfall Gadelsha",
  "content": "Beautiful waterfall in the southern Urals with a 15m drop...",
  "category": "waterfall",
  "author": {
    "id": "u1u2u3u4",
    "name": "traveler42",
    "activity": "2025-11-10T08:00:00+00:00",
    "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
  },
  "editors": [
    {
      "id": "u5u6u7u8",
      "name": "editor99",
      "avatar": "/uploads/avatars/u5u6u7u8/photo_small.jpg"
    }
  ],
  "address": {
    "country": { "id": 1, "name": "Russia", "slug": "russia" },
    "region": { "id": 5, "name": "Bashkortostan", "slug": "bashkortostan" },
    "district": { "id": 22, "name": "Baymaksky District", "slug": "baymakskiy-rayon" },
    "locality": { "id": 101, "name": "Gadelsha", "slug": "gadelsha" },
    "street": "near village Gadelsha"
  },
  "cover": {
    "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg",
    "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg"
  },
  "distance": 12.4
}
```

A cover cut from a linked photo (see `PATCH /places/cover/:id`) also has `cover.credit`: `{ "source": "wikimedia" | "pastvu", "author", "license", "licenseUrl", "url" }` — the photo's author, licence and source page, to be shown with the cover.

**Error responses:**

- `404` — Place not found

---

#### `GET /places/:id/texts`

The current title and description of a place in every locale it has one in, without falling back between locales (a missing locale is not listed). Used to edit or translate the text of one locale. **Auth required:** No

**Response:** `{ "items": [{ "locale": "ru", "title": "…", "content": "…", "updated": "…" }] }`; `404` — place not found.

---

#### `POST /places`

Create a new place.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Place title (8–200 chars) |
| category | string | Yes | Category key — one of `Config\Categories::$names` (see the Categories section for the list) |
| lat | float | Yes | Latitude (min 3 chars) |
| lon | float | Yes | Longitude (min 3 chars) |
| content | string | No | Description text (HTML stripped) |
| photos | array | No | Array of temporary photo filenames to attach |
| candidate | string | No | OSM candidate id the place is created from (a white spot): links the candidate to the new place and hides it from the map. Ignored (the place is still created) when the candidate is already taken, or the place is not the same object: it must stand within `linkRadius` (1 km) and have a similar title, or be of the same category within `sameCategoryRadius` (50 m) |

**Response:** `201 Created`

```json
{
  "id": "a1b2c3d4e5f6g",
  "spotOpened": false
}
```

`spotOpened` is `true` when the place was created from an OSM candidate (`candidate`) and the candidate was linked to it: the author opened a white spot and gets the pioneer's experience. Other open candidates the new place duplicates are linked to it automatically. Note: If a place already exists at the same coordinates for the same user, its ID is returned without creating a duplicate.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or geocoder failure

---

#### `PATCH /places/:id`

Update an existing place's content, category or coordinates. A moved place links the open OSM candidates it now stands on.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Request body (JSON):** All fields are optional.

| Field | Type | Description |
|-------|------|-------------|
| title | string | New title (8–200 chars) |
| content | string | New description text (HTML stripped) |
| category | string | New category key |
| lat | float | New latitude |
| lon | float | New longitude |

**Response:**

```json
{
  "content": "Updated description."
}
```

Note: If the same author edits within 3 months, the existing content version is overwritten; otherwise a new version is created.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or place not found

---

#### `PATCH /places/cover/:id`

Set the cover image for a place by cropping one of its photos: an uploaded one (`photoId`) or a linked Wikimedia Commons / PastVu one (`externalPhotoId`, the `id` of a `GET /photos` item with `external.coverAllowed: true`). A linked photo is downloaded from its source only for the cut; the place then remembers it and `GET /places/:id` credits it in `cover.credit`.

A linked photo can be a cover when it is at least 400×133 (a smaller photo is upscaled to the 1800×600 cover) and, for Wikimedia Commons, has a known licence without NoDerivatives (cropping changes the image). PastVu gives no licence; such covers are credited too.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photoId | string | One of the two | ID of an uploaded photo of the place |
| externalPhotoId | string | One of the two | ID of a linked photo of the place |
| x | integer | Yes | Crop origin X (pixels) |
| y | integer | Yes | Crop origin Y (pixels) |
| width | integer | Yes | Crop width (pixels) |
| height | integer | Yes | Crop height (pixels) |

The crop box is in the pixels of the image file: for a linked photo, of the file at its `full` URL (a PastVu file is a little taller than its size in the PastVu API). A box sticking out of the image by rounding is moved inside it.

**Response:** `200 OK` with empty body on success.

**Error responses:**

- `401` — Not authenticated
- `400` — Missing fields, image dimensions too small/large, place or photo not found, the linked photo cannot be a cover, or its source did not return the image

---

#### `DELETE /places/:id`

Delete a place and all its photos. Admin role required.

**Auth required:** Yes (admin role)

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Response:** `200 OK` with empty body.

**Error responses:**

- `401` — Not authenticated or not an admin
- `404` — Place not found

---

### POI (Map data)

Lightweight endpoints for map rendering — return minimal fields suitable for map markers.

#### `GET /poi`

Get a list of POI markers, optionally clustered, within optional map bounds.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| bounds | string | No | Viewport bounding box `west,south,east,north` (Leaflet `toBBoxString()`); ignored when malformed |
| categories | string | No | Comma-separated list of category keys to filter |
| author | string | No | Filter by user ID |
| visited | string | No | Only places this user ID has visited (has at least one visit at) |
| bookmarks | string | No | Only places bookmarked by this user ID |
| zoom | integer | No | Map zoom level used for clustering (default 10) |
| cluster | boolean | No | Set `true` to receive clustered markers |

**Response (unclustered):**

```json
{
  "count": 3,
  "items": [
    { "id": "a1b2c3d4e5f6g", "category": "landscape", "lat": 51.7686, "lon": 55.1014, "title": "Гора Шихан" },
    { "id": "h7i8j9k0l1m2n", "category": "castle", "lat": 52.2865, "lon": 56.8412, "title": "Усадьба Тимашевых" }
  ]
}
```

**Response (clustered):** Items may contain cluster objects alongside regular place objects. Cluster objects include a `type: "cluster"` field and a point count.

---

#### `GET /poi/photos`

Get photo geo-coordinates for map rendering, optionally clustered.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| bounds | string | No | Viewport bounding box `west,south,east,north` |
| zoom | integer | No | Map zoom level (default 10) |
| cluster | boolean | No | Set `true` to enable clustering |

**Response:**

```json
{
  "count": 2,
  "items": [
    {
      "placeId": "a1b2c3d4e5f6g",
      "lat": 51.7686,
      "lon": 55.1014,
      "full": "/uploads/photos/a1b2c3d4e5f6g/img001.jpg",
      "preview": "/uploads/photos/a1b2c3d4e5f6g/img001_preview.jpg",
      "title": "Waterfall Gadelsha"
    }
  ]
}
```

---

#### `GET /poi/:id`

Get lightweight details for a single place (used as map popup data). Optional query params `lat`, `lon` (the visitor's position): when given, the response has `distance` (km).

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Response:**

```json
{
  "id": "a1b2c3d4e5f6g",
  "slug": "vodopad-gadelsha",
  "rating": 4,
  "views": 312,
  "photos": 5,
  "comments": 3,
  "bookmarks": 7,
  "title": "Waterfall Gadelsha",
  "distance": 12.4,
  "cover": {
    "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg",
    "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg"
  },
  "bookmarked": false
}
```

`bookmarked` is present only for an authenticated user.

**Error responses:**

- `404` — Place not found

---

### OSM Candidates

Interesting objects from OpenStreetMap and Wikidata that are not on Geometki yet. The map reads only our database: tiles of the requested area that were never collected are queued, and the background command `php spark osm:collect` (cron, every minute) collects them from Overpass and Wikidata SPARQL. A Wikidata item is glued to an OSM object when the OSM object refers to it, or has the same title within 300 m; the rest become Wikidata-only candidates (`source: "wikidata"`, no `osmType`/`osmId`). Photos come from Wikimedia Commons with their author and licence. Scoring rules live in `app/Config/OsmCandidates.php`; after changing them run `php spark osm:rescore`.

#### `GET /osm-candidates`

Candidates inside the map area. Objects already on Geometki (`status` `linked` or `duplicate`) are returned to admins only. Open candidates that duplicate one of our places are linked to it automatically (status `linked`, `place` set) when a tile is collected and when a place is created or moved, so they disappear from the public answer; when a place is deleted its candidates are open again.

**Auth required:** No (admin data needs auth)

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| bounds | string | Yes | `south,west,north,east`; areas over `maxRequestArea` square degrees, or covering more than `maxRequestTiles` (150) tiles of 0.1°, get `tooLarge` |
| tiers | string | No | Comma separated: `known`, `explore`, `other` (default `known,explore`) |

**Response:**

```json
{
  "items": [
    {
      "id": "b3d62cac8fe30",
      "source": "osm",
      "osmType": "relation",
      "osmId": 9640839,
      "lat": 51.149669,
      "lon": 55.001392,
      "name": "Развал",
      "typeTitle": "Озеро",
      "osmTag": "natural=water",
      "category": "water",
      "tier": "known",
      "score": 12,
      "breakdown": [{ "code": "type", "points": 1, "value": "natural=water" }, { "code": "nearbyWiki", "points": 4, "value": "Развал (озеро)", "distance": 56 }],
      "wikipedia": "ru:Развал (озеро)",
      "wikidata": "Q2132225",
      "photos": [
        {
          "file": "Salionka.jpg",
          "url": "https://upload.wikimedia.org/wikipedia/commons/9/90/Salionka.jpg",
          "page": "https://commons.wikimedia.org/wiki/File:Salionka.jpg",
          "author": "Kagul",
          "license": "Public domain",
          "licenseUrl": null
        }
      ],
      "image": null,
      "heritage": null,
      "ele": null,
      "size": 411,
      "settlement": { "name": "Соль-Илецк", "type": "town", "distance": 0 },
      "status": "open",
      "place": null
    }
  ],
  "pendingTiles": 0
}
```

`photos` — Commons photos, to be shown only with `author` and `license`. `image` — a photo link from OSM with an unknown licence, set only when there are no Commons photos. `heritage` — the Russian cultural heritage register code.

A tile asked for within the last `requestCooldownMinutes` (10) is only read: looking at a collected area or polling a pending one writes nothing and does not raise the tile's priority. Writes to the queue are limited to `queueRequestsPerMinute` a minute per IP (only the requests that have something to write count); above that the endpoint only reads the database. The map asks for the area widened to whole 0.1° tiles, so panning inside the same tiles is answered from the client cache.

`pendingTiles` — tiles of the area that are queued or being collected now (a failed tile waits for its retry and is not counted).

An area that is too large returns `{ "tooLarge": true, "items": [], "pendingTiles": 0 }`; malformed `bounds` returns `400`.

---

#### `GET /osm-candidates/:id`

One candidate in the same shape, e.g. to prefill the new place form.

**Error responses:**

- `404` — Not found, rejected or gone

---

#### `PATCH /osm-candidates/:id/link`

Link a candidate to an existing place, the same link as when a place is created from it.

**Auth required:** Yes (admin)

**Request body (JSON):** `{ "placeId": "65cfaf32be69b" }`

**Response:** `{ "id": "<candidate id>", "placeId": "65cfaf32be69b" }`; `400` when the place is not found.

---

#### `PATCH /osm-candidates/:id/unlink`

Remove a wrong link: the candidate is open again. **Auth required:** Yes (admin)

---

#### `PATCH /osm-candidates/:id/reject`

Hide a candidate for good; re-collection does not bring it back. **Auth required:** Yes (admin)

`unlink` and `reject` respond `{ "id": "<candidate id>", "status": "open" | "rejected" }`.

Errors of the three admin endpoints: `401` not authenticated, `403` not an admin, `404` candidate not found.

---

### Photos

#### `GET /photos`

List photos with optional filtering and pagination, newest first.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| place | string | No | Filter by place ID |
| author | string | No | Filter by user ID |
| limit | integer | No | Max results (default 40, 1 to 40) |
| offset | integer | No | Pagination offset (default 0) |
| places | `1` | No | Add `places` to every user: their newest places with a cover, at most 4, newest first (the people page cards) |

**Response:**

```json
{
  "items": [
    {
      "id": "p1p2p3p4p5p6p7",
      "placeId": "a1b2c3d4e5f6g",
      "full": "/uploads/photos/a1b2c3d4e5f6g/img001.jpg",
      "preview": "/uploads/photos/a1b2c3d4e5f6g/img001_preview.jpg",
      "width": 1920,
      "height": 1080,
      "title": "Waterfall Gadelsha",
      "created": "2025-03-01T10:00:00+00:00",
      "author": {
        "id": "u1u2u3u4",
        "name": "traveler42",
        "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
      }
    }
  ],
  "count": 87
}
```

With `place` (and no `author`), the first page also includes the Wikimedia Commons and PastVu photos linked to the place (see External Photos): same shape with absolute `full`/`preview` URLs, no `author`, and an `external` object (`source`, `externalId`, `title`, `author`, `license`, `licenseUrl`, `year`, `url`, `coverAllowed` — the place cover can be cut from it). `count` includes them on every page.

---

#### `POST /photos/upload/temporary`

Upload a photo to the temporary holding area before a place has been created. Returns a temporary file reference (`201 Created`).

**Auth required:** Yes

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photo | file | Yes | Image file |

**Response:**

```json
{
  "id": "randomname123.jpg",
  "full": "/uploads/temporary/randomname123.jpg",
  "preview": "/uploads/temporary/randomname123_preview.jpg",
  "width": 1920,
  "height": 1080,
  "placeId": "temporary"
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — No file provided or file already moved
- `500` — Upload processing error

---

#### `POST /photos/upload/:id`

Upload a photo directly to an existing place (`201 Created`).

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID to attach the photo to |

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photo | file | Yes | Image file |

**Response:**

```json
{
  "id": "p1p2p3p4p5p6p7",
  "full": "/uploads/photos/a1b2c3d4e5f6g/img002.jpg",
  "preview": "/uploads/photos/a1b2c3d4e5f6g/img002_preview.jpg",
  "width": 1920,
  "height": 1080,
  "title": "Waterfall Gadelsha",
  "placeId": "a1b2c3d4e5f6g"
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — No file, place not found
- `500` — Upload processing error

---

#### `PATCH /photos/rotate/temporary/:id`

Rotate a temporary photo 90 degrees counter-clockwise and regenerate its preview.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | any | Temporary photo filename (e.g. `randomname123.jpg`) |

**Response:**

```json
{
  "id": "randomname123.jpg",
  "full": "/uploads/temporary/randomname123.jpg",
  "preview": "/uploads/temporary/randomname123_preview.jpg"
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — Photo not found

---

#### `PATCH /photos/rotate/:id`

Rotate a permanent (place-attached) photo 90 degrees counter-clockwise and regenerate its preview.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Photo ID |

**Response:**

```json
{
  "id": "p1p2p3p4p5p6p7",
  "full": "/uploads/photos/a1b2c3d4e5f6g/newname.jpg",
  "preview": "/uploads/photos/a1b2c3d4e5f6g/newname_preview.jpg"
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — Photo not found

---

#### `DELETE /photos/temporary/:id`

Delete a temporary photo and its preview from the temporary directory.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | any | Temporary photo filename (e.g. `randomname123.jpg`) |

**Response:**

```json
{ "id": "randomname123.jpg" }
```

**Error responses:**

- `401` — Not authenticated
- `400` — Photo not found

---

#### `DELETE /photos/:id`

Delete a permanent photo. Only the photo's uploader or an admin may delete it.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Photo ID |

**Response:**

```json
{ "id": "p1p2p3p4p5p6p7" }
```

**Error responses:**

- `401` — Not authenticated
- `400` — Photo not found or no access
- `500` — Deletion error

---

### External Photos

Wikimedia Commons and PastVu photos linked to places. The images are not downloaded: they are served from the source and shown in the place gallery together with the uploaded photos (`GET /photos?place=`). Linking is a `photo_link` activity: it gives a little experience (`MODIFIER_PHOTO_LINK`, 1 point) and shows in the activity feed as a story of its own; unlinking takes both back.

#### `GET /external-photos`

**Auth required:** No

**Query parameters:** either `place` or `bounds`.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| place | string | One of | Place ID: the photos linked to it |
| bounds | string | One of | `south,west,north,east`: the linked photos inside the map area (areas over 1 square degree return `[]`; up to 1000 rows) |

**Response (`place`):**

```json
{ "items": [{ "id": "1f2e3d4c5b6a7", "source": "wikimedia", "externalId": "12345678" }] }
```

**Response (`bounds`):**

```json
{ "items": [{ "source": "pastvu", "externalId": "123456", "places": [{ "id": "a1b2c3d4e5f6g", "title": "Waterfall Gadelsha" }] }] }
```

**Error responses:**

- `400` — Neither `place` nor valid `bounds`

---

#### `POST /external-photos`

Link a photo to a place; its details (URLs, author, licence, coordinates) are fetched from the source by id.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| placeId | string | Yes | Place ID |
| source | string | Yes | `wikimedia` or `pastvu` |
| externalId | string | Yes | Photo id at the source |

**Response:** `201 Created` with the photo in the `GET /photos` external shape.

A place without a cover gets one cut from the centre of the first linked photo that can be a cover (`external.coverAllowed`). A failure there leaves the place without a cover; the photo is linked anyway.

**Error responses:**

- `401` — Not authenticated
- `400` — Invalid request or place not found
- `404` — Photo not found at the source
- `409` — Already linked to this place

---

#### `DELETE /external-photos/:id`

Unlink a photo: by the user who linked it, the place author, or an admin. When the place cover was cut from this photo, the cover is made again from the newest uploaded photo, otherwise from another linked photo that can be a cover, otherwise the place is left without one.

**Auth required:** Yes

**Response:** `{ "id": "<link id>" }`

**Error responses:**

- `401` — Not authenticated
- `403` — No access
- `404` — Link not found

---

### Users

#### `GET /users`

List users, by default ordered by recent activity.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| search | string | No | Substring of the user name |
| sort | string | No | `activity_at` (default), `created_at`, `reputation`, `experience` |
| order | string | No | `ASC` or `DESC` (default `DESC`) |
| limit | integer | No | Max results (default 40, max 40) |
| offset | integer | No | Pagination offset (default 0) |

**Response:**

```json
{
  "items": [
    {
      "id": "u1u2u3u4u5u6u7",
      "name": "traveler42",
      "avatar": "/uploads/avatars/u1u2u3u4u5u6u7/photo_small.jpg",
      "levelData": {
        "level": 3,
        "experience": 150,
        "nextLevel": 300
      },
      "reputation": 42,
      "created": "2024-01-15T10:00:00+00:00",
      "activity": "2025-11-10T08:00:00+00:00",
      "statistic": { "photo": 45, "place": 12, "visited": 20 },
      "places": [
        {
          "id": "abc123",
          "slug": "vodopad-atysh",
          "category": "waterfall",
          "title": "Водопад Атыш",
          "cover": { "preview": "uploads/places/abc123/cover_preview.jpg?d=1791259905" }
        }
      ]
    }
  ],
  "count": 350
}
```

---

#### `GET /users/:id`

Get full profile for a single user, including gamification statistics.

**Auth required:** No (own profile includes `settings` field when viewing yourself)

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | User ID |

**Response:**

```json
{
  "id": "u1u2u3u4u5u6u7",
  "name": "traveler42",
  "email": "user@example.com",
  "locale": "ru",
  "avatar": "/uploads/avatars/u1u2u3u4u5u6u7/photo_medium.jpg",
  "created": "2024-01-15T10:00:00+00:00",
  "updated": "2025-11-01T12:00:00+00:00",
  "activity": "2025-11-10T08:00:00+00:00",
  "role": "user",
  "authType": "native",
  "website": "https://example.com",
  "reputation": 42,
  "levelData": {
    "level": 3,
    "experience": 150,
    "nextLevel": 300
  },
  "statistic": {
    "place": 12,
    "photo": 45,
    "rating": 30,
    "edit": 5,
    "cover": 3,
    "comment": 8,
    "visited": 20,
    "visits": 34
  },
  "settings": { "emailComment": true, "pushComment": true, "…": "…" }
}
```

`visited` — distinct places the user has visited, `visits` — all their check-ins (a place can be visited many times; see `GET /visits`); `GET /users` lists carry `visited` only. `settings` (the keys of `PATCH /users/:id`) is only included on the user's own profile.

**Error responses:**

- `404` — User not found

---

#### `PATCH /users/:id`

Update user profile fields. Can only update your own profile.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | User ID (must match authenticated user) |

**Request body (JSON):** All fields optional.

| Field | Type | Description |
|-------|------|-------------|
| name | string | New display name (6–150 chars, unique) |
| website | string | Personal website URL (max 150 chars) |
| oldPassword | string | Current password required when changing password |
| newPassword | string | New password (8–50 chars) |
| settings | object | Notification preferences: one boolean per `{channel}{Type}` of the types the channel carries (`app/Config/Notifications.php`): `emailComment`, `emailPhoto`, `emailRating`, `emailEdit`, `emailCover`, `emailBookmark`, `emailVisit`, `emailDigest`, `pushComment`, `pushPhoto`, `pushRating`, `pushEdit`, `pushCover`, `pushBookmark`, `pushVisit`, `pushAchievement`, `pushLevel`; omitted, unknown and non-boolean keys keep their current value |

**Response:** `200 OK` with empty body. Changing the password requires both `oldPassword` and `newPassword`.

**Error responses:**

- `401` — Not authenticated or not own profile
- `400` — Validation errors, old password incorrect, nothing to update

---

#### `POST /users/avatar`

Upload a new avatar image (JPEG, PNG or WebP, max 5 MB). The file is stored temporarily and a crop step is required next. Responds `201 Created`.

**Auth required:** Yes

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| avatar | file | Yes | Image file |

**Response:**

```json
{
  "filename": "u1u2u3u4.jpg",
  "filepath": "/uploads/temporary/u1u2u3u4.jpg",
  "width": 800,
  "height": 600
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — No file provided

---

#### `PATCH /users/crop`

Crop and save the previously uploaded avatar. Creates small and medium size variants.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filename | string | Yes | Temporary filename returned by `POST /users/avatar` |
| x | integer | Yes | Crop origin X |
| y | integer | Yes | Crop origin Y |
| width | integer | Yes | Crop width (pixels) |
| height | integer | Yes | Crop height (pixels) |

**Response:**

```json
{
  "filepath": "/uploads/avatars/u1u2u3u4u5u6u7/randomname_medium.jpg"
}
```

**Error responses:**

- `401` — Not authenticated
- `400` — Missing fields, file not found, or image too small

---

### Rating

#### `GET /rating/:id`

Get the aggregate rating for a place. If the current session has already voted, includes the user's vote value.

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Response:**

```json
{
  "rating": 4.2,
  "count": 15,
  "distribution": { "1": 1, "2": 0, "3": 2, "4": 4, "5": 8 },
  "vote": 5
}
```

Note: `vote` is only present if the current session or user has previously voted on this place. `distribution` is the number of votes for each score, 1 to 5 (all zeros without votes).

---

#### `PUT /rating`

Submit or update a rating for a place.

**Auth required:** No (session-based voting is allowed for unauthenticated users)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| place | string | Yes | Place ID |
| score | integer | Yes | Rating value, 1–5 |

**Response:** `201 Created` for new vote, `200 OK` for updated vote.

**Error responses:**

- `400` — Missing data or score out of range
- `403` — The signed-in user is the author of the place (own places cannot be rated)
- `404` — Place not found

---

### Comments

#### `GET /comments`

List comments for a place, newest first.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| place | string | Yes | Place ID |

**Response:**

```json
{
  "items": [
    {
      "id": "c1c2c3c4c5c6c7",
      "placeId": "a1b2c3d4e5f6g",
      "answerId": null,
      "content": "Great place! Highly recommend visiting.",
      "created": "2025-09-20T16:45:00+00:00",
      "author": {
        "id": "u1u2u3u4",
        "name": "traveler42",
        "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
      }
    }
  ],
  "count": 3
}
```

---

#### `POST /comments`

Post a new comment on a place.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| placeId | string | Yes | Place ID (exactly 13 chars) |
| comment | string | Yes | Comment text (max 2000 chars, HTML stripped) |
| answerId | string | No | ID of the comment being replied to (exactly 13 chars) |

**Response:** `201 Created` with empty body.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or place not found

---

### Mail

Every notification email carries a signed unsubscribe token `{userId}.{scope}.{signature}`. The scope is a notification type (`comment`, `photo`, `rating`, `edit`, `cover`, `bookmark`, `visit`, `digest`), `activity` (every activity type) or `all`. The token is in the footer link (`{siteUrl}/unsubscribe?token=…`) and in the `List-Unsubscribe` header, whose one-click POST (RFC 8058) mail clients send straight to `POST /mail/unsubscribe`. Tokens do not expire; they are signed with `mail.unsubscribeSecret` (defaults to `auth.token.secret`).

#### `GET /mail/unsubscribe`

What a link unsubscribes from and whether those emails are still on. Changes nothing: mail clients open links to scan them.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| token | string | One of | Unsubscribe token from an email |
| mail | string | One of | ID of a `sending_mail` row — the links of emails sent before tokens; they stop working when `notifications:send` deletes the row (90 days) |

**Response:**

```json
{ "token": "65cfa7cc34b74.comment.qLEw_exq3BSco2NYTSZ-Ow", "scope": "comment", "subscribed": true }
```

`subscribed` is `true` while any type of the scope is on. For a `mail` link, `token` is the token to POST.

**Error responses:** `400` — invalid or forged token, unknown email or user

#### `POST /mail/unsubscribe`

Turns the emails of the token's scope off, or every email with `scope: "all"`. Sign-in links are not affected.

**Auth required:** No

**Request:** `token` in the query string (the one-click form post `List-Unsubscribe=One-Click`), or a JSON body:

```json
{ "token": "65cfa7cc34b74.comment.qLEw_exq3BSco2NYTSZ-Ow", "scope": "all" }
```

**Response:**

```json
{ "scope": "all", "subscribed": false }
```

**Error responses:** `400` — invalid or forged token

---

### Push

Web push notifications. A browser's push subscription belongs to the user who enabled push on that device; a user may have several devices. What is pushed: activity on the user's places (as in email) plus new achievements and levels; which types go is the `push{Type}` settings (see `PATCH /users/:id`). Pushes are sent by `notifications:send`.

#### `GET /push/key`

The VAPID public key for `PushManager.subscribe()`.

**Auth required:** No

**Response:** `{ "publicKey": "BJaY…" }` — `null` when push is not set up on the server.

#### `GET /push/subscriptions/status`

Whether this device's subscription is on for the signed-in user.

**Auth required:** Yes

**Query parameters:** `endpoint` — the subscription's endpoint.

**Response:** `{ "active": true, "devices": 2 }` (`devices` — the user's devices with push on)

#### `POST /push/subscriptions`

Turn push on for this device: store its subscription, or take it over from another account.

**Auth required:** Yes

**Request:**

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/…", "keys": { "p256dh": "BNcR…", "auth": "tBHI…" }, "timezone": "Europe/Moscow" }
```

`timezone` (IANA) sets the quiet hours (23:00–08:00 on the device's clock); a missing or invalid one keeps the stored one.

**Response:** `201` `{ "active": true }`

**Error responses:** `400` — not a valid subscription (the endpoint must be https); `500` — push is not set up on the server

#### `DELETE /push/subscriptions`

Turn push off for this device. Body `{ "endpoint": "…" }`. No auth: the endpoint is the proof, so signing out can remove it after the token is gone.

**Response:** `{ "active": false }`

#### `POST /push/subscriptions/renew`

The browser replaced the subscription (`pushsubscriptionchange` in the service worker, which has no auth token): moves the record to the new one. Body `{ "oldEndpoint": "…", "subscription": { "endpoint": "…", "keys": { … } } }`.

**Response:** `{ "active": true }`; `404` when the old endpoint is unknown

#### `POST /push/test`

Send a test push to every device of the signed-in user at once.

**Auth required:** Yes

**Response:** `{ "sent": 1, "devices": 1 }` (`sent` — devices the push reached; a device the push service no longer knows is deleted)

**Error responses:** `404` — no device with push on; `500` — push is not set up or the push service failed

---

### Feed

Stories of what people do on the site: the `activity` log grouped into the `feed` table (`FeedLibrary`, rules in `FeedAggregator`; after changing them run `php spark feed:rebuild`).

#### `GET /feed`

A page of stories, the most recently updated first. **Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| author | string | No | Stories of this user ID |
| place | string | No | The history of this place: only its events |
| types | string | No | Comma-separated story types (see below) |
| weight | integer | No | Minimum story weight (the home page sends `2`) |
| limit | integer | No | Max stories (default 20, max 40) |
| cursor | string | No | `next` of the previous page |
| countOnly | `true` | No | Return only `count` |

**Response:** `{ "items": [story], "next": "<cursor>" | null, "count": 14 }` — `count` (stories) only with `author` or `place` on the first page.

A story: `id`, `type`, `weight`, `created` (first event), `updated` (last event), `count` (events), `author?` and, by type:

- `place`, `photo`, `photo_link` — `place` (list item with the start of its `content`), `photos`, `photosCount` (linked photos carry `external`)
- `edit` — `place`, `changes`: `description` and/or `cover`
- `comment` — `place`, `comment: { id, content }`
- `rating`, `visit`, `collection_place` — `places` (a rating story with the author's `value` for each), `placesCount`; `collection_place` also `collection`
- `collection` — `collection`; `achievement` — `achievement: { id, title, image, tier }`; `level` — `level`

A story whose subject is gone (a deleted photo, comment or place) is left out. Bookmarks are never in the feed.

#### `GET /feed/pulse`

What happened lately (cached for a minute): event counts for the last 7 days, or 30 when the week had fewer than 10 events. **Auth required:** No

**Response:** `{ "period": 7, "places", "photos", "comments", "ratings", "edits", "visits", "collections", "authors", "users": [{ "id", "name", "avatar" }], "updated": "<latest event>" }` — `users` are the 8 most active people.

#### `GET /feed/calendar`

A user's events per day over the last 365 days, for the profile's contribution calendar; days without events are not listed. **Auth required:** No

**Query parameters:** `author` (required), `tz` — the viewer's IANA time zone; days are its days (the site's, `SITE_TIMEZONE`, when missing or unknown).

**Response:** `{ "items": [{ "date": "2026-10-01", "count": 3 }], "total": 120, "from": "2025-10-16", "to": "2026-10-15" }`; `400` without `author`.

---

### Bookmarks

#### `GET /bookmarks`

Check whether the authenticated user has bookmarked a specific place.

**Auth required:** No (returns `{ "result": false }` if not authenticated)

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| placeId | string | Yes | Place ID to check |

**Response:**

```json
{ "result": true }
```

**Error responses:**

- `400` — No `placeId` provided

---

#### `GET /bookmarks/places`

The IDs of all places in the authenticated user's bookmarks: the place cards of any list show their bookmark from it.

**Auth required:** No (returns `{ "items": [] }` if not authenticated)

**Response:**

```json
{ "items": ["65a1b2c3d4e5f6a", "65a1b2c3d4e5f6b"] }
```

---

#### `PUT /bookmarks`

Toggle a bookmark for a place. If the bookmark exists it is removed; otherwise it is added.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| placeId | string | Yes | Place ID |

**Response:** `201 Created` when added, `200 OK` when removed.

**Error responses:**

- `401` — Not authenticated
- `400` — No `placeId` provided
- `404` — Place not found

---

### Visits

"I was here" is a log: a visit is repeatable, one per user, place and day. No location is asked or stored. Public lists are in the guest cache (`visits` group). Spec: `features/25-visits-and-exploration.md`.

A **visit** object:

```json
{
  "id": "v1v2v3v4v5v6v",
  "visitedAt": "2026-10-24",
  "created": "2026-10-24T12:31:00+00:00",
  "photos": [
    { "id": "p1p2p3p4p5p6p", "full": "/uploads/photos/a1b2c3d4e5f6g/x.jpg", "preview": "/uploads/photos/a1b2c3d4e5f6g/x_preview.jpg", "width": 1600, "height": 1200, "title": "…", "placeId": "a1b2c3d4e5f6g" }
  ],
  "answers": { "road": "dirt", "can_swim": "yes" },
  "author": { "id": "u1u2u3u4", "name": "traveler42", "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg" },
  "place": { "…": "GET /places list item (only in GET /visits?user=)" }
}
```

`visitedAt` is the visitor's day, `YYYY-MM-DD`. `photos` are the photos the author uploaded to the place within the visit's day (`photos.visit_id`). `answers` is an object `question -> value` (empty when unanswered).

#### `GET /visits`

Visits of a place or of a person, newest first by the visit day. **Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| place | string | One of `place`/`user` | Place ID |
| user | string | One of `place`/`user` | User ID; every item then carries its `place` |
| limit | integer | No | Max results (default 10, max 40) |
| offset | integer | No | Pagination offset (default 0) |

**Response:** `{ "items": [<visit>], "count": 12 }`. With `place` also:

```json
{
  "items": [],
  "count": 12,
  "people": 8,
  "last": "2026-10-24",
  "visitors": [{ "id": "u1u2u3u4", "name": "traveler42", "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg" }],
  "now": [
    {
      "question": "road",
      "value": "dirt",
      "visitedAt": "2026-10-24",
      "agree": 3,
      "total": 4,
      "history": [{ "year": 2025, "value": "asphalt" }]
    }
  ]
}
```

`people` — distinct visitors, `last` — the latest visit day (or `null`), `visitors` — the 5 latest distinct visitors. `now` is "How it is now": per answered question (the `can_<feature>` keys included) the latest answer, `agree` of `total` recent answers agree with it, `history` the latest value of each earlier year; empty without answers.

**Error responses:** `400` — neither `place` nor `user`

---

#### `GET /visits/places`

The distinct places a person visited, the latest visit first, in the `GET /places` list shape (deleted places are left out).

**Auth required:** No

**Query parameters:** `user` (required), `limit` (default 10, max 40), `offset`.

**Response:** `{ "items": [ ... ], "count": 12 }`; `400` — no `user`.

---

#### `GET /visits/me`

The signed-in user's own visits of a place and the questions the place's category asks. For the "I was here" button state and the questions block (the place page is cached without a visitor).

**Auth required:** No (a guest gets empty lists)

**Query parameters:** `place` (required; without it the answer is empty).

**Response:**

```json
{
  "items": [<visit>],
  "count": 1,
  "questions": [
    { "key": "road", "values": ["asphalt", "dirt", "offroad", "foot", "water"] },
    { "key": "walk", "values": ["short", "medium", "long"] },
    { "key": "can", "features": ["swim", "camp", "kids", "winter", "drink"] }
  ]
}
```

`questions` are three of the category's pool (`Config\VisitQuestions::$categories`, six to eight per category): the ones the place has no answer to yet first, in the order of the pool, then the stale (older than a year) and the contested ones, the oldest first; the questions the current visit (the latest within the check-in window) has answered come off the three. Then, if the category has features, the last step `{ "key": "can", "features": [...] }`. Question keys and values: `road` (`asphalt`, `dirt`, `offroad`, `foot`, `water`), `walk` (`short`, `medium`, `long`), `trail` (`marked`, `faint`, `none`), `entry` (`free`, `paid`, `guarded`, `outside`, `closed`), `state` (`intact`, `decaying`, `demolished`), `water` (`present`, `dry`), `crowd` (`empty`, `some`, `crowded`), `time` (`hour`, `half`, `day`), `parking` (`near`, `far`, `none`), `cell` (`good`, `weak`, `none`), `facilities` (`none`, `basic`, `full`), `safety` (`safe`, `care`, `danger`), `access` (`full`, `partial`, `none`). The texts are on the client.

---

#### `POST /visits`

Check in at a place. **Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| place | string | Yes | Place ID |
| visitedAt | string | No | The visitor's day, `YYYY-MM-DD`; today (server) by default. Must be a real date within a day of the server's today: up to two days back, one day forward |

**Response:** `201 Created` with the visit and `isNew: true`, `ordinal` (which visit of the place this is, counting everybody's) and `firstThisYear` (no other visit of the place this year up to it). `200 OK` with the existing visit and `isNew: false` when the user already has a visit of that place on that day (idempotent; also for two simultaneous taps). The photos the user uploaded to the place that day before the tap become the visit's. The place's author is notified; a bare visit gives no experience.

**Error responses:**

- `401` — Not authenticated
- `400` — No place ID, or `visitedAt` malformed or outside the window
- `404` — Place not found

---

#### `PATCH /visits/:id`

Answer the questions of a visit. **Auth required:** Yes (the visit's author)

**Request body (JSON):** `{ "answers": { "road": "dirt", "walk": null, "can_swim": "yes" } }`. A value sets the answer, `null` removes it. Keys and values must be those of the place's category (`GET /visits/me` → `questions`); a feature of the last step is the key `can_<feature>` with `yes` or `no`.

**Response:** the visit.

**Error responses:**

- `401` — Not authenticated
- `403` — Not the author
- `404` — Visit not found
- `400` — `answers` is empty or not an object of strings/`null`, or a key or value is not asked for the place's category

---

#### `DELETE /visits/:id`

Delete a visit: its `visit` activity goes, the feed, experience and "now" answers are recounted; its photos stay with the place. **Auth required:** Yes (the author or an admin)

**Response:** `{ "id": "<visit id>" }`

**Error responses:** `401`, `403` — neither the author nor an admin, `404` — not found.

---

### Exploration

#### `GET /exploration/points`

The points of the map's exploration (hex) layer: every place and every open OSM candidate of the `known` and `explore` tiers (the white spots), as compact points with coordinates rounded to ~100 m and no ids. The client bins them into hexagons.

**Auth required:** No. Cached 10 minutes on the server (and in the guest cache); `Cache-Control: public, max-age=600`.

**Response:**

```json
{
  "places": [[51.769, 55.101, "waterfall"], [52.287, 56.841, "castle"]],
  "spots": [[51.15, 55.001, "water"]]
}
```

`category` is `null` for a point without one.

---

### Notifications

All notification endpoints require authentication and return `401` otherwise.

#### `GET /notifications/updates`

Get up to 10 unread notifications from the last 15 minutes (for toasts), newest first, and the number of unread notifications (the bell badge). Nothing is marked as read: the client calls `PATCH /notifications/read` for the toasts it has shown.

**Auth required:** Yes

**Response:**

```json
{
  "items": [
    {
      "id": "n1n2n3n4",
      "type": "comment",
      "activity": "comment",
      "meta": null,
      "read": false,
      "created": {
        "date": "2025-11-10 08:55:00.000000",
        "timezone_type": 3,
        "timezone": "UTC"
      },
      "place": {
        "id": "a1b2c3d4e5f6g",
        "slug": "vodopad-gadelsha",
        "title": "Waterfall Gadelsha",
        "cover": {
          "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg"
        }
      }
    }
  ],
  "count": 7
}
```

Note: `count` is the number of unread notifications shown in the list. `experience` notifications ("+N XP" after the user's own action) are toast-only: they come in `updates` but never in the list or `count`. `place` is omitted for `level` and `achievements` notification types, whose `meta` is `{ title, level }` / `{ title, image }`; `place.cover` is `null` for a place without a cover. Notifications about collections carry `collection: { id, slug, title }`.

---

#### `GET /notifications/list`

Get a page of the current user's notifications, newest first (toast-only `experience` notifications are left out). Nothing is marked as read.

**Auth required:** Yes

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | integer | No | Page size, 1–50 (default 10) |
| cursor | string | No | `next` of the previous page; omit for the first page |

**Response:** Same shape as `GET /notifications/updates`, plus `next` — the cursor of the next page, `null` on the last one; here `count` is the total number of the user's notifications in the list.

---

#### `PATCH /notifications/read`

Mark notifications as read.

**Auth required:** Yes

**Request body (JSON, optional):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ids | string[] | No | Up to 100 notification IDs; without `ids` all the user's notifications are marked as read |

**Response:** `{ "count": 0 }` — the new number of unread notifications. `400` for an invalid `ids`.

---

#### `DELETE /notifications`

Delete all notifications for the current user.

**Auth required:** Yes

**Response:**

```json
{
  "items": [],
  "count": 0
}
```

---

### Location

#### `GET /location/search`

Search for locations (countries, regions, districts, cities) by name text.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | Search text (matched against English and Russian names) |

**Response:**

```json
{
  "countries": [
    { "id": 1, "name": "Russia" }
  ],
  "regions": [
    { "id": 5, "name": "Bashkortostan" }
  ],
  "districts": [],
  "cities": []
}
```

Without `text` the response is an empty array `[]`.

---

#### `GET /location/geosearch`

Search for addresses and coordinates using the external geocoder (Nominatim / Yandex).

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | Free-text address or place name |

**Response:**

```json
{
  "items": [
    {
      "lat": 51.7686,
      "lon": 55.1014,
      "locality": "Gadelsha",
      "country": "Russia",
      "region": "Bashkortostan",
      "district": "Baymaksky District",
      "street": "Lenina, 1"
    }
  ]
}
```

`country`, `region`, `district` and `street` are present only when the geocoder knows them. Without `text` the response is an empty array `[]`.

---

#### `GET /location/:id`

Get details for a specific location entity by ID and type.

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | integer | Location entity ID |

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| type | string | Yes | One of: `country`, `region`, `district`, `locality` |

**Response:**

```json
{
  "id": 5,
  "name": "Bashkortostan"
}
```

An unknown `id` returns an empty body.

**Error responses:**

- `400` — Invalid or missing `type` parameter

---

#### `PUT /location`

Save the signed-in user's last known position. Called by the client only after the user has asked for their location (the map's "My location" button, sorting by distance). The point is not returned by any endpoint; it is kept for the user page map of `features/25-visits-and-exploration.md` (step 7). A move shorter than 200 m from the saved point is not written. Anonymous visitors' positions are not stored: pass `lat`/`lon` to the endpoints that compute a distance instead.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lat | float | Yes | Latitude, -90…90 |
| lon | float | Yes | Longitude, -180…180 |

**Response:** `200 OK` with empty body.

**Error responses:**

- `400` — Invalid coordinates
- `401` — Not signed in

---

### Locations

The landing-page API behind `/places/{location}`-style URLs. Distinct from the `Location` (singular) endpoints above, which serve the existing filter UI.

Every response that represents a location, a category, or a location×category pair includes `placesCount` and `indexable` (`placesCount >= 5`, the site-wide indexing threshold) so the client and the sitemap never have to duplicate that rule. A location with 0 places is still returned normally by `GET /locations/resolve` (with `placesCount: 0`, `indexable: false`) — the client renders its own 404 rather than the API doing so, since the entity itself is real.

#### `GET /locations/resolve`

Resolves a location slug — or a pre-rebuild legacy numeric id — to the entity it names. One call handles every case the client's router needs for the first path segment after `/places/`: a current location, a merged/renamed location (301), or a category.

**Auth required:** No

**Query parameters:** either `slug`, or `type` + `legacyId`.

| Name | Type | Required | Description |
|------|------|----------|-------------|
| slug | string | One of `slug` / `legacyId` | The path segment to resolve |
| type | string | Required with `legacyId` | One of: `country`, `region`, `district`, `locality` |
| legacyId | integer | One of `slug` / `legacyId` | A pre-`locations:rebuild` numeric location id (e.g. from an old `?region=2` URL) |

**Response — a location:**

```json
{
  "type": "region",
  "id": 2,
  "slug": "bashkortostan",
  "title": "Башкортостан",
  "parents": [
    { "type": "country", "id": 1, "slug": "russia", "title": "Россия" }
  ],
  "placesCount": 132,
  "indexable": true
}
```

`title` is already localized to the request's `Locale` header, like every other endpoint. `parents` is ordered country → … → the immediate parent (not including the resolved entity itself) and is `[]` for a country.

**Response — a slug that has been superseded (merge, rename, qualification change):**

```json
{ "redirect": "bashkortostan" }
```

The client should 301 to `/places/{redirect}` (or `/places/{redirect}/{category}` if a category segment followed).

**Response — a slug that is a category name**, so the client can resolve any first path segment with one call:

```json
{ "type": "category", "name": "cave" }
```

**Response — `legacyId` lookup:** the same "a location" shape as above, resolved via `location_legacy_ids` (or the id itself, if it was never merged) — used to 301 old `/places?region=2`-style query URLs.

**Error responses:**

- `400` — Neither `slug` nor (`type` + `legacyId`) was given, or `type` is invalid
- `404` — The slug/id does not resolve to anything

---

#### `GET /locations/:type/:id/categories`

Place categories present in a location — any district/locality below it is included automatically, since every place carries its full country/region/district/locality chain — with per-category place counts. Powers the location page's category chips.

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| type | string | One of: `country`, `region`, `district`, `locality` |
| id | integer | Location entity ID |

**Response:**

```json
{
  "items": [
    { "name": "cave", "count": 18, "indexable": true },
    { "name": "mountain", "count": 15, "indexable": true },
    { "name": "abandoned", "count": 4, "indexable": false }
  ]
}
```

Ordered by `count` descending.

**Error responses:**

- `400` — Invalid `type` or missing/non-numeric `id`

---

#### `GET /locations/:type/:id/children`

Direct child locations, for perelinking: a country's regions, a region's districts plus the localities that have no district of their own, or a district's localities. Only children with at least one place are listed (an empty location has no page). A locality has no children (`items: []`).

**Auth required:** No

**Path parameters:** same as `GET /locations/:type/:id/categories`.

**Response:**

```json
{
  "items": [
    { "type": "district", "id": 22, "slug": "baymakskiy-rayon", "title": "Баймакский район", "placesCount": 41, "indexable": true },
    { "type": "locality", "id": 101, "slug": "gadelsha", "title": "Гадельша", "placesCount": 3, "indexable": false }
  ]
}
```

Ordered by `placesCount` descending.

**Error responses:**

- `400` — Invalid `type` or missing/non-numeric `id`

---

#### `GET /locations/:type/:id/summary`

Data for the location page's auto-generated description: total places, the top categories, and the most recent place's creation date.

**Auth required:** No

**Path parameters:** same as `GET /locations/:type/:id/categories`.

**Response:**

```json
{
  "placesCount": 132,
  "indexable": true,
  "categories": [
    { "name": "cave", "count": 18 },
    { "name": "mountain", "count": 15 }
  ],
  "lastAddedAt": "2026-09-30T14:22:00+00:00"
}
```

`categories` is capped at the top 5. `lastAddedAt` is `null` when the location has no places.

**Error responses:**

- `400` — Invalid `type` or missing/non-numeric `id`

---

### Categories

There is no categories table and no listing endpoint: the server only whitelists the keys (`app/Config/Categories.php`), the client owns names, texts and icons. A place's `category` is one of these language-neutral keys:

`mountain`, `cave`, `waterfall`, `spring`, `water`, `landscape`, `viewpoint`, `abandoned`, `industrial`, `military`, `castle`, `manor`, `architecture`, `religious`, `archeology`, `engineering`, `transport`, `memorial`, `artwork`, `disaster`, `mystic`, `museum`, `camping`.

#### `GET /categories/:name/locations`

Top locations for a category — cross-links on the category landing page ("this category by region").

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| name | string | Category name (e.g. `cave`) |

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| level | string | No | `region` (default) or `locality` |
| limit | integer | No | Max results (default 20, max 50) |

**Response:**

```json
{
  "items": [
    { "type": "region", "id": 5, "slug": "bashkortostan", "title": "Башкортостан", "placesCount": 18, "indexable": true }
  ]
}
```

Ordered by `placesCount` descending.

**Error responses:**

- `404` — Unknown category

---

### Search

#### `GET /search`

Full search: places by title/content, geocoder locations, and a coordinates entry. Queries of 2 characters or fewer return the empty shape.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| q | string | Yes | Search text, or a coordinate pair (decimal, DMS or DM, with or without N/S/E/W) |
| type | string | No | `all` (default), `places`, `location`, `coordinates` |
| category | string | No | Restrict places to category keys, comma-separated; unknown keys are ignored |
| sort | string | No | `relevance`, `distance`, `views`, `rating`, `comments`, `created_at`; default is distance when coordinates are known, otherwise relevance |
| order | string | No | `ASC` or `DESC`; default is the sort's natural direction (distance nearest first, the rest most first) |
| lat / lon | float | No | Viewer coordinates for `distance` |
| limit | integer | No | Max places (default 20, max 40) |
| offset | integer | No | Places offset (default 0) |

**Response:**

```json
{
  "locations": { "items": [{ "lat": 51.7686, "lon": 55.1014, "locality": "Gadelsha", "region": "Bashkortostan", "country": "Russia" }], "count": 1 },
  "places": { "items": [], "count": 227, "available": 50, "categories": { "cave": 120, "lake": 64 } },
  "coordinates": { "lat": 51.7686, "lon": 55.1014, "secondary": "Gadelsha, Bashkortostan, Russia" }
}
```

`locations.items` are geocoder results (up to 5, the `GET /location/geosearch` shape); `places.items` use the `GET /places` list shape. `places.count` is every found place with the category filter, `places.categories` every found place per category before it (the facets). Only the 50 most relevant places (with the filter) are sorted and paged: `places.available` is how many `offset` reaches. `coordinates` is the parsed query when it is a coordinate pair, otherwise the position of the first place or location found; it is absent when there is none.

---

#### `GET /search/suggest`

Autocomplete for the site header: up to 5 suggestions — a coordinates entry when the query parses as one, up to 2 places, up to 2 geocoder locations.

**Auth required:** No

**Query parameters:** `q` (string, more than 2 characters, otherwise the list is empty).

**Response:**

```json
{
  "suggestions": [
    { "type": "coordinates", "lat": 51.7686, "lon": 55.1014 },
    { "type": "place", "id": "a1b2c3d4e5f6g", "slug": "vodopad-gadelsha", "category": "waterfall", "title": "Waterfall Gadelsha" },
    { "type": "location", "title": "Gadelsha", "lat": 51.7686, "lon": 55.1014 }
  ]
}
```

---

### Stats

#### `GET /stats`

Site-wide counters.

**Auth required:** No

**Response:**

```json
{ "places": 1245, "unexplored": 830, "photos": 5120, "reviews": 2310 }
```

`unexplored` — open OSM candidates in the `known` and `explore` tiers; `reviews` — comments plus ratings.

---

### Collections

Author-curated public lists of places with a description. Any registered user may create one; only the owner and admins may edit, delete or manage its places. Hidden collections are excluded from lists and return `404` to everyone but the owner and admins.

#### `GET /collections`

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| region | integer | No | Filter by region ID |
| author | string | No | Filter by user ID |
| placeId | string | No | Only collections containing this place |
| sort | string | No | `updated` (default) or `popular` (places count, then views) |
| limit | integer | No | Max results (default 20, max 40) |
| offset | integer | No | Pagination offset (default 0) |

**Response:**

```json
{
  "items": [
    {
      "id": "c1c2c3c4c5c6c",
      "slug": "peshchery-bashkortostana",
      "title": "Caves of Bashkortostan",
      "author": { "id": "u1u2u3u4", "name": "traveler42", "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg" },
      "region": { "id": 5, "name": "Bashkortostan" },
      "placesCount": 8,
      "views": 120,
      "saves": 4,
      "featured": false,
      "updated": "2026-10-20T09:00:00+00:00",
      "created": "2026-09-01T09:00:00+00:00",
      "covers": [{ "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg", "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg" }],
      "cover": { "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg", "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg" }
    }
  ],
  "count": 14
}
```

`covers` — up to 4 covers of the first places with photos, in the author's order; `cover` is the first of them.

---

#### `GET /collections/:id`

One collection with its places in the author's order. Increments the view counter.

**Auth required:** No

**Response:** The list item shape plus `description`, `hidden`, `indexable` (for the robots meta tag only) and `places` — in the `GET /places` list shape, each with the author's `note` (or `null`).

**Error responses:**

- `404` — Not found or hidden

---

#### `GET /collections/membership`

The current user's own collections, each with a `contains` flag for a place. Feeds the "Add to collection" dialog.

**Auth required:** Yes

**Query parameters:** `placeId` (string, optional).

**Response:**

```json
{ "items": [{ "id": "c1c2c3c4c5c6c", "title": "Caves of Bashkortostan", "placesCount": 8, "cover": null, "contains": true }] }
```

---

#### `GET /collections/:id/recommended`

Places in the collection's region that are not in it yet, by rating. Empty when the collection has no region.

**Auth required:** No

**Query parameters:** `limit` (default 20, max 40).

**Response:** `{ "items": [ ... ], "count": 5 }` — `GET /places` list shape.

**Error responses:**

- `404` — Not found or hidden

---

#### `POST /collections`

Create a collection. Limited to 10 per user per 24 hours.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | 3–120 chars |
| description | string | No | Up to 20000 chars (Markdown, HTML stripped) |
| region | integer | No | Region ID |

**Response:** `201 Created` with `{ "id": "c1c2c3c4c5c6c", "slug": "peshchery-bashkortostana" }`

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors
- `429` — Daily limit reached

---

#### `PATCH /collections/:id`

Update `title`, `description` and/or `region` (same rules as create; `description` and `region` accept `null`). The slug follows the title.

**Auth required:** Yes (owner or admin)

**Response:** `200 OK`

**Error responses:** `401`, `403`, `404`, `400` (validation)

---

#### `DELETE /collections/:id`

**Auth required:** Yes (owner or admin)

**Response:** `200 OK`

**Error responses:** `401`, `403`, `404`

---

#### `PUT /collections/:id/places`

Add places to a collection; places already in it or not found are skipped.

**Auth required:** Yes (owner or admin)

**Request body (JSON):** `{ "placeIds": ["a1b2c3d4e5f6g", "h7i8j9k0l1m2n"] }` (up to 100)

**Response:**

```json
{ "added": ["a1b2c3d4e5f6g"], "skipped": ["h7i8j9k0l1m2n"], "placesCount": 9 }
```

**Error responses:** `401`, `403`, `404`, `400` (no `placeIds` or more than 100)

---

#### `PATCH /collections/:id/places`

Reorder the places and/or set a place's note.

**Auth required:** Yes (owner or admin)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| order | array | No | All place IDs of the collection in the new order (must be exactly the current set) |
| placeId | string | No | Place whose note to set |
| note | string \| null | No | Note for `placeId`, up to 500 chars |

**Response:** `200 OK`

**Error responses:** `401`, `403`, `404` (collection, or `placeId` not in it), `400` (empty body, wrong `order`, note too long)

---

#### `DELETE /collections/:id/places/:placeId`

Remove a place from a collection.

**Auth required:** Yes (owner or admin)

**Response:** `200 OK`

**Error responses:** `401`, `403`, `404`

---

#### `PATCH /collections/:id/moderation`

Hide or feature a collection.

**Auth required:** Yes (admin)

**Request body (JSON):** `{ "hidden": true, "featured": false }` (at least one)

**Response:** `200 OK`

**Error responses:** `401` (not authenticated or not an admin), `404`, `400` (nothing to update)

---

### Achievements

Achievement objects have `id`, `group_slug`, `type`, `tier`, `category`, `title` and `description` (in the request locale), `image`, `xp_bonus`, `season_start`, `season_end`, and `rules`.

#### `GET /achievements`

Active achievements. For an authenticated user each item also has `earned_at` (or `null`) and `progress`.

**Auth required:** No

**Query parameters:** `category`, `tier`, `type` (optional filters).

**Response:** `{ "data": [ ... ] }`

---

#### `GET /achievements/progress`

The current user's progress, keyed by achievement ID.

**Auth required:** Yes

**Response:** `{ "data": { "<achievementId>": { ... } } }`

---

#### `GET /achievements/:id`

One achievement, plus `is_active`.

**Auth required:** No

**Error responses:** `404` — Not found

---

#### `GET /users/:id/achievements`

All active achievements with that user's `earned_at` and `progress` (no `rules`).

**Auth required:** No

**Response:** `{ "data": [ ... ] }`

---

#### `GET /achievements/manage`

All achievements, inactive ones included, with both locales (`title_en`, `title_ru`, `description_en`, `description_ru`), `sort_order` and `is_active`.

**Auth required:** Yes (admin)

**Response:** `{ "data": [ ... ] }`

---

#### `POST /achievements`, `PUT /achievements/:id`, `DELETE /achievements/:id`

Admin CRUD. The body (JSON or form) takes `group_slug`, `type` (default `base`), `tier` (default `none`), `category`, `title_en`, `title_ru`, `description_en`, `description_ru`, `image`, `rules` (object), `season_start`, `season_end`, `xp_bonus`, `sort_order`, `is_active`; `PUT` updates only the fields sent. `POST` returns `201` with the stored row, `PUT` the updated row. `DELETE` deactivates an achievement that someone has earned, otherwise deletes it, and returns `{ "id": "..." }`.

**Auth required:** Yes (admin)

**Error responses:** `403` — not an admin; `404` — not found

---

#### `POST /achievements/:id/image`

Upload an achievement image: `multipart/form-data` field `image`, PNG or SVG, under 1 MB.

**Auth required:** Yes (admin)

**Response:** `{ "id": "...", "image": "uploads/achievements/<id>_<time>.png" }`

**Error responses:** `403`, `404`, `400` (no file, wrong type, too large)

---

### Sending Mail (admin)

#### `GET /sending-mail/manage`

The outgoing email queue. Statuses: `created` (waiting; `next_attempt_at` may hold it back), `process` (claimed by a `notifications:send` run), `completed`, `grouped` (went out inside the email of `groupId`), `error` (out of attempts, or the address does not exist), `rejected` (nothing to send, or the recipient turned the notification off; the reason is in `error`), `expired` (not sent within 3 days).

**Auth required:** Yes (admin)

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| status | string | No | Filter by status |
| email | string | No | Filter by recipient |
| date_from / date_to | string | No | Creation date range |
| sort | string | No | `created_at` (default), `updated_at`, `sent_at`, `status`, `email` |
| order | string | No | `asc` or `desc` (default `desc`) |
| page | integer | No | Page number (default 1) |
| limit | integer | No | Page size (default 20, max 100) |

**Response:**

```json
{
  "items": [
    {
      "id": "m1m2m3m4",
      "status": "completed",
      "email": "user@example.com",
      "subject": "New comment on “Gadelsha waterfall”",
      "type": "comment",
      "attempts": 1,
      "groupId": null,
      "created": { "date": "2026-10-01 10:00:00.000000", "timezone_type": 3, "timezone": "UTC" },
      "updated": { "date": "2026-10-01 10:01:00.000000", "timezone_type": 3, "timezone": "UTC" },
      "sent": { "date": "2026-10-01 10:01:00.000000", "timezone_type": 3, "timezone": "UTC" },
      "user": { "id": "u1u2u3u4", "name": "traveler42", "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg" },
      "activity": { "type": "comment" }
    }
  ],
  "count": 320,
  "limit": 20,
  "offset": 0,
  "stats": { "total": 320, "completed": 300, "error": 5, "pending": 15 }
}
```

**Error responses:** `403` — not an admin

---

#### `GET /sending-mail/manage/:id`

One email: the list item plus `message` and `error`, wrapped in `{ "data": { ... } }`.

**Auth required:** Yes (admin)

**Error responses:** `403`, `404`

---

### Sitemap

#### `GET /sitemap`

Returns the ids/slugs and last-modified timestamps of everything the client's XML sitemap (`client/pages/sitemap.tsx`) needs: places, indexable collections, and — for the landing pages — indexable categories, locations, and location×category pairs.

**Auth required:** No

**Response:**

```json
{
  "places": [
    { "id": "a1b2c3d4e5f6g", "slug": "vodopad-gadelsha", "updated": "2026-11-01T12:00:00+00:00" }
  ],
  "collections": [
    { "id": "c1c2c3c4c5c6c", "slug": "peshchery-bashkortostana", "updated": "2026-10-20T09:00:00+00:00" }
  ],
  "categories": [
    { "name": "cave", "updated": "2026-11-01T12:00:00+00:00" }
  ],
  "locations": [
    { "type": "region", "id": 2, "slug": "bashkortostan", "updated": "2026-11-01T12:00:00+00:00" }
  ],
  "locationCategories": [
    { "type": "region", "id": 2, "slug": "bashkortostan", "category": "cave", "updated": "2026-11-01T12:00:00+00:00" }
  ]
}
```

User profiles are `noindex`, so there is no `users` list. `categories`/`locations`/`locationCategories` only include entries with `placesCount >= 5` (the indexing threshold — see `GET /locations/resolve`); `updated` is the most recent `updated_at` among that entry's places. `collections` is already filtered to `hidden=false, indexable=true`. A `slug` is `null` for a location that has not been assigned one yet.

---

## CLI Commands

Spark commands (`php spark <command>`), not accessible over HTTP:

| Command | Description |
|---------|-------------|
| `notifications:send` | Send a batch of queued pushes, then of emails (an email skips an event a push already told about), and, once a day, delete queue rows older than 90 days and push devices that keep failing (`--cleanup` — now). Cron, every minute; overlapping runs are safe |
| `push:vapid` | Generate the VAPID keys for web push (paste into `.env`; once — new keys invalidate every subscription) |
| `system:test-email` | Send every kind of email with sample data to an address (`--locale`, `--kind`) |
| `email:preview` | Render every kind of email with sample data into `writable/email-preview/` |
| `system:generate-place-slugs` | Backfill place slugs from their titles |
| `content:revert` | Roll a place text back to an earlier revision |
| `feed:rebuild` | Regroup the activity log into feed stories (after changing the grouping rules) |
| `locations:rebuild` | Re-geocode every place, merge duplicate locations, assign slugs |
| `osm:collect` | Collect OSM candidates for the queued tiles (cron, every minute) |
| `osm:link-duplicates` | One-off: link the stored open candidates that duplicate our places to them |
| `osm:rescore` | Recalculate OSM candidate scores from the stored tags |
| `achievements:evaluate` | Evaluate and award achievements (by hand, `--all` after adding or changing an achievement; not scheduled) |
| `trending:refresh` | Refresh place trending scores |
| `interests:refresh` | Refresh user interest profiles |
| `digest:weekly` | Queue weekly digest emails (cron, weekly; skips users who got one in the last 6 days unless `--force`). `notifications:send` sends them within the hosting limits — 500 an hour, 2000 a day; the rest wait in the queue (up to 6 days) |
| `notifications:prune` | Delete toast-only and old read notifications (by hand, not scheduled) |
| `notifications:prune-service` | Delete notifications, pushes and emails of service accounts |
| `sessions:prune` | Delete stale anonymous sessions that left nothing behind (by hand, not scheduled) |

---

## Notes

- **IDs** — Place and user IDs are alphanumeric strings (not sequential integers). Place IDs are 13 characters long.
- **Locale** — The `Locale` header selects between Russian (`ru`, default) and English (`en`). Translated fields such as `title`, `content`, and address names respond in that locale (a place's `category` is a language-neutral key; the client translates it).
- **Image paths** — Image paths in responses are relative paths on the server; prepend the API base URL to construct absolute URLs. Linked external photos (Wikimedia Commons, PastVu) are the exception: their URLs are absolute.
- **Distance** — The `distance` field (km) uses the Haversine formula. It is only returned when the request includes `lat`/`lon` query parameters; the server never falls back to a stored location.
