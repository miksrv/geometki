# Geometki API Reference

The Geometki REST API is a CodeIgniter 4 PHP backend that powers the Geometki geospatial POI platform. All responses are JSON. The base URL in production is `https://geometki.com/` (append route paths directly, e.g. `https://geometki.com/places`). For local development the server runs on `http://localhost:8080/`.

---

## Authentication

Most read endpoints are public. Write operations require authentication.

**JWT Bearer token** — include the token returned by any auth endpoint in the `Authorization` header:

```
Authorization: Bearer <token>
```

A session-cookie fallback is also accepted for browser clients.

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
| 403  | Forbidden (already authenticated) |
| 404  | Not found |
| 500  | Server error |

---

## Endpoints

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

```json
{
  "name": "traveler42",
  "email": "user@example.com",
  "password": "securepassword"
}
```

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
    "avatar": null,
    "website": null,
    "reputation": 0,
    "settings": null
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Error responses:**

- `403` — User is already authenticated
- `400` — Validation errors (name taken, email taken, invalid format)

---

#### `POST /auth/login`

Authenticate with email and password.

**Auth required:** No (returns 403 if already authenticated)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Registered email address |
| password | string | Yes | Account password (8–50 chars) |

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** Same shape as `POST /auth/registration`.

**Error responses:**

- `403` — Already authenticated
- `400` — Invalid credentials or validation errors

---

#### `GET /auth/me`

Retrieve the currently authenticated user's profile and a fresh JWT token. Also updates the user's session.

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
    "avatar": "/uploads/avatars/a1b2c3d4e5f6g7h/photo_small.jpg",
    "website": "https://example.com",
    "reputation": 42,
    "settings": {
      "emailComment": true,
      "emailEdit": true,
      "emailPhoto": true,
      "emailRating": true,
      "emailCover": true
    },
    "levelData": {
      "level": 3,
      "title": "Explorer",
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
| sort | string | No | Sort field: `views`, `rating`, `comments`, `bookmarks`, `category`, `distance`, `created_at`, `updated_at` |
| order | string | No | Sort direction: `ASC` or `DESC` (default `DESC`) |
| category | string | No | Filter by category name (e.g. `historic`, `nature`) |
| author | string | No | Filter by user ID |
| country | integer | No | Filter by country ID |
| region | integer | No | Filter by region ID |
| district | integer | No | Filter by district ID |
| locality | integer | No | Filter by locality/city ID |
| tag | string | No | Filter by tag title (Russian or English) |
| search | string | No | Full-text search in place titles and content |
| bookmarkUser | string | No | Return only places bookmarked by this user ID |
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
      "lat": 51.7686,
      "lon": 55.1014,
      "rating": 4,
      "views": 312,
      "photos": 5,
      "comments": 3,
      "bookmarks": 7,
      "title": "Waterfall Gadelsha",
      "content": "Beautiful waterfall in the southern Urals...",
      "category": {
        "name": "nature",
        "title": "Nature"
      },
      "author": {
        "id": "u1u2u3u4",
        "name": "traveler42",
        "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
      },
      "address": {
        "country": { "id": 1, "name": "Russia" },
        "region": { "id": 5, "name": "Bashkortostan" },
        "district": { "id": 22, "name": "Baymaksky District" },
        "locality": { "id": 101, "name": "Gadelsha" }
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

Note: `distance` (km) is only present when `lat`/`lon` query parameters are provided or when the user session has a known location. `cover` is only present when a cover image exists. `address` sub-fields are only present when geocoding data is available.

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
  "category": {
    "name": "nature",
    "title": "Nature"
  },
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
  "tags": ["waterfall", "nature", "ural"],
  "address": {
    "country": { "id": 1, "name": "Russia" },
    "region": { "id": 5, "name": "Bashkortostan" },
    "district": { "id": 22, "name": "Baymaksky District" },
    "locality": { "id": 101, "name": "Gadelsha" },
    "street": "near village Gadelsha"
  },
  "cover": {
    "full": "/uploads/photos/a1b2c3d4e5f6g/cover.jpg",
    "preview": "/uploads/photos/a1b2c3d4e5f6g/cover_preview.jpg"
  },
  "distance": 12.4
}
```

**Error responses:**

- `404` — Place not found

---

#### `POST /places`

Create a new place.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Place title (8–200 chars) |
| category | string | Yes | Category name (must exist in `category` table) |
| lat | float | Yes | Latitude (min 3 chars) |
| lon | float | Yes | Longitude (min 3 chars) |
| content | string | No | Description text (HTML stripped) |
| tags | array | No | Array of tag strings |
| photos | array | No | Array of temporary photo filenames to attach |

```json
{
  "title": "Waterfall Gadelsha",
  "category": "nature",
  "lat": 51.7686,
  "lon": 55.1014,
  "content": "Beautiful waterfall in the southern Urals.",
  "tags": ["waterfall", "ural"],
  "photos": ["tmpfile123.jpg", "tmpfile456.jpg"]
}
```

**Response:**

```json
{
  "id": "a1b2c3d4e5f6g"
}
```

Note: If a place already exists at the same coordinates for the same user, its ID is returned without creating a duplicate.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or geocoder failure

---

#### `PATCH /places/:id`

Update an existing place's content, category, coordinates, or tags.

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
| category | string | New category name |
| lat | float | New latitude |
| lon | float | New longitude |
| tags | array | Replacement tag list |

```json
{
  "title": "Updated Place Title",
  "content": "Updated description.",
  "tags": ["updated", "tag"]
}
```

**Response:**

```json
{
  "content": "Updated description.",
  "tags": ["updated", "tag"]
}
```

Note: The `tags` key is only present in the response when `tags` was included in the request. If the same author edits within 3 months, the existing content version is overwritten; otherwise a new version is created.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or place not found

---

#### `PATCH /places/cover/:id`

Set the cover image for a place by cropping an existing uploaded photo.

**Auth required:** Yes

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photoId | string | Yes | ID of the photo to use as cover |
| x | integer | Yes | Crop origin X (pixels) |
| y | integer | Yes | Crop origin Y (pixels) |
| width | integer | Yes | Crop width (pixels) |
| height | integer | Yes | Crop height (pixels) |

```json
{
  "photoId": "p1p2p3p4",
  "x": 100,
  "y": 50,
  "width": 1280,
  "height": 720
}
```

**Response:** `200 OK` with empty body on success.

**Error responses:**

- `401` — Not authenticated
- `400` — Missing fields, image dimensions too small/large, place or photo not found

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
| bounds | string | No | Viewport bounding box: `lon_left,lat_top,lon_right,lat_bottom` |
| categories | string | No | Comma-separated list of category names to filter |
| author | string | No | Filter by user ID |
| zoom | integer | No | Map zoom level used for clustering (default 10) |
| cluster | boolean | No | Set `true` to receive clustered markers |

**Response (unclustered):**

```json
{
  "count": 3,
  "items": [
    { "id": "a1b2c3d4e5f6g", "category": "nature", "lat": 51.7686, "lon": 55.1014 },
    { "id": "h7i8j9k0l1m2n", "category": "historic", "lat": 52.2865, "lon": 56.8412 }
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
| bounds | string | No | Viewport bounding box: `lon_left,lat_top,lon_right,lat_bottom` |
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

#### `GET /poi/users`

Get the geo-coordinates of recently active user sessions for heatmap display. Returns up to 500 coordinate pairs.

**Auth required:** No

**Response:**

```json
{
  "items": [
    [51.7686, 55.1014],
    [55.7558, 37.6173]
  ]
}
```

---

#### `GET /poi/:id`

Get lightweight details for a single place (used as map popup data).

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Response:**

```json
{
  "id": "a1b2c3d4e5f6g",
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
  }
}
```

**Error responses:**

- `404` — Place not found

---

### Photos

#### `GET /photos`

List photos with optional filtering and pagination.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| place | string | No | Filter by place ID |
| author | string | No | Filter by user ID |
| limit | integer | No | Max results (default 40, max 40) |
| offset | integer | No | Pagination offset (default 0) |

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
      "created_at": "2025-03-01T10:00:00+00:00",
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

---

#### `POST /photos/upload/temporary`

Upload a photo to the temporary holding area before a place has been created. Returns a temporary file reference.

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

Upload a photo directly to an existing place.

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

#### `POST /photos`

Attach previously uploaded temporary photos to a place (batch operation).

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| placeId | string | Yes | Target place ID |
| photos | array | Yes | Array of temporary filenames |

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

### Users

#### `GET /users`

List users, ordered by recent activity.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
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
        "title": "Explorer",
        "experience": 150,
        "nextLevel": 300
      },
      "reputation": 42,
      "created": "2024-01-15T10:00:00+00:00",
      "activity": "2025-11-10T08:00:00+00:00"
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
    "title": "Explorer",
    "experience": 150,
    "nextLevel": 300
  },
  "statistic": {
    "places": 12,
    "photos": 45,
    "comments": 8,
    "ratings": 30
  },
  "settings": {
    "emailComment": true,
    "emailEdit": true,
    "emailPhoto": true,
    "emailRating": true,
    "emailCover": true
  }
}
```

Note: `settings` is only included when the requesting user is viewing their own profile (session user ID matches `id`).

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
| settings | object | Notification preferences (all booleans) |

```json
{
  "name": "newname",
  "website": "https://myblog.com",
  "oldPassword": "currentpass",
  "newPassword": "newpass123",
  "settings": {
    "emailComment": true,
    "emailEdit": false,
    "emailPhoto": true,
    "emailRating": true,
    "emailCover": false
  }
}
```

**Response:** `200 OK` with empty body.

**Error responses:**

- `401` — Not authenticated or not own profile
- `400` — Validation errors, old password incorrect, nothing to update

---

#### `POST /users/avatar`

Upload a new avatar image. The file is stored temporarily and a crop step is required next.

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

```json
{
  "filename": "u1u2u3u4.jpg",
  "x": 50,
  "y": 20,
  "width": 300,
  "height": 300
}
```

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
  "vote": 5
}
```

Note: `vote` is only present if the current session or user has previously voted on this place.

---

#### `GET /rating/history`

Get the rating history for a place or user.

**Auth required:** No

**Query parameters (exactly one required):**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| placeId | string | No | Place ID — returns rating history with voter info |
| userId | string | No | User ID — returns rating history for that user |

**Response:**

```json
{
  "count": 3,
  "items": [
    {
      "value": 5,
      "created_at": "2025-10-15T14:30:00+00:00",
      "author": {
        "id": "u1u2u3u4",
        "name": "traveler42",
        "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
      }
    }
  ]
}
```

Note: `author` is only present when querying by `placeId`.

**Error responses:**

- `400` — Both parameters provided, or neither provided

---

#### `PUT /rating`

Submit or update a rating for a place.

**Auth required:** No (session-based voting is allowed for unauthenticated users)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| place | string | Yes | Place ID |
| score | integer | Yes | Rating value (positive integer, typically 1–5) |

```json
{
  "place": "a1b2c3d4e5f6g",
  "score": 5
}
```

**Response:** `201 Created` for new vote, `200 OK` for updated vote.

**Error responses:**

- `400` — Missing data
- `404` — Place not found

---

### Comments

#### `GET /comments`

List comments for a place.

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
| comment | string | Yes | Comment text (HTML stripped) |
| answerId | string | No | ID of the comment being replied to (exactly 13 chars) |

```json
{
  "placeId": "a1b2c3d4e5f6g",
  "comment": "Great place! Highly recommend visiting.",
  "answerId": null
}
```

**Response:** `201 Created` with empty body.

**Error responses:**

- `401` — Not authenticated
- `400` — Validation errors or place not found

---

#### `GET /comments/unsubscribe`

Unsubscribe a user from email notifications via a link sent in email. (Note: this route is registered under the `comments` group in Routes.php.)

**Auth required:** No

---

### Activity

#### `GET /activity`

List site-wide activity feed, grouped by user and place. Results are paginated and support filtering.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| author | string | No | Filter by user ID |
| place | string | No | Filter by place ID |
| date | string | No | Return activities older than this date |
| limit | integer | No | Max groups (default 9, max 40) |
| offset | integer | No | Pagination offset (default 0) |

**Response:**

```json
{
  "items": [
    {
      "type": "photo",
      "views": 5,
      "created": "2025-11-05T12:00:00+00:00",
      "author": {
        "id": "u1u2u3u4",
        "name": "traveler42",
        "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
      },
      "place": {
        "id": "a1b2c3d4e5f6g",
        "title": "Waterfall Gadelsha",
        "content": "Beautiful waterfall...",
        "difference": 0,
        "category": {
          "name": "nature",
          "title": "Nature"
        }
      },
      "photos": [
        {
          "full": "/uploads/photos/a1b2c3d4e5f6g/img001.jpg",
          "preview": "/uploads/photos/a1b2c3d4e5f6g/img001_preview.jpg",
          "width": 400,
          "height": 300,
          "placeId": "a1b2c3d4e5f6g"
        }
      ]
    }
  ]
}
```

Activity `type` values: `place` (new place created), `edit` (place content updated), `photo` (photo uploaded), `rating` (place rated), `comment` (comment posted), `cover` (cover image set).

---

#### `GET /activity/:id`

Get activity details for a specific activity record. (Route exists but no dedicated `show` method was implemented in the Activity controller; the base ResourceController behavior applies.)

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Activity ID |

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

#### `PUT /bookmarks`

Toggle a bookmark for a place. If the bookmark exists it is removed; otherwise it is added.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| placeId | string | Yes | Place ID |

```json
{ "placeId": "a1b2c3d4e5f6g" }
```

**Response:** `201 Created` when added, `200 OK` when removed.

**Error responses:**

- `401` — Not authenticated
- `400` — No `placeId` provided
- `404` — Place not found

---

### Visited

#### `GET /visited/:id`

Get the list of users who have marked a place as visited.

**Auth required:** No

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string (alphanum) | Place ID |

**Response:**

```json
{
  "items": [
    {
      "id": "u1u2u3u4",
      "name": "traveler42",
      "avatar": "photo_small.jpg"
    }
  ]
}
```

---

#### `PUT /visited`

Toggle a "visited" mark for a place. If already marked as visited, the mark is removed.

**Auth required:** Yes

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| place | string | Yes | Place ID |

```json
{ "place": "a1b2c3d4e5f6g" }
```

**Response:** `201 Created` when marked, `200 OK` when unmarked.

**Error responses:**

- `401` — Not authenticated
- `400` — No place ID provided
- `404` — Place not found

---

### Notifications

All notification endpoints require authentication. The controller exits immediately (no response) if the user is not authenticated.

#### `GET /notifications/updates`

Get notifications from the last 15 minutes that have not yet been read (for Snackbar/toast display). Also returns a count of older unread notifications. All returned notifications are marked as read.

**Auth required:** Yes

**Response:**

```json
{
  "items": [
    {
      "id": "n1n2n3n4",
      "type": "notification",
      "activity": "comment",
      "meta": null,
      "created": "2025-11-10T08:55:00+00:00",
      "read": false,
      "place": {
        "id": "a1b2c3d4e5f6g",
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

Note: `count` is the number of unread notifications older than 15 minutes (shown as a badge). `place` is omitted for `level` and `achievements` notification types.

---

#### `GET /notifications/list`

Get a paginated list of all notifications for the current user. All returned unread notifications are marked as read.

**Auth required:** Yes

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| limit | integer | No | Max results (default 10) |
| offset | integer | No | Pagination offset (default 0) |

**Response:** Same shape as `GET /notifications/updates`.

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

**Error responses:**

- `400` — No search text provided

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
      "address": "Gadelsha, Baymaksky District, Bashkortostan, Russia"
    }
  ]
}
```

**Error responses:**

- `400` — No search text provided

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

**Error responses:**

- `400` — Invalid or missing `type` parameter

---

#### `PUT /location`

Update the current user session's geographic coordinates. Used to improve distance calculations and the heatmap of active users.

**Auth required:** No (session-based)

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| lat | float | Yes | Latitude |
| lon | float | Yes | Longitude |

```json
{ "lat": 51.7686, "lon": 55.1014 }
```

**Response:** `200 OK` with empty body.

---

### Categories

#### `GET /categories`

List all place categories. Optionally includes a count of places per category.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| places | boolean | No | Set `true` to include place counts and category descriptions |

**Response:**

```json
{
  "items": [
    {
      "name": "nature",
      "title": "Nature",
      "content": "Natural landscapes and features",
      "count": 342
    }
  ]
}
```

Note: `content` and `count` are only included when `places=true`.

---

### Tags

#### `GET /tags`

List all tags, ordered by usage count descending.

**Auth required:** No

**Response:**

```json
{
  "items": [
    {
      "title": "waterfall",
      "count": 45,
      "updated": "2025-10-01T00:00:00+00:00"
    }
  ]
}
```

---

#### `GET /tags/search`

Search for up to 10 tags matching a text string. Used for autocomplete.

**Auth required:** No

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | Search string (1–29 chars) |

**Response:**

```json
{
  "items": ["waterfall", "water", "watermill"]
}
```

---

### Levels

#### `GET /levels`

List all gamification levels with experience thresholds, activity modifier values, and the users currently at each level.

**Auth required:** No

**Response:**

```json
{
  "awards": {
    "place": 10,
    "photo": 5,
    "rating": 2,
    "cover": 3,
    "edit": 4,
    "comment": 1
  },
  "items": [
    {
      "experience": 0,
      "level": 1,
      "title": "Newbie",
      "count": 120,
      "users": [
        {
          "id": "u1u2u3u4",
          "name": "traveler42",
          "avatar": "/uploads/avatars/u1u2u3u4/photo_small.jpg"
        }
      ]
    }
  ]
}
```

---

### Sitemap

#### `GET /visited`

Returns all place IDs and user IDs with their last update timestamps for sitemap generation.

**Auth required:** No

Note: Despite the URL path `/visited`, this endpoint is served by the `Sitemap` controller due to a route group name collision in `Routes.php`.

**Response:**

```json
{
  "places": [
    { "id": "a1b2c3d4e5f6g", "updated": "2025-11-01T12:00:00+00:00" }
  ],
  "users": [
    { "id": "u1u2u3u4", "updated": "2025-11-10T08:00:00+00:00" }
  ]
}
```

---

## CLI Commands (System)

These are CLI-only commands run via `php index.php system <command>`. They are not accessible over HTTP.

| Command | Description |
|---------|-------------|
| `php index.php system recalculate_tags_count` | Recalculates and updates the usage counter on all tags |
| `php index.php system generate_users_online` | Randomly updates activity timestamps for demo/bot users to simulate online presence |
| `php index.php system send_email` | Processes the outbound email queue (subject to daily/monthly limits) |

---

## Notes

- **IDs** — Place and user IDs are alphanumeric strings (not sequential integers). Place IDs are 13 characters long.
- **Locale** — The `Accept-Language` header (or CI4's locale detection) selects between Russian (`ru`, default) and English (`en`). Translated fields such as `title`, `content`, `category.title`, and address names respond in the detected locale.
- **Image paths** — All image paths in responses are relative paths on the server. Prepend the API base URL to construct absolute URLs.
- **Distance** — The `distance` field (km) uses the Haversine formula. It is only returned when either the request includes `lat`/`lon` query parameters or the session has a stored location from `PUT /location`.
