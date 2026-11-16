---
name: project-game-days-moscow-and-admin-api
description: Game "today" is GameLibrary::today() (Moscow), admin endpoints share the AdminOnly trait, uploads go through AdminImageLibrary; test gotchas
metadata:
  type: project
---

The game's day is `GameLibrary::today(?ts, shift)` (Europe/Moscow), never `date('Y-m-d')` (server is UTC); tests that build days must use it too, or they fail between 21:00 and 24:00 UTC.

Admin controllers (Game seasons, Achievements, SendingMailManage) use `App\Controllers\Concerns\AdminOnly` (401 guest / 403 member, `adminInput()` returns null on a bad JSON body). Pictures: `AdminImageLibrary` (kind by content, SVG sanitised through DOM, `remove()` folder-restricted).

**Why:** independent review of the admin API on 2026-11-15; the Moscow-day mismatch was hit live by the test suite at 23:47 UTC.

**How to apply:** season writes go through `GameLibrary::createSeason/updateSeason/deleteSeason` (GET_LOCK + row lock); `score()` holds the season row `FOR SHARE`, `tick()` holds it `FOR UPDATE`. In tests, posting nested arrays through `post($uri, $params)` poisons `$_POST` (InvalidChars TypeError) - send `withBody(json_encode(...))` instead; uploads need `tests/_support/UploadFunctions.php` (is_uploaded_file stand-ins) and `service('superglobals')->setFilesArray()`. MySQL JSON columns reorder keys: compare with assertEquals.
