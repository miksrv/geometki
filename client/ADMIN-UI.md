# Admin UI

How the management pages (`/admin/*`) are designed and built. The first part is the approach —
it holds for any project of ours; the second maps it onto this codebase. The visual language
(tokens, type, kit components) is the site's: see `DESIGN.md`.

## The approach

An admin is a **workspace, not a page of the site**. Its reader is one person who comes often,
knows the domain and wants to see what is wrong, fix it and leave. Every rule below follows
from that.

### 1. The shell

- **Its own layout.** No site header, search, footer, cookie notice or bottom navigation: none
  of them helps to manage anything. A persistent **side navigation** lists every section — one
  click from anywhere to anywhere — with the name of the product, "Управление" under it, and
  the way **back to the site** at the bottom. On phones the navigation is a row that scrolls
  under a top bar.
- **The navigation says where one is** (the active item), so a section's own page has no
  breadcrumbs. Only a nested page (a form) has one crumb: its section.
- **A mark on a section that needs attention** (a number when there is something to count, a
  dot otherwise), from the same rules as the dashboard: the problem is visible from any page.
- A new section is one line in the sections list; it appears in the navigation and may get a
  card on the dashboard.
- **Content the site shows is edited on the site.** An entity with a public page or block
  (places, collections, quests, seasons) gets its form as a page of the site, with the
  administrator's buttons on the public page ("Создать" where a list page keeps its
  create action, "Редактировать" beside the head). The admin is for what has no public face
  (awards, mailings, the mail queue); a section for a public entity appears only once there is
  a real need for its full list.

### 2. The dashboard

- **Action first.** The first block is "Требует внимания": what is broken or will break
  unless something is done, the worst first — the section, one sentence, **one link to where
  it is fixed** (none when it is fixed outside the site: a stopped mail job is fixed on the server). With nothing to do it is a single calm line. A rule is _a fact with a way to
  fix it_; never a number that is merely interesting.
- **Alarms must be able to stop.** A count that only grows (all errors ever) trains people to
  ignore it. Count a recent window (errors of the last 7 days) or a current state (letters
  overdue in the queue).
- **Then a card per section** with the few facts of its _state_ (what is on now, what is next,
  how many are off), each value a **link into the list filtered by it**, and the section's
  create action. Something watched without a page of its own (the sending of the emails) is a
  card with a plain title and plain values.
- **Never repeat** a public page (a season's progress and leaders are on the game page) or a
  list of the admin (the latest five letters are one click away). If a fact is neither an
  action nor a way into a list, it does not belong on the dashboard.
- A card loads and fails on its own: skeleton lines, a quiet "could not load" — never the page.

### 3. Lists

- **A table**, dense, one row per thing. The **first column is the name and the one way into
  the row** (a link to the form, or a button that opens the row's dialog); no separate "edit"
  icon. Numbers are right-aligned in tabular figures; dates do not wrap; a status is a badge
  with one tone per meaning across the admin.
- **The list fits the screen; only the table scrolls.** On desktop a list page is exactly one
  viewport high: the title, the views, the filters and the pagination stay in place, the
  table takes the room left and scrolls inside its card under a sticky header. A short table
  is as high as its rows — the card never stretches. Phones keep the regular scrolling page.
  Forms and the dashboard are ordinary scrolling pages.
- **Views above filters.** The two to four ways a list is looked at most (all / in the queue /
  errors) are toggle chips **with counts**; the rare cases are selects in the filter row under
  them. Two controls never hold the same value.
- **Filters, sorting and the page live in the URL.** A filtered list survives a
  reload, "back" from a form, and can be sent as a link; the dashboard and the alerts link
  straight into a filtered list.
- **An empty list says why**: nothing exists yet (with the create action) or nothing matches
  (with "reset filters") — two different states.
- The page's one primary action ("Создать …") sits on the title line; the total on the
  title's baseline.
- A row that cannot be acted on is not hidden but explained (a switched-off award keeps its
  line, muted, with its badge).

### 4. Forms

- **A page, not a modal**, for anything with more than a few fields: sections with titles, a
  hint under a field only where the rule is not obvious, both locales side by side.
- **The whole form at once, no vertical tabs.** The titled cards stand one under another on
  the full width; there is no menu of the parts beside them (`FormSections` is a site form's
  pattern, not the admin's) and no tabs that hide a part.
- One Cancel / Save row; it floats while there are unsaved changes; leaving with changes asks.
- Server errors land on their fields, the rest in one message at the top.
- **Destructive actions** are apart from Save, ask for confirmation, and say what will
  actually happen ("switched off, not deleted"). What cannot be done is disabled _with the
  reason_ next to it.
- Read-only things (a log record) open in a dialog over the list. **A dialog is not a
  navigation**: opening and closing it never touches the URL (no route change, no progress
  bar) — its state is the page's own.

### 5. States and feedback

- **No spinners over a page.** A list shows skeleton rows, a form stands disabled, a card
  shows skeleton lines: the layout never jumps.
- A wrong id is "not found" with a link back, a failed request "could not load" — never an
  endless loader.
- A success is a toast; an error stays on the page until fixed.

### 6. Words

- No intro paragraphs: the reader knows where they are. Hints live next to the field they
  explain.
- The section has one name everywhere: navigation, page title, dashboard card, crumbs.
- Status words are short and the same across lists.

### 7. Access

- Every admin page is guarded on the server (404 for anyone else) and `noindex`. The UI never
  relies on hiding a link.

## In this project

| Piece           | Where                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Sections, hrefs | `utils/admin.ts` (`ADMIN_SECTIONS`, `adminListHref`, the log periods)                           |
| Layout          | `components/layout/admin-layout` (`AdminLayout`: side navigation, marks, "На сайт")             |
| Page frame      | `components/shared/admin-page-shell` (`AdminPageShell`: head, `PageHeader`, not-found / error)  |
| Server guard    | `utils/adminPage.ts` (`getAdminServerSideProps`)                                                |
| Attention rules | `hooks/useAdminAttention.ts` — one list for the dashboard and the navigation marks              |
| Dashboard       | `sections/admin/admin-page` (`AdminPage`, `AdminAttention`), cards are `AdminWidget` with facts |
| Table           | `components/shared/admin-table` (`AdminTable`, `AdminTitleCell`, column `variant`)              |
| Views           | `components/shared/admin-views` (`AdminViews`, chips with counts)                               |
| Filters row     | `ListingToolbar` + kit `Input` / `Select`                                                       |
| URL state       | `hooks/useQueryFilters.ts`                                                                      |
| Status          | `components/shared/status-badge` (`StatusBadge`, `tones.ts`)                                    |
| Forms           | `FormSection` cards in a column, `FormActions`, `useUnsavedChangesGuard`, `utils/formErrors.ts` |

`AdminPageShell fit` → `AdminLayout fit`: the content column gets the viewport's height on
desktop, and `AdminTable` (a flex item with `min-height: 0`, kit `Table stickyHeader`) shrinks
and scrolls inside it. Everything else on a list page must keep its own height — do not put a
second scrolling or stretching block beside the table.

The layout sets `--page-inset-left`, `--page-gutter`, `--page-bottom-bar` and `--width-max`;
fixed blocks of a page (`FormActions` floating bar) read them, so they never lie over the
navigation.

### Attention rules now

| Rule                                            | Tone    | Leads to                          |
| ----------------------------------------------- | ------- | --------------------------------- |
| Letters in the queue since yesterday or earlier | danger  | the log, `status=pending`         |
| Letters failed during the last 7 days           | warning | the log, `status=error&period=7d` |

### Adding a section

1. A line in `ADMIN_SECTIONS` (key, href, icon, title key).
2. `pages/admin/<section>/index.tsx`: `AdminPageShell fit` (one viewport, the table scrolls) → `AdminViews` (if the list has
   states) → filters → `AdminTable` → `PaginationBar`; state in `useQueryFilters`;
   `getServerSideProps = getAdminServerSideProps`.
3. A form page under it with `section={{ href, title }}`.
4. If the section can break: a rule in `useAdminAttention`; if it has a state worth a glance:
   an `AdminWidget` with facts on the dashboard.
