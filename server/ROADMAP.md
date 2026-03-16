# Server Roadmap

This document catalogues bugs, security vulnerabilities, performance issues, code quality problems, API design gaps, and testing deficiencies found in the CodeIgniter 4 PHP API located in `app/`.

---

## Bugs

- **#1 [Controllers/Places.php:575]** `delete()` uses the wrong logical operator for the admin check. The condition `!$this->session->isAuth && $this->session->user->role !== 'admin'` should be `||`. As written, a non-authenticated user passes the check because `$this->session->user` is `null` and PHP will throw a fatal error, not enforce the guard. The intent is clearly "must be logged in AND must be admin".

- **#2 [Controllers/Bookmarks.php:89]** Bookmark increment sets the count to the literal integer `1` instead of `$bookmarksCount + 1`. The line `'bookmarks' => $bookmarksCount = 1` is a variable assignment, not addition. Every bookmark add resets the counter to 1.

- **#3 [Controllers/Photos.php:303]** `rotate()` returns `respondDeleted()` for a successful rotation. This is semantically wrong — nothing was deleted. The correct response is `respondUpdated()` or `respond()`.

- **#4 [Controllers/PhotosTemporary.php:95]** The temporary photo upload response returns the same path for both `full` and `preview` keys: `PATH_TEMPORARY . $name . '.' . $ext`. The preview should be `PATH_TEMPORARY . $name . '_preview.' . $ext`.

- **#5 [Controllers/Places.php:247]** `list()` executes `_makeListFilters()` twice — once to fetch rows and once to count. Because the model query builder is stateful and mutated between calls, the second call rebuilds an entirely new query chain (without the same joins and selects from the first call). The count can therefore be inaccurate or throw errors depending on the query state.

- **#6 [Controllers/Rating.php:138]** The `$placesData` null check comes *after* `$placesData->user_id` is already dereferenced on line 131. If a place does not exist, the code fatals before reaching `return $this->failNotFound()`.

- **#7 [Controllers/Tags.php:72]** `search()` references `$item->title_en` inside the response-building loop, but the loop variable is `$tag`, not `$item`. This will generate an "undefined variable `$item`" notice and always fall back to the `title_ru` branch.

- **#8 [Routes.php:47]** The route `$routes->post('upload/(:alphanum)', 'Photos::upload/$1')` is registered twice (lines 46–47). The duplicate silently shadows itself and can cause confusion during debugging.

- **#9 [Routes.php:179]** The Sitemap route group is registered under `visited` instead of `sitemap`. `GET /visited/` maps to `Sitemap::index`, making the sitemap endpoint unreachable at the intended URL and polluting the `visited` namespace.

- **#10 [Controllers/Places.php:728]** `savePhotos()` updates the place `photos` count to `$photoCount` (the number of photos just uploaded in the current batch) rather than adding to the existing count. If a place already has photos, calling this function resets the counter to the batch size.

- **#11 [Libraries/SessionLibrary.php:49-55]** When no auth token is present, the session lookup uses `orWhere('user_ip', $this->ip)` alongside the session ID check. This means any request from the same IP address as a known session will inherit that session, including its user coordinates, even if no session header was sent. This allows IP-based session fixation/hijacking on shared networks (NAT, corporate proxies).

---

## Security

- **#12 [Filters/CorsFilter.php:26]** `Access-Control-Allow-Origin: *` is set unconditionally, allowing any origin to make cross-origin requests with credentials. For an API that uses `Authorization` and `Session` headers this is acceptable for public read endpoints, but write endpoints (POST/PATCH/PUT/DELETE) should restrict the allowed origin to the known frontend domain. The wildcard also prevents the browser from sending cookies with credentialed requests if that is ever needed.

- **#13 [Filters/CorsFilter.php:33]** Preflight OPTIONS responses are terminated with `die()` instead of using CodeIgniter's response object. This bypasses all framework shutdown hooks, logging, and may produce a 200 with an empty body depending on the server configuration. Use `return Services::response()->setStatusCode(204)->send(); exit();` or the framework's built-in CORS filter.

- **#14 [Controllers/Auth.php:246]** `generateAuthToken()` is called with `$this->session->user->email` in `me()`. If `$this->session->user` is `null` (unauthenticated user), this fatals. More critically, the token is regenerated on every `GET /auth/me` call, which means the JWT expiry (`auth.token.live`) is never actually enforced — the token is perpetually refreshed. Consider returning the existing token or only refreshing when it is close to expiry.

- **#15 [Helpers/auth_helper.php:generateAuthToken]** The JWT payload contains only `email` as the identity claim with no `sub` or user ID. If a user changes their email address the old tokens become permanently invalid with no graceful handling. The `iat`/`exp` claims are present but the token live duration is read from `getenv('auth.token.live')` with no fallback — if the env var is missing the expiry time becomes `0` (Unix epoch), making all tokens immediately expired or a very large number depending on PHP's `time() + 0` behavior.

- **#16 [Controllers/Users.php:175]** The password change flow calls `$validatePassword->password` without first checking whether `$validatePassword` is `null`. If the user has no `auth_type = 'native'` row (OAuth-only user), the query returns `null` and this fatals with "trying to get property of null", leaking a stack trace.

- **#17 [Controllers/PhotosTemporary.php:117-123]** `delete()` accepts a filename via the URL parameter `(:any)` and calls `unlink()` directly with `UPLOAD_TEMPORARY . $id` after only checking file existence. There is no validation that `$id` is a safe filename — a path-traversal payload like `../../../etc/passwd` would pass the `file_exists` check if the file exists and then attempt to `unlink` it. The `(:any)` route constraint allows `/`, `.` and other path characters.

- **#18 [Controllers/PhotosTemporary.php:117]** Same path-traversal risk applies in `rotate()` on line 139. The `$id` parameter from the URL is used directly in `file_exists(UPLOAD_TEMPORARY . $id)` and `new File(UPLOAD_TEMPORARY . $id)`.

- **#19 [Controllers/Users.php:286]** The `crop()` method checks `file_exists(UPLOAD_TEMPORARY . $input->filename)` where `$input->filename` is taken directly from the JSON request body with no path sanitisation. An attacker can supply a filename with directory traversal sequences to crop or overwrite arbitrary files accessible to the web server process.

- **#20 [Libraries/PlacesContent.php:47]** The `$this->trim` value is inserted directly into a raw SQL `SUBSTRING` expression without any cast or validation. Although it is typed as `int` in the constructor signature, PHP does not enforce this at runtime. Any non-integer value that bypasses the type hint would be injected into SQL. Cast to `(int)` explicitly before embedding in the query.

- **#21 [Models/PlacesModel.php:93]** `makeDistanceSQL()` interpolates the `$lat` and `$lon` float values directly into a raw SQL string. While floats cannot carry SQL injection payloads in the traditional sense, the values come from user-supplied GET parameters (cast with `FILTER_VALIDATE_FLOAT` in the controller, which can still pass `NaN` or `INF` on some PHP versions). Prefer parameterised query binding.

- **#22 [Config/Filters.php:74]** CSRF protection is explicitly commented out (`// 'csrf'`). For a pure JSON API with JWT authentication this is acceptable if `SameSite=Strict` cookies are not used, but the decision should be documented. Additionally, `secureheaders` is also disabled in the `after` filters, meaning no `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers are sent.

- **#23 [Controllers/Mail.php:unsubscribe]** The unsubscribe endpoint looks up a sending-mail record by its integer ID provided as a GET parameter. It then silently modifies the settings of the *owner of the place* associated with that email. There is no authentication check — any unauthenticated user who guesses or enumerates a `mail` ID can unsubscribe any user from any notification type. Email unsubscribe tokens should be single-use signed values, not database primary keys.

- **#24 [Controllers/System.php]** `set_time_limit(0)` is called at file-include time (line 17), not scoped to any particular method. This disables the execution time limit globally for the entire process whenever this controller file is loaded, including during potential misuse.

- **#25 [Libraries/SessionLibrary.php:36-39]** The Node.js internal bypass — `if ($this->request->getUserAgent()->getAgentString() === 'node')` — relies entirely on a user-agent string that any HTTP client can trivially spoof. If the server-to-server calls are trusted, use a shared secret header or IP allowlist instead.

---

## Performance

- **#26 [Controllers/Users.php:show]** Every call to `GET /users/:id` recalculates the user's reputation from scratch by loading all of their places and all rating rows, then running a full loop. This is an unbounded query — a user with hundreds of places triggers `SELECT * FROM rating WHERE place_id IN (...)` with potentially thousands of rows on every profile view. The result is then compared and written back to the database on every request even when nothing has changed. Move reputation recalculation to an async job or trigger it only on rating events.

- **#27 [Controllers/Places.php:list + Photos.php:list]** Both list endpoints execute `_makeListFilters()` twice per request: once for the data and once for the count. Each call reconstructs the full query with all joins. Use a single query with `SQL_CALC_FOUND_ROWS` / `FOUND_ROWS()`, or use a subquery for the count, or use `$model->paginate()`.

- **#28 [Database/Migrations]** No indexes are defined in any migration file beyond primary keys and foreign keys. High-traffic query columns that lack indexes include: `places.category`, `places.user_id`, `places.lat`/`lon` (used in bounding-box filters), `activity.user_id`, `activity.place_id`, `activity.created_at`, `rating.place_id`, `comments.place_id`, `users_notifications.user_id`, `users_notifications.read`. Add a migration adding these indexes.

- **#29 [Libraries/LevelsLibrary.php:__construct]** `new LevelsLibrary()` is instantiated in multiple places (e.g., `Users::list()` inside a loop, `Users::show()`). Each construction triggers `SELECT * FROM users_levels ORDER BY experience`. This query runs once per instantiation. Cache the result in a static property or use CI4's cache service.

- **#30 [Libraries/LevelsLibrary.php:calculate]** `calculate()` loads the *entire* activity table for a given user (`SELECT type FROM activity WHERE user_id = ?`) with no limit. For highly active users this returns an unbounded number of rows just to count rows by type. Use aggregated SQL (`SELECT type, COUNT(*) FROM activity WHERE user_id = ? GROUP BY type`) instead.

- **#31 [Libraries/ActivityLibrary.php:_add]** On every activity event, `_add()` instantiates a fresh `SessionLibrary` which itself opens a database connection and queries the sessions table. This means any action that triggers multiple activity entries (e.g., uploading multiple photos at place creation) fires multiple redundant session queries. The session object should be passed in rather than re-instantiated.

- **#32 [Controllers/Activity.php:addNextActivityItems]** `addNextActivityItems()` is recursive and calls `getNextActivityItems()` on each recursion. With a large, dense activity log this can generate a large number of sequential database round-trips. There is no depth limit or maximum recursion guard.

- **#33 [Controllers/Notifications.php:list + updates]** `_formatNotifyList()` calls `file_exists()` in a loop for every notification that has a place, performing a filesystem stat per item. Cache cover existence or persist cover availability as a boolean flag on the place record.

---

## Code Quality

- **#34 [Controllers/Auth.php:264]** `validateRequest()` and `getRequestInput()` are defined on the `Auth` controller but are duplicated in `Places::create()` and `Places::update()` which use `validateData()` instead. There is no shared base controller or trait for input handling. Consider extracting a `ApiController` base class or a `ValidatesRequests` trait.

- **#35 [Models/ApplicationBaseModel.php:generateId]** IDs are generated with `uniqid()` which is based on microsecond timestamp and is **not** collision-safe under concurrent inserts. Under high load two simultaneous inserts can produce the same ID. Use `uniqid('', true)` (already done in `SessionLibrary` but not the model), or better, use ULIDs or UUIDs (`Ramsey\Uuid` or PHP 8.2's `uuid_create`).

- **#36 [Controllers/Notifications.php:__construct:exit()]** Returning 401 by calling `exit()` in the constructor is incorrect. It returns a 200 OK with an empty body. Use `return $this->failUnauthorized()` in each action method, or implement a before-filter for authenticated routes.

- **#37 [Controllers/Places.php:create + update]** The `lat` and `lon` validation rules use `min_length[3]` which is a string-length check, not a numeric range check. A value of `"0.0"` has a length of 3 and passes, but so does `"abc"` if it were somehow not caught by the `numeric` rule. Use `decimal` or `greater_than`/`less_than` rules appropriate for coordinate values.

- **#38 [Controllers/Activity.php:groupSimilarActivities]** `$categoriesModel->findAll()` is called on every invocation of `groupSimilarActivities()`, loading the full categories table. This should be called once and cached or injected.

- **#39 [Controllers/System.php:calculateTagsCount]** Issues N+1 queries: one `SELECT` for all tags, then one `SELECT COUNT(*)` per tag in a loop. Replace with a single aggregation query: `SELECT tag_id, COUNT(*) FROM places_tags GROUP BY tag_id`.

- **#40 [Routes.php:78]** The Mail unsubscribe route is registered under the `comments` group (`$routes->group('comments', ...)`) instead of a `mail` group. This means the route is `/comments/unsubscribe` which conflicts with the comments group defined above it and is misleading.

- **#41 [Controllers/Places.php:_editors + multiple controllers]** Avatar path construction (`explode('.', $avatar)` then `$avatar[0] . '_small.' . $avatar[1]`) is copy-pasted across at least 8 locations: `Places::list`, `Places::show`, `Places::_editors`, `Photos::list`, `Rating::history`, `Comments::list`, `Activity::groupSimilarActivities`, `Users::list`, `Users::show`. This should be a single helper function.

- **#42 [Models/ApplicationBaseModel.php:skipValidation]** All models set `$skipValidation = true`, meaning model-level validation rules defined in `$validationRules` are never enforced. This makes the validation rules dead code and shifts all validation responsibility to controllers, where coverage is inconsistent.

- **#43 [Controllers/Places.php:update:488]** The "place not found" error message is a hardcoded English string `'There is no point with this ID'` rather than using the language file (`lang('Places.notFound')`). Several other places in the codebase also mix hardcoded strings with `lang()` calls.

- **#44 [Libraries/Geocoder.php]** `coordinates()` makes two full HTTP requests to Nominatim (one for English, one for Russian) synchronously on every place create/update. This adds significant latency to user-facing write operations and introduces a hard dependency on an external service with no timeout configuration on the `GuzzleHttp\Client`.

- **#45 [Controllers/Photos.php:upload:139-140]** The "Calculating Aspect Ratio" logic swaps `$width` and `$height` based on orientation but the resulting values are incorrect: for a vertical image, `$width` is set to `$height` and `$height` is set to the original `$width`, effectively inverting the dimensions rather than normalising them. The same logic appears in `PhotosTemporary::upload` (line 66-68) and `Users::avatar` (line 236-238).

---

## API Design

- **#46** There is no global rate limiting on any endpoint. Authentication endpoints (`POST /auth/login`, `POST /auth/registration`) are particularly sensitive and have no brute-force protection. Implement a rate-limit filter (e.g., using CI4's throttler) applied at minimum to auth and write endpoints.

- **#47** `DELETE /notifications` (clear all) returns `respondDeleted(['items' => [], 'count' => 0])`. The body on a DELETE response is non-standard. More importantly, there is no way to delete a single notification by ID — the only option is to clear all, which is destructive.

- **#48** `PUT /rating` is used for both creating a new rating and updating an existing one. The HTTP method `PUT` implies idempotent replacement of a resource at a known URL. Using `POST /rating` for creation and `PATCH /rating/:id` for updates would be more semantically correct. Additionally, the endpoint swallows all exceptions and returns `failNotFound()` for any internal error (line 188), masking real server errors as 404.

- **#49** The `GET /places` list endpoint has no maximum offset limit. A caller can set `offset=9999999` which, combined with the sort and join queries, will cause the database to scan and discard a huge number of rows. Implement cursor-based pagination or cap the offset.

- **#50** `GET /comments` has no pagination. It returns all comments for a place in a single query with `findAll()` and no limit. A place with thousands of comments will return the entire set. Add `limit`/`offset` parameters and return a `count` based on a separate `countAllResults()`.

- **#51** HTTP status codes are inconsistent for validation errors. `failValidationErrors()` returns 422, but several places return validation-style errors for resource-not-found conditions (e.g., `Photos::delete` line 228 uses `failValidationErrors` when the photo is not found instead of `failNotFound`). Define a consistent error taxonomy.

- **#52** The `GET /poi/users` endpoint returns the raw latitude/longitude of all active user sessions — up to 500 records — without any authentication. This exposes the approximate real-time location of all users to any unauthenticated caller.

- **#53** `PATCH /places/cover/:id` does not verify that the requesting user owns the place or has edit rights. Any authenticated user can set the cover photo of any place to any photo by providing an arbitrary `photoId`.

- **#54** The `FILTER_SANITIZE_STRING` constant is used in `Location::search` and `Tags::search`. This constant was deprecated in PHP 8.1 and removed in PHP 8.2. It silently becomes `FILTER_DEFAULT` (which does nothing useful) or triggers a warning depending on the PHP version. Replace with explicit `htmlspecialchars()` / `strip_tags()` calls or `FILTER_SANITIZE_SPECIAL_CHARS`.

---

## Testing

- **#55 [tests/]** There are zero application-specific tests. The test suite contains only the CodeIgniter framework scaffold files (`ExampleDatabaseTest.php`, `ExampleSessionTest.php`, `HealthTest.php`). No controller, model, library, or helper logic is tested. The `phpunit.xml.dist` has the database test environment commented out, so even the scaffold database test cannot run without manual configuration.

- **#56 [Controllers/Auth.php]** The authentication flow — registration, login, JWT validation, OAuth service auth — has no test coverage. These are the highest-risk, highest-value paths in the application. At minimum, tests should cover: successful login returns a valid JWT, wrong password returns 422, duplicate email returns 422, expired JWT returns 401, OAuth profile with missing email returns 422.

- **#57 [Controllers/Places.php:delete]** The `delete()` authorization logic (bug #1 above) is a critical path with no test. A test would have caught the `&&` vs `||` error immediately.

- **#58 [Libraries/SessionLibrary.php]** The session resolution logic — which determines whether a request is authenticated — has no tests. The IP-based session fallback (security issue #11) and the Node.js user-agent bypass (security issue #25) are entirely untested assumptions.

- **#59 [Helpers/auth_helper.php]** `generateAuthToken()` and `validateAuthToken()` have no unit tests. Token generation, expiry enforcement, and decoding edge cases (tampered token, missing env var, expired token) should each have explicit test cases.
