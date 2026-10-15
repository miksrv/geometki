---
name: server_project_overview
description: Server conventions not covered by CLAUDE.md — ID scheme, locale filter, session, error handling
type: project
---

CLAUDE.md holds the server overview; libraries are in `app/Libraries`, spark jobs in `app/Commands`. This file keeps the conventions.

**ID scheme:** primary keys are 13-char hex strings generated in `ApplicationBaseModel::generateId()` (beforeInsert, `random_bytes`) — not auto-increment integers. Most tables use soft deletes.

**Locale:** `LocaleFilter` (global before-filter in `Config/Filters.php`) applies `LocaleLibrary` from the `Locale` header (`en`/`ru`). Do NOT call `new LocaleLibrary()` in controllers. Place content lives in `places_content` with a locale column.

**SessionLibrary:** assign to `$this->session` in the controller constructor, not per method.

**Error handling:**
- All user-visible strings go through `lang('File.key')`, key naming `ControllerName.camelCaseKey`; `app/Language/en` and `ru` always in sync
- I/O and external calls wrapped in `try/catch (Throwable $e)` with `log_message('error', '{exception}', ['exception' => $e])`, returning `$this->failServerError(lang('...'))`
- Reference impl: `Photos.php` + `Language/{en,ru}/Photos.php`

**How to apply:** follow these in every new controller/model.
