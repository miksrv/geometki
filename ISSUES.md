# Issues

Open bugs and improvements only, one line each, in English. Delete an item's line when it is fixed.

## Bugs

- Server: `GET /auth/me` called from the home page SSR (`client/pages/index.tsx`) runs `SessionLibrary::update()` with the Next server's IP, overwriting `sessions.user_ip` until the browser's next poll; forward `X-Forwarded-For` from SSR requests (or read the user id without `auth/me`). `user_ip` is not read anywhere yet.
- Server: `Places::create` / `Places::update` ignore the result of `PlacesContentModel::saveContent()`, so a failed text save (e.g. two concurrent first saves of a new locale hitting the `place_locale` unique key) still answers 200; check it and fail the request.
- Push: `Push::renew()` answers 404 when the old endpoint is no longer in `push_subscriptions`, but `PushQueue` deletes a device on the first 404/410 from the push service; when `pushsubscriptionchange` fires after that (common in Firefox) the new subscription is lost and the device silently stops getting pushes. Keep a tombstone (`endpoint_hash` → `user_id`) for expired devices for ~30 days so `renew` can find the owner.
- Push: overlapping `notifications:send` runs (a push run may last 180 s, cron is every minute) can each claim rows of the same user and send them separately, breaking the 15-minute grouping; skip users with rows `process` under another `locked_by` when claiming, or take a per-user `GET_LOCK`.
- Push (client): `PushOwnerCheck` (`PushPrompt.tsx`) can unsubscribe and delete a device the user re-enabled on `/users/settings` right after page load (it acts on the first `active: false` status while `enable()` re-posts the same endpoint); skip it while an enable is running.

## Improvements

- Push: `GET /push/subscriptions/status?endpoint=…` puts the endpoint (a capability URL) into web server and proxy access logs; send it in a POST body or as `sha256(endpoint)`.
- Push: quiet hours use only the time zone of the user's most recently updated device; a user with devices in different time zones may get a push at night on another one.
- Deploy: migration `ReworkNotifications` adds an index on `sending_mail.email` VARCHAR(255) utf8mb4 (1020 bytes); check that production's row format is DYNAMIC (767-byte limit otherwise, and the migration is not transactional).
- Achievements: without the hourly `achievements:evaluate`, a reputation achievement (reputation grows from other people's ratings) arrives only with the user's next own action; and every place / photo / rating / comment now also evaluates the experience, level, reputation, active days and streak metrics (`AchievementsLibrary::ALWAYS_METRICS`), `login_streak` reading all the user's activity days. Watch the cost; if it grows, cache the streak or run `achievements:evaluate` for the users active in the last hour.
- Push: delivery was checked against a mock push service and the real FCM endpoint format, not yet on a real device; check Chrome / Firefox / Android / an iOS Home Screen app after the first deploy (`/users/settings` → Send a test).
- Admin: the push queue (`push_messages`) has no admin page like `/admin/sending-mail`.
- Home page (EN): many place and collection titles stay in Russian because they have no English text; prefer items with an English title in "Where to go" and the collections on `/en`, or transliterate.
- Search: the short-term (≤3 characters) `LIKE` branch of `PlacesContent::search()` has no `LIMIT`, so a 1-character query scans and returns nearly every place; cap it.
- Server tests: `GET /stats` has no test for the new `categories` field (counts per whitelisted category, soft-deleted places excluded).
- Server CI: no static analysis; add PHPStan (level 0–1, `codeigniter/phpstan-codeigniter`, a baseline) to `api-checks`.
- Server tests: almost no controller is called for real (only `PlacesTextsEndpointTest` uses `FeatureTestTrait`); most "unit" tests copy the logic into helpers. Add `FeatureTestTrait` smoke tests on SQLite that every public GET endpoint answers without 500.
- Server tests: the migrations cannot run on an empty database (`AddActivity` references `comments` before `AddComments` creates it), so feature tests build tables by hand; fix it with a new migration so tests can run the full schema.
- Email: only a synchronous rejection of the recipient at RCPT TO (5.1.1/2/3/6/10) marks `users.email_bounced_at` (cleared on the user's next sign-in); bounce and spam-complaint emails that arrive later in the `smtp.mail` mailbox are not processed. Read them (IMAP) or move to a provider with bounce webhooks.
- Email: the settings hint "at most once every 5 hours" (`email-notifications-hint`) duplicates `Config\Notifications::$activityEmailIntervalHours`; send the interval from the API or keep them in sync by hand.
- Server tests: the queues (`QueueRows` claim / stale release / ownership, `MailQueue::process()`, `PushQueue::process()`, `PushMessagesModel::outcomesByActivity`), `Mail::unsubscribe` and the push API have no database tests (checked by hand on a local database with fake transports); add them with the `FeatureTestTrait` tests above.
- SEO: the Open Graph image `client/public/images/pages/main.jpg` is 1768×1538, social networks crop it; add a 1200×630 image and an explicit `twitter:image`.
