# Feature 19 — Admin: Sent Emails Dashboard

> **Status: ✅ Completed** (2026-04-23)

---

## Agent Instructions

> **IMPORTANT — read before starting any task.**
>
> Each task in this document has a **Status** field at the top. Before you begin work on a task, update the status to `🔄 In progress`. When you finish, update it to `✅ Done`. If you encounter a blocker, set it to `❌ Blocked: <reason>`. Never start a later task that depends on an incomplete earlier one. Keep the statuses accurate — they are the only shared coordination signal between agents working in parallel.
>
> **Code style rules that apply to all tasks:**
> - Backend: follow patterns from `Achievements.php` controller and `AchievementsModel.php`. Use `SessionLibrary` for auth. Use `lang()` for all user-facing strings.
> - Frontend: use **only** `simple-react-ui-kit` components for UI elements. No custom buttons, inputs, tables, or dialogs. Run `yarn eslint:fix` in `client/` after every task.
> - Frontend i18n: add translation keys to **both** `public/locales/ru/common.json` and `public/locales/en/common.json`.
> - Never edit existing migrations. Always create a new migration file.

---

## Overview

The platform sends transactional email notifications (ratings, comments, edits, photos) via a `sending_mail` queue table. Currently there is no admin visibility into this queue: admins cannot see which emails succeeded, which failed, or why. Error details are not persisted to the database at all.

This feature adds:
1. An `error` column to `sending_mail` so send failures are recorded in the DB.
2. Error capture in the mail-sending path so errors are actually written.
3. A new admin-only REST endpoint with filtering, sorting, and pagination.
4. A new admin page in the UI — a searchable, sortable table of sent emails, with a detail modal and per-row user info pulled via `activity_id`.

**Who benefits:** Administrators who need to diagnose delivery failures, audit the notification pipeline, or trace which users received what emails.

---

## Database Schema Change

### Current `sending_mail` columns

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(15) | PK, auto-generated |
| `activity_id` | VARCHAR(15) | FK → `activity.id` (nullable) |
| `status` | ENUM('created','process','completed','error','rejected') | |
| `email` | TEXT | Recipient address |
| `locale` | ENUM('ru','en') | |
| `subject` | VARCHAR(255) | |
| `message` | TEXT | Template body |
| `sent_email` | TEXT | Rendered/final email body |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `deleted_at` | DATETIME | Soft-delete |

### New column

| Column | Type | Notes |
|---|---|---|
| `error` | TEXT NULL | SMTP/transport error message written on failure |

---

## API Contract

### `GET /sending-mail/manage`

Admin-only. Returns a paginated, filterable list.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status enum value |
| `email` | string | Partial match on recipient email |
| `locale` | string | `ru` or `en` |
| `date_from` | string | ISO date — filter `created_at >=` |
| `date_to` | string | ISO date — filter `created_at <=` |
| `sort` | string | Column to sort by: `created_at`, `updated_at`, `status`, `email` (default: `created_at`) |
| `order` | string | `asc` or `desc` (default: `desc`) |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 100) |

**Response `200`:**
```json
{
  "items": [
    {
      "id": "abc123def4567",
      "status": "error",
      "email": "user@example.com",
      "locale": "ru",
      "subject": "Новый рейтинг для вашего места",
      "error": "SMTP connect() failed.",
      "created_at": "2026-04-23T10:00:00",
      "updated_at": "2026-04-23T10:00:05",
      "activity": {
        "id": "xyz789abc0123",
        "user_id": "usr111222333",
        "user_name": "Иван Иванов",
        "user_avatar": "https://..."
      }
    }
  ],
  "count": 142,
  "per_page": 20,
  "current_page": 1,
  "stats": {
    "total": 142,
    "completed": 130,
    "error": 8,
    "pending": 4
  }
}
```

**Errors:**
- `401 Unauthorized` — not authenticated
- `403 Forbidden` — authenticated but not admin

### `GET /sending-mail/manage/{id}`

Returns a single record with full details (including full `message` and `sent_email` body).

**Response `200`:**
```json
{
  "data": {
    "id": "abc123def4567",
    "status": "error",
    "email": "user@example.com",
    "locale": "ru",
    "subject": "Новый рейтинг для вашего места",
    "message": "<full template source>",
    "sent_email": "<full rendered HTML>",
    "error": "SMTP connect() failed.",
    "created_at": "2026-04-23T10:00:00",
    "updated_at": "2026-04-23T10:00:05",
    "activity": {
      "id": "xyz789abc0123",
      "user_id": "usr111222333",
      "user_name": "Иван Иванов",
      "user_avatar": "https://...",
      "type": "rating"
    }
  }
}
```

---

## UI Design

### Page: `/admin/sending-mail`

**Layout (top to bottom):**

1. **Stats bar** — four counters (Total / Completed / Errors / Pending), using `Badge` or `Container` from `simple-react-ui-kit`.
2. **Filter row** — `Select` for Status, `Input` for Email search, `Select` for Locale, date-range inputs for Created At, `Button` "Reset filters".
3. **Table** — `Table` component from `simple-react-ui-kit` with sticky header.
4. **Pagination** — `Pagination` component below the table (if available in kit, else custom using kit `Button` components).

### Table columns

| Column | Source | Notes |
|---|---|---|
| **Status** | `status` | `Badge` with colour per status (see below) |
| **User** | `activity.user_*` | Avatar image + name as link to `/users/{user_id}`. If `activity_id` is null — show "—". |
| **Recipient email** | `email` | Plain text |
| **Subject** | `subject` | Truncated to ~60 chars |
| **Locale** | `locale` | Small flag/label |
| **Sent at** | `updated_at` | Formatted date. Clickable → opens detail modal |
| **Created at** | `created_at` | Formatted date |

### Status badge colours

| Status | Colour variant |
|---|---|
| `created` | neutral/default |
| `process` | info (blue) |
| `completed` | positive (green) |
| `error` | negative (red) |
| `rejected` | warning (orange) |

### Detail Modal

Triggered by clicking the "Sent at" date in any row. Uses `Dialog` from `simple-react-ui-kit`.

**Contents:**
- Header: subject line
- Status badge + locale
- Recipient email
- User block (avatar, name, link)
- Activity type label
- Error message block (shown only if `status === 'error'`), styled as an alert/callout
- Full rendered email (`sent_email`) in a scrollable `<pre>` or iframe
- Created at / Updated at timestamps
- Close button

---

## Implementation Tasks

---

### Task B-1 — Migration: add `error` field

**Status:** ✅ Done

**Agent type:** backend-engineer

**What to do:**
Create a new migration file that adds the `error` column to `sending_mail`. Do **not** edit the existing migration.

**File to create:**
`server/app/Database/Migrations/2026-04-23-000001_AddErrorFieldToSendingMail.php`

**Implementation notes:**
- Follow the exact pattern of `2024-04-24-172119_AddSendingMail.php`.
- Column spec: `'type' => 'TEXT', 'null' => true`.
- `up()`: use `$this->forge->addColumn('sending_mail', [...])`.
- `down()`: use `$this->forge->dropColumn('sending_mail', 'error')`.

---

### Task B-2 — Model: update `SendingMail`

**Status:** ✅ Done

**Agent type:** backend-engineer

**Depends on:** Task B-1 complete (column must exist before model can write to it)

**What to do:**
Add `error` to the `allowedFields` array in `server/app/Models/SendingMail.php`.

**File to modify:**
`server/app/Models/SendingMail.php`

**Implementation notes:**
- Add `'error'` to `$allowedFields`.
- No other changes needed to the model.

---

### Task B-3 — Controller: `SendingMailManage`

**Status:** ✅ Done

**Agent type:** backend-engineer

**Depends on:** Task B-2 complete

**What to do:**
Create a new controller `SendingMailManage` with two public methods: `index()` (list) and `show($id)`.

**File to create:**
`server/app/Controllers/SendingMailManage.php`

**`index()` implementation notes:**
1. Auth check: `!$this->session->isAuth || $this->session->user?->role !== 'admin'` → `failForbidden()`.
2. Read query params: `status`, `email`, `locale`, `date_from`, `date_to`, `sort`, `order`, `page`, `limit` — all sanitized via `$this->request->getGet('field', FILTER_SANITIZE_SPECIAL_CHARS)`.
3. Validate `sort` against allowlist `['created_at', 'updated_at', 'status', 'email']`; default to `created_at`.
4. Validate `order` against `['asc', 'desc']`; default to `desc`.
5. Clamp `limit` to max 100.
6. Build query on `SendingMail` model with `select()`, `where()` conditions, `orderBy()`, `paginate()`.
7. **User enrichment:** for each row that has `activity_id`, JOIN or eager-load the `activity` + `users` tables to get `user_id`, `user_name` (combine first + last name), `user_avatar`. Rows without `activity_id` return `activity: null`.
8. Compute stats via a second query using `groupBy('status')` + `countAllResults()` (or a single aggregate query).
9. Return structure matching the API contract above.

**`show($id)` implementation notes:**
1. Same admin auth check.
2. Find record; return `failNotFound(lang('SendingMailManage.notFound'))` if missing.
3. Enrich with activity/user data same as above.
4. Return `['data' => $enriched]`.

**Error handling:**
- Wrap DB operations in `try/catch (\Throwable $e)`.
- Log with `log_message('error', '{exception}', ['exception' => $e])`.
- Return `failServerError(lang('SendingMailManage.fetchError'))`.

---

### Task B-4 — Language files

**Status:** ✅ Done

**Agent type:** backend-engineer

**Depends on:** none (can run in parallel with B-3)

**What to do:**
Create localization files for the new controller.

**Files to create:**

`server/app/Language/ru/SendingMailManage.php`:
```php
<?php
return [
    'notFound'      => 'Запись об отправке не найдена.',
    'fetchError'    => 'Ошибка при получении данных. Попробуйте ещё раз.',
    'forbidden'     => 'Доступ запрещён.',
    'unauthorized'  => 'Необходима авторизация.',
];
```

`server/app/Language/en/SendingMailManage.php`:
```php
<?php
return [
    'notFound'      => 'Sending mail record not found.',
    'fetchError'    => 'Error fetching data. Please try again.',
    'forbidden'     => 'Access forbidden.',
    'unauthorized'  => 'Authentication required.',
];
```

---

### Task B-5 — Routes registration

**Status:** ✅ Done

**Agent type:** backend-engineer

**Depends on:** Task B-3 complete

**What to do:**
Register the two new endpoints in the routes config.

**File to modify:**
`server/app/Config/Routes.php`

**What to add** (find the existing admin/manage route block and add alongside similar entries):
```php
$routes->get('sending-mail/manage',      'SendingMailManage::index');
$routes->get('sending-mail/manage/(:segment)', 'SendingMailManage::show/$1');
```

---

### Task B-6 — Error capture in mail sending

**Status:** ✅ Done

**Agent type:** backend-engineer

**Depends on:** Task B-2 complete

**What to do:**
Find where emails are actually dispatched (look in `app/Libraries/` and `app/Controllers/Mail.php` for SMTP/mailer calls) and wrap the send call in a try/catch. On failure: set `status = 'error'` and write the exception message to the `error` column. On success: ensure `status = 'completed'` and clear `error` (set to null).

**Implementation notes:**
- Identify the exact line where the email is sent (likely a CodeIgniter Email library `send()` call or a `PHPMailer::send()` / Guzzle HTTP call).
- Before the send: set `status = 'process'` via `$sendingMailModel->update($id, ['status' => 'process'])`.
- In the catch block: `$sendingMailModel->update($id, ['status' => 'error', 'error' => substr($e->getMessage(), 0, 65535)])`.
- On success: `$sendingMailModel->update($id, ['status' => 'completed', 'error' => null])`.
- Do not suppress the exception after logging — let the calling code know the send failed.

---

### Task F-1 — TypeScript types

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** Task B-3 complete (API contract finalised)

**What to do:**
Create TypeScript type definitions matching the API contract.

**File to create:**
`client/api/types/sending-mail.ts`

```typescript
export type SendingMailStatus = 'created' | 'process' | 'completed' | 'error' | 'rejected'
export type SendingMailLocale = 'ru' | 'en'

export interface SendingMailActivity {
    id: string
    user_id: string
    user_name: string
    user_avatar: string | null
    type?: string
}

export interface SendingMailItem {
    id: string
    status: SendingMailStatus
    email: string | null
    locale: SendingMailLocale
    subject: string | null
    error: string | null
    created_at: string
    updated_at: string
    activity: SendingMailActivity | null
}

export interface SendingMailDetail extends SendingMailItem {
    message: string | null
    sent_email: string | null
}

export interface SendingMailStats {
    total: number
    completed: number
    error: number
    pending: number
}

export interface SendingMailListResponse {
    items: SendingMailItem[]
    count: number
    per_page: number
    current_page: number
    stats: SendingMailStats
}

export interface SendingMailListRequest {
    status?: SendingMailStatus
    email?: string
    locale?: SendingMailLocale
    date_from?: string
    date_to?: string
    sort?: 'created_at' | 'updated_at' | 'status' | 'email'
    order?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export interface SendingMailDetailResponse {
    data: SendingMailDetail
}
```

---

### Task F-2 — RTK Query endpoints

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** Task F-1 complete

**What to do:**
Add two new endpoints to `client/api/api.ts`.

**File to modify:**
`client/api/api.ts`

**What to add** (follow the pattern of `getAchievementsManage`):
```typescript
getSendingMailList: builder.query<
    ApiType.SendingMail.SendingMailListResponse,
    Maybe<ApiType.SendingMail.SendingMailListRequest>
>({
    providesTags: ['SendingMail'],
    query: (params) => `sending-mail/manage${encodeQueryData(params)}`
}),

getSendingMailItem: builder.query<
    ApiType.SendingMail.SendingMailDetailResponse,
    string
>({
    providesTags: (result, error, id) => [{ id, type: 'SendingMail' }],
    query: (id) => `sending-mail/manage/${id}`
}),
```

Also add `'SendingMail'` to the tag types array at the top of the API slice.

Also add `import * as SendingMail from './types/sending-mail'` (or the project's existing import convention) to `api/types/index.ts` (check how other types are re-exported).

---

### Task F-3 — i18n translation keys

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** none (can run in parallel)

**What to do:**
Add translation keys to both locale files. Run `yarn locales:build` in `client/` after editing.

**Files to modify:**
- `client/public/locales/ru/common.json`
- `client/public/locales/en/common.json`

**Keys to add:**

Russian (`ru`):
```json
"sending-mail-admin-title": "Отправленные письма",
"sending-mail-admin-total": "Всего",
"sending-mail-admin-completed": "Доставлено",
"sending-mail-admin-error": "Ошибки",
"sending-mail-admin-pending": "В очереди",
"sending-mail-admin-col-status": "Статус",
"sending-mail-admin-col-user": "Пользователь",
"sending-mail-admin-col-email": "Email",
"sending-mail-admin-col-subject": "Тема",
"sending-mail-admin-col-locale": "Язык",
"sending-mail-admin-col-sent-at": "Отправлено",
"sending-mail-admin-col-created-at": "Создано",
"sending-mail-admin-filter-status": "Статус",
"sending-mail-admin-filter-status-all": "Все статусы",
"sending-mail-admin-filter-email": "Поиск по email",
"sending-mail-admin-filter-locale": "Язык",
"sending-mail-admin-filter-locale-all": "Все языки",
"sending-mail-admin-filter-date-from": "Дата от",
"sending-mail-admin-filter-date-to": "Дата до",
"sending-mail-admin-filter-reset": "Сбросить фильтры",
"sending-mail-admin-no-data": "Писем не найдено",
"sending-mail-admin-modal-title": "Детали письма",
"sending-mail-admin-modal-recipient": "Получатель",
"sending-mail-admin-modal-error": "Ошибка отправки",
"sending-mail-admin-modal-body": "Тело письма",
"sending-mail-admin-modal-activity": "Активность",
"sending-mail-admin-modal-no-user": "Пользователь не определён",
"sending-mail-status-created": "Создано",
"sending-mail-status-process": "В обработке",
"sending-mail-status-completed": "Доставлено",
"sending-mail-status-error": "Ошибка",
"sending-mail-status-rejected": "Отклонено"
```

English (`en`):
```json
"sending-mail-admin-title": "Sent Emails",
"sending-mail-admin-total": "Total",
"sending-mail-admin-completed": "Delivered",
"sending-mail-admin-error": "Errors",
"sending-mail-admin-pending": "Queued",
"sending-mail-admin-col-status": "Status",
"sending-mail-admin-col-user": "User",
"sending-mail-admin-col-email": "Email",
"sending-mail-admin-col-subject": "Subject",
"sending-mail-admin-col-locale": "Locale",
"sending-mail-admin-col-sent-at": "Sent at",
"sending-mail-admin-col-created-at": "Created at",
"sending-mail-admin-filter-status": "Status",
"sending-mail-admin-filter-status-all": "All statuses",
"sending-mail-admin-filter-email": "Search by email",
"sending-mail-admin-filter-locale": "Locale",
"sending-mail-admin-filter-locale-all": "All locales",
"sending-mail-admin-filter-date-from": "Date from",
"sending-mail-admin-filter-date-to": "Date to",
"sending-mail-admin-filter-reset": "Reset filters",
"sending-mail-admin-no-data": "No emails found",
"sending-mail-admin-modal-title": "Email details",
"sending-mail-admin-modal-recipient": "Recipient",
"sending-mail-admin-modal-error": "Send error",
"sending-mail-admin-modal-body": "Email body",
"sending-mail-admin-modal-activity": "Activity",
"sending-mail-admin-modal-no-user": "Unknown user",
"sending-mail-status-created": "Created",
"sending-mail-status-process": "Processing",
"sending-mail-status-completed": "Delivered",
"sending-mail-status-error": "Error",
"sending-mail-status-rejected": "Rejected"
```

---

### Task F-4 — Sidebar navigation item

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** none (can run in parallel)

**What to do:**
Add an admin-only menu item "Отправленные письма" / "Sent emails" to the sidebar.

**File to modify:**
`client/components/layout/site-menu/SiteMenu.tsx`

**What to add:**
Find the existing admin menu item (the one with `admin: true` pointing to `/admin/achievements`) and add a new item **after** it:
```typescript
{
    admin: true,
    icon: 'Mail',        // use whatever icon name is available in the kit for email/mail
    link: '/admin/sending-mail',
    text: t('sending-mail-admin-title')
}
```

Check which icon names are available in `simple-react-ui-kit` before choosing — pick the closest match for "email/envelope/mail".

---

### Task F-5 — Admin page component

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** Tasks F-2, F-3, F-4 complete

**What to do:**
Create the main admin page.

**Files to create:**
- `client/pages/admin/sending-mail/index.tsx`
- `client/pages/admin/sending-mail/index.module.sass`

**Page structure:**

```
getServerSideProps:
  1. hydrateAuthFromCookies
  2. dispatch(API.endpoints.authGetMe.initiate())
  3. if role !== 'admin' → return { notFound: true }
  4. serverSideTranslations
  5. await Promise.all(getRunningQueriesThunk())

Component:
  - Client-side guard: if isAuth && role !== 'admin' → router.push('/')
  - useGetSendingMailListQuery(filters) with refetch on filter change
  - Local state: filters object, selectedItemId for modal

Layout:
  <AppLayout title={t('sending-mail-admin-title')}>
    <Container>
      <h1>{t('sending-mail-admin-title')}</h1>
      <SendingMailStats stats={data?.stats} loading={isLoading} />
      <SendingMailFilters filters={filters} onChange={setFilters} />
      <Table columns={columns} data={data?.items} loading={isLoading}
             noDataCaption={t('sending-mail-admin-no-data')} stickyHeader />
      <Pagination ... />
      <SendingMailDetailModal id={selectedItemId}
                              onClose={() => setSelectedItemId(null)} />
    </Container>
  </AppLayout>
```

**Columns definition** (matching the UI Design section above):
- Status → `Badge` variant based on status value
- User → avatar `<img>` + `<Link>` to `/users/{user_id}`, or "—" if null
- Email → text
- Subject → truncated text
- Locale → text label
- Sent at → formatted date string; entire cell is clickable, sets `selectedItemId`
- Created at → formatted date string

**Filters:**
- `Select` for `status` (options: all + 5 status values)
- `Input` for `email` (debounced, 300ms)
- `Select` for `locale` (all / ru / en)
- Two `Input` date pickers for `date_from` / `date_to`
- `Button` "Reset" clears all filters

**Sorting:** pass `sort` + `order` params to the query; column headers should be clickable to toggle sort (ascending/descending).

**Pagination:** page state in local useState; pass `page` + `limit` to query.

**Run `yarn eslint:fix` in `client/` when done.**

---

### Task F-6 — Detail modal component

**Status:** ✅ Done

**Agent type:** frontend-dev

**Depends on:** Tasks F-2, F-3 complete; can run in parallel with F-5

**What to do:**
Create a reusable detail modal component for a single sending_mail record.

**Files to create:**
- `client/components/pages/sending-mail-detail/SendingMailDetail.tsx`
- `client/components/pages/sending-mail-detail/SendingMailDetail.module.sass`

**Props interface:**
```typescript
interface SendingMailDetailProps {
    id: string | null   // null = closed
    onClose: () => void
}
```

**Implementation notes:**
- Use `useGetSendingMailItemQuery(id, { skip: !id })` to lazy-load details.
- Use `Dialog` from `simple-react-ui-kit` with `open={!!id}` and `onCloseDialog={onClose}`.
- Show a loading spinner (or skeleton) while data is fetching.
- Show error callout block only when `status === 'error'` and `error` is not null/empty.
- Render `sent_email` in a scrollable `<div>` with `dangerouslySetInnerHTML` (it's admin-only content from our own DB — acceptable here) or inside a sandboxed `<iframe srcdoc={...}>`.
- User block: avatar + name as link; if null activity, show a "—" placeholder.
- Timestamps: format with `formatDate` helper (check `functions/helpers.ts` for existing date formatter).

**Run `yarn eslint:fix` in `client/` when done.**

---

## Extra Enhancements (post-MVP)

The following ideas extend the MVP and can be implemented after all core tasks are done:

### E-1 — Retry failed emails
Add a `POST /sending-mail/manage/{id}/retry` endpoint. In the UI, add a "Retry" `Button` in the detail modal (visible only when `status === 'error'`). Retrying resets `status = 'created'` and `error = null`, then re-queues the email for the next sending cycle.

### E-2 — CSV export
Add `GET /sending-mail/manage/export?{same filters}` that returns a CSV file. In the UI, add an "Export CSV" `Button` in the filter row. Useful for offline analysis.

### E-3 — Auto-refresh toggle
Add a toggle (checkbox or `Button` in active state) that enables polling the list every 30 seconds using RTK Query's `pollingInterval` option. Useful when monitoring the queue in real-time.

### E-4 — Bulk delete old records
Add `DELETE /sending-mail/manage/cleanup?older_than_days=90` (admin-only, hard delete of soft-deleted records older than N days). In the UI, a "Clean up old records" button in the page header with a `ConfirmationDialog`.

### E-5 — Activity type icons
In the User column, show a small icon next to the avatar indicating the activity type (new rating, comment, edit, photo) using the icon set already available in the project.

### E-6 — Email preview in modal as iframe
Render `sent_email` HTML in a sandboxed `<iframe srcdoc>` with `sandbox="allow-same-origin"` so styles in the email template render correctly without affecting the host page.

---

## File Manifest

### New files
| Path | Task |
|---|---|
| `server/app/Database/Migrations/2026-04-23-000001_AddErrorFieldToSendingMail.php` | B-1 |
| `server/app/Controllers/SendingMailManage.php` | B-3 |
| `server/app/Language/ru/SendingMailManage.php` | B-4 |
| `server/app/Language/en/SendingMailManage.php` | B-4 |
| `client/api/types/sending-mail.ts` | F-1 |
| `client/pages/admin/sending-mail/index.tsx` | F-5 |
| `client/pages/admin/sending-mail/index.module.sass` | F-5 |
| `client/components/pages/sending-mail-detail/SendingMailDetail.tsx` | F-6 |
| `client/components/pages/sending-mail-detail/SendingMailDetail.module.sass` | F-6 |

### Modified files
| Path | Task | Change |
|---|---|---|
| `server/app/Models/SendingMail.php` | B-2 | Add `'error'` to `$allowedFields` |
| `server/app/Config/Routes.php` | B-5 | Add two new GET routes |
| `server/app/Libraries/*.php` (mail sending) | B-6 | Wrap send in try/catch, write error |
| `client/api/api.ts` | F-2 | Add two RTK Query endpoints, add `'SendingMail'` tag |
| `client/api/types/index.ts` | F-2 | Re-export SendingMail types |
| `client/public/locales/ru/common.json` | F-3 | Add ~30 translation keys |
| `client/public/locales/en/common.json` | F-3 | Add ~30 translation keys |
| `client/components/layout/site-menu/SiteMenu.tsx` | F-4 | Add admin menu item |

---

## Task Execution Order

```
Phase 1 (backend — can run in parallel):
  B-1 → B-2 → B-6   (migration chain, sequential)
  B-1 → B-2 → B-3   (migration chain, then controller)
  B-4                (language files, fully independent)
  B-5                (routes, after B-3)

Phase 2 (frontend — can run in parallel with each other, after B-3 is done):
  F-1 → F-2          (types first, then endpoints)
  F-3                (i18n, independent)
  F-4                (nav item, independent)

Phase 3 (frontend pages — after F-2, F-3, F-4):
  F-5 and F-6        (can run in parallel)
```
