# Issues

Open bugs and improvements only, one line each, in English. Delete an item's line when it is fixed.

## Bugs


## Improvements

- Places: `GET /places?search=` with 1–3 characters takes the 100 most recently updated matches (`PlacesContent::SHORT_TERM_LIMIT`) before the other filters (category, bounds, distance sort), so a filtered short search may miss places; move the short search into the list query.
- Push: quiet hours use only the time zone of the user's most recently updated device; a user with devices in different time zones may get a push at night on another one.
- Deploy: migration `ReworkNotifications` adds an index on `sending_mail.email` VARCHAR(255) utf8mb4 (1020 bytes); check that production's row format is DYNAMIC (767-byte limit otherwise, and the migration is not transactional).
- Achievements: without the hourly `achievements:evaluate`, a reputation achievement (reputation grows from other people's ratings) arrives only with the user's next own action; and every place / photo / rating / comment now also evaluates the experience, level, reputation, active days and streak metrics (`AchievementsLibrary::ALWAYS_METRICS`), `login_streak` reading all the user's activity days. Watch the cost; if it grows, cache the streak or run `achievements:evaluate` for the users active in the last hour.
- Push: delivery was checked against a mock push service and the real FCM endpoint format, not yet on a real device; check Chrome / Firefox / Android / an iOS Home Screen app after the first deploy (`/users/settings` → Send a test).
- Admin: the push queue (`push_messages`) has no admin page like `/admin/sending-mail`.
- Home page (EN): many place and collection titles stay in Russian because they have no English text; prefer items with an English title in "Where to go" and the collections on `/en`, or transliterate.
- Server tests: `GET /stats` has no test for the new `categories` field (counts per whitelisted category, soft-deleted places excluded).
- Server CI: no static analysis; add PHPStan (level 0–1, `codeigniter/phpstan-codeigniter`, a baseline) to `api-checks`.
- Server tests: almost no controller is called for real (only `PlacesTextsEndpointTest` uses `FeatureTestTrait`); most "unit" tests copy the logic into helpers. Add `FeatureTestTrait` smoke tests on SQLite that every public GET endpoint answers without 500.
- Email: only a synchronous rejection of the recipient at RCPT TO (5.1.1/2/3/6/10) marks `users.email_bounced_at` (cleared on the user's next sign-in); bounce and spam-complaint emails that arrive later in the `smtp.mail` mailbox are not processed. Read them (IMAP) or move to a provider with bounce webhooks.
- Email: the settings hint "at most once every 5 hours" (`email-notifications-hint`) duplicates `Config\Notifications::$activityEmailIntervalHours`; send the interval from the API or keep them in sync by hand.
- Server tests: the queues (`QueueRows` claim / stale release / ownership, `MailQueue::process()`, `PushQueue::process()`, `PushMessagesModel::outcomesByActivity`), `Mail::unsubscribe` and the push API have no database tests (checked by hand on a local database with fake transports); add them with the `FeatureTestTrait` tests above.
- SEO: the Open Graph image `client/public/images/pages/main.jpg` is 1768×1538, social networks crop it; add a 1200×630 image and an explicit `twitter:image`.
- Places: the new filter primitives (`Chip`, `ScrollRail`, `Switch`, `FieldTrigger`, `OptionList`, the form `BottomSheet`) live in `client/components/ui`; move them to `simple-react-ui-kit` once they settle.
- Places: the card bookmark and the "You've been here" badge need `bookmarked` / `visited` in the list; only `GET /places` sends them, so a signed-in visitor sees no bookmark on tiles from search, the feed or collection places. Add the flags there too.
- Places: "Near me" is the distance sort over all places, without a radius; a filter by distance (e.g. 300 km) needs a server parameter.
- Places: "Map" carries only a single category to `/map` (and only behind the landing flags); the location and "Hide visited" are not passed.
- Places: cover previews are 680×300 (`PLACE_COVER_PREVIEW_*`), while a grid tile is about 400px wide, i.e. 800px on a Retina screen, so tiles are slightly soft there; generate a larger preview (e.g. 960×480) and re-cut the existing ones with a spark command.
