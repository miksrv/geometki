# Geometki design system

How the client UI is built and where each piece lives. Read this before adding or
changing any user-facing component; `CLAUDE.md` points here for the same reason.

## 1. Principles

- **One component per entity, variants for layout.** A place is always a `PlaceCard`, a
  collection is always a `CollectionCard`. Density and orientation are props, never a
  second component. Recognisability comes from the invariant parts, not from the layout.
- **Three entities, three page archetypes.** A place, a person and a collection must not
  look alike, so each entity page has its own skeleton and the reader always knows where
  they are. Place: a detail page (cover hero → actions row → sections + a sticky "where is
  it" card). Person: a
  profile (card with the avatar → tabs). Collection: an article (title with a byline → the
  map → prose → a flow of large place cards). New entity pages pick one of these or get a
  new archetype; they never borrow another entity's hero or sidebar.
- **Kit first.** Primitives (buttons, inputs, dialogs, containers, icons, tokens) come
  from `simple-react-ui-kit`. A missing primitive or variant is added to the kit, not
  hand-rolled in the app.
- **Tokens, not values.** Colours, radii, spacing and font sizes come from CSS variables
  (`styles/theme.css` on top of the kit's `theme.css`) and the Sass variables in
  `styles/variables.sass`. No raw hex colours or pixel sizes for things a token covers.
- **Edit mode is explicit.** Owners get the same read view as everyone and switch to
  editing with one visible control; controls appear only in that mode.

## 1a. Type scale

One scale for the whole client, in pixels (sizes never drift with the parent). Kit tokens
give 12 / 14 / 16, `styles/theme.css` adds the rest, `styles/variables.sass` aliases them:

| px  | Token                       | Sass alias           | Use                                                  |
| --- | --------------------------- | -------------------- | ---------------------------------------------------- |
| 12  | `--font-size-small`         | `$fontSizeCaption`   | captions, stats, breadcrumbs, badges                 |
| 13  | `--font-size-secondary`     | `$fontSizeHeadline`  | secondary lines: address, byline, sidebar values     |
| 14  | `--font-size`               | `$fontSizeParagraph` | UI text, controls, card text                         |
| 15  | `--font-size-prose`         | —                    | long-form markdown body (`prose` mixin)              |
| 16  | `--font-size-large`         | `$fontSizeTitleH2`   | block and card titles, `Container` title, prose `h3` |
| 18  | `--font-size-title-section` | `$fontSizeTitleH1`   | section titles, prose `h2`                           |
| 22  | `--font-size-title-page`    | —                    | the page `h1` (`PageHeader`, heroes)                 |

Pick from the table; no ad-hoc `em` or odd pixel sizes.

## 2. Two layers

| Layer             | Lives in                                               | Knows about                    | Examples                                                                                 |
| ----------------- | ------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Primitives        | `simple-react-ui-kit` (separate repo, Storybook there) | Nothing domain-specific        | `Button`, `Input`, `Select`, `Dialog`, `Container`, `Popout`, `Icon`, `Skeleton`, tokens |
| Domain components | `client/components/shared`                             | `ApiModel` types, routes, i18n | `PlaceCard`, `CollectionCard`, `MediaTile`, `UserAvatar`, `CategoryIcon`, `EmptyState`   |

Page-specific composition lives in `client/sections/<area>` (e.g. `sections/collections`),
pages themselves in `client/pages`. Sections may compose domain components; they must not
re-implement them.

## 3. Layout

- **Width.** Content is capped by `--width-max` (1260px); the app bar is the only global
  chrome, there is no permanent sidebar.
- **Lists** are a flow of tiles on the page background, three columns on desktop and one
  on phones (`MediaTileGrid`). Lists never sit inside a `Container`.
- **Place page** (`pages/places/[id]`, spec: `features/24-place-page-redesign.md`):
  `Breadcrumbs` on the page background → `PlaceHero` (the cover at 3:1, at least 240px tall
  on phones; cover files are 1800×600) carrying only the h1 and the meta line (rating ·
  category · address · distance, every fact a link) → `PlaceActions`, one row of `medium`
  buttons on the page background with a single primary "На карте" → `.pageLayout` grid
  `1fr 320px` with a 24px gap → main column of `Section`s (h2 + optional link action, 32px
  apart, no boxes): photos mosaic, description (clamped, "Читать полностью"), the rate
  prompt, "Рядом" carousel, "Ещё {category} в {location}" tiles, comments, the collapsed
  "История изменений" row. The sticky sidebar (`top: 60px`) holds the one boxed block of
  the page, the "Где это" card (`Container`: interactive map with the nearby places as
  markers, address links, coordinates, route links), then the "В коллекциях" rows
  (`PlaceCollections`, picker-style rows: 40px cover, title, places count), the "Здесь были"
  avatars and the byline (author, dates, editors, views) — all as plain h3 sections. On
  phones the order is explicit (cover → actions → photos → description → rate → where →
  nearby → related → sidebar blocks → comments → history) and a sticky bottom bar repeats
  "На карте / Маршрут / Сохранить" once the actions row has scrolled away. Until the
  redesign lands the page still renders the pre-redesign `Container` blocks; new work on
  it follows the spec, not the old layout.
- **Collection page** (`pages/collections/[id]`): `CollectionHeader` (a `PageHeader` with a
  byline) → the map (`PlacesMap`, see section 5) on the full content width →
  the description as article prose on the full content width (`prose` mixin) → the places as the usual
  `MediaTileGrid` of `PlaceCard` tiles. No cover, no sidebar, no facts block and no
  containers: the map is the visual of a collection, the title is its only heading. Order
  is the author's, but it is not numbered — numbers would read as a route. In edit mode
  the same tiles get small move/remove buttons over the top-right corner of the cover
  (`PlaceCard` `actions`), and a full-width "Добавить места" button follows the grid.
- **Places listing / landing pages** (`pages/places/index.tsx` for `/places`, `pages/places/landing/[...slug].tsx`
  for `/places/{category}`, `/places/{location}` and `/places/{location}/{category}` behind the
  `NEXT_PUBLIC_LANDING_*` flags — see CLAUDE.md → Environment): one skeleton, all of it page
  chrome on the page background, no `Container` anywhere above the perelinking blocks:
  `PageHeader` with the places count as the meta line and (page 1 only) the lede — the
  category's text, or the location summary — and, on location/pair pages, `LandingMapPreview`
  in the `aside` slot → the listing toolbar (`PlaceFilterPanel`, section 6) → `MediaTileGrid`
  of `PlaceCard` tiles → `PaginationBar` → (page 1 only) the `LocationLinkList` perelinking
  blocks, which are `Container`s because they are titled content. `/places` and category
  pages have no map: places there are nationwide. Filter changes build the canonical path
  (`utils/placesLanding.ts` `buildPlacesHref`) instead of `/places?…` once the relevant flag
  is on.
- **Sections, not containers.** The parts of one entity (its description, photos,
  comments, history, the facts about it) are `Section`s: an h2 (h3 in a sidebar) with an
  optional `action` (`mode="link"` buttons), separated from each other by whitespace alone,
  on the page background. A box groups by enclosure, whitespace groups by proximity; nesting
  boxes inside the page card reads as "object inside object", which these are not.
- **Containers** (`Container` from the kit) are reserved for things of another nature than
  the page itself: a form (also a section switched to edit mode), a tool card with its own
  purpose (the "Где это" map card on the place page), and titled link blocks on listing
  pages (`LocationLinkList`). They carry a `title` and an optional `action`. Page chrome —
  the page header, filters, lists, pagination — sits on the page background, never in a
  `Container`. Empty states are a single line in place of the content, never an empty box.
- **Breakpoint.** One: `$mobileMaxWidth` (768px). Below it columns stack and side action
  groups wrap under the content.

## 4. Page header and breadcrumbs

`PageHeader` (`components/shared/page-header`) is the one header for list, form, admin and
collection pages. It is a stack of four text levels, each optional except the h1, read top
to bottom in decreasing weight:

| Level       | Prop          | Looks                                                                                                                                                      | Holds                                                                                                                                                                                                                      |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| breadcrumbs | `breadcrumbs` | 12px secondary                                                                                                                                             | the path to the parent (table below)                                                                                                                                                                                       |
| title       | `title`       | h1, `--font-size-title-page` (22px), weight 600, tight tracking, balanced wrapping                                                                         | what the page is                                                                                                                                                                                                           |
| meta line   | `description` | 13px secondary, one line                                                                                                                                   | facts about the entity: the collection byline (author avatar, places count, update time). Listings do not use it: their count is in the `PaginationBar` range, a line under the title would push the list down for nothing |
| lede        | `lede`        | 14px primary text, 1.55 line height, the full width of the text column; at most 3 lines (2 on phones), the last ending in "… Подробнее" (`ExpandableText`) | a few sentences introducing the page: the category text, the location summary                                                                                                                                              |

Then `leading` for an avatar before the text, `actions` — `small` buttons on the h1's own
line, right-aligned, folded into the line box so the title line is no taller than without
them; under the title on phones — and `aside` for a block beside the text — the map
preview of a location landing — 340px wide, top-aligned with the title, stacking under the
text on phones. The header sits on the page background: the lede is never boxed in a
`Container` and never greyed out — it is the page's first paragraph, not a footnote.
The place page and the user profile use a hero instead. On the place page the same
`Breadcrumbs` sit above the cover on the page background, the h1 and the meta line sit on
the cover (`PlaceHero`) and the actions are a row under it (`PlaceActions`); on the profile
the h1 and actions are in the title row attached to the bottom of the profile card
(`UserHeader`). The h1 size is one token everywhere (`--font-size-title-page` in `styles/theme.css`, 22px), so a
list title and a hero title read as the same level, above the prose headings and container titles.

Breadcrumbs appear only on nested pages, where the app bar cannot show where you are:

| Page                                                                                                                                                                       | Breadcrumbs                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Section roots: places, collections, people, map, activity, categories, tags, search                                                                                        | none                                |
| Filtered places list (`/places?category=…`)                                                                                                                                | Места › parent filters              |
| Category / location / pair landing (`/places/{category}`, `/places/{location}`, `/places/{location}/{category}`, behind the `NEXT_PUBLIC_LANDING_*` flags — see CLAUDE.md) | Места › location parents › location |
| Place page (above the cover, on the page background)                                                                                                                       | Места › category                    |
| Collection page                                                                                                                                                            | Коллекции                           |
| Create / edit place                                                                                                                                                        | Места (› place)                     |
| User sub-pages (places, photos, bookmarks, …), settings                                                                                                                    | Люди › name                         |
| Admin sub-pages                                                                                                                                                            | admin section                       |

The trail starts at the section (the logo is the way home) and stops at the parent; the
current page is the h1 next to it, so it is not repeated. There is no "back" button: the
last crumb is the way back. Schema.org `BreadcrumbList` is separate data and keeps the
full chain from the home page.

## 5. Cards

### `MediaTile` — photo tile primitive (`components/shared/media-tile`)

Cover filling the card, an optional gradient band at the top (collections put the author
there, place tiles the category icon) and one at the bottom (title, subline, stats). 260px high, `--border-radius`, `--container-shadow`, hover zoom.
Every "entity on a cover" tile is built on it. `coverSrc` draws one cover, `covers` a
mosaic of up to four (see `CollectionCard`). Overlay content uses `mediaTileStyles`
(`author`, `title`, `subline`, `stats`, `stat`) so the typography and colours are
the same for every entity. `MediaTileGrid` is the 3-column flow.

### `PlaceCard` (`components/shared/place-card`)

The one card for a place.

| Variant                 | Use                                                                            | Thumb                      | Heading                        |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------- | ------------------------------ |
| `tile` (default)        | `/places`, user places / bookmarks / visited, home carousel, "nearby" carousel | cover fills the tile       | `h2`                           |
| `row` + `size="large"`  | places on the collection page                                                  | 200×140 (120×84 on phones) | `h2`                           |
| `row` + `size="medium"` | search results                                                                 | 120×80                     | `h3` (inside a titled section) |
| `row` + `size="small"`  | dense pickers and popups (map popup, planned)                                  | 96×72                      | `h3`                           |

Invariant order of parts in both variants: cover → category icon → title → address →
stats row. The category is never a text label on a card: a tile shows its icon (16px) in
the top-left corner over the cover, a row puts it (16px) before the title; the name is the
icon's tooltip and accessible name (see `CategoryIcon`). Stats order is fixed: rating, distance, views, photos. A card is about the place:
it never shows who added it or when, and list responses (`ApiModel.PlaceListItem`) do not
even carry `author`. Props: `distanceKm` / `distanceLabel` override the API distance;
`actions` puts controls on the right of a row or over the top-right corner of a tile (edit
mode on the collection page); the row variant also has `leading` and `footer` slots for a
marker and extra text. `PlaceCardLoader` is the matching skeleton.

Known deviations / follow-ups:

- The map popup in `components/map/marker-point` still has its own markup; it should
  become `PlaceCard` `row` with a bookmark action.
- `updated` is still returned in lists only to version the cover URL (`?d=`), because the
  cover file path does not change when the cover is replaced. Move the version into the
  `cover` object on the server (e.g. a versioned `preview` URL) and drop `updated` from
  `PlaceListItem`.

### `PlacesMap` (`components/shared/places-map`)

The map of a fixed set of places: a collection, a user's places, bookmarks and visited
places. Category markers with the usual place popup, in a `Container` with a 3px frame,
360px high (220px on phones). The viewport is fitted to all places (32px padding, min zoom 3
so places across the country fit); a single place is centred at zoom 11. No scroll-wheel
zoom, no layer switcher or category filter. Renders nothing without places. On the user
pages it sits under the tabs, so the tabs keep their place when switching to a tab
without a map.

`compact` (200px instead of 360/220px) and `fullMapQuery` (a query string appended before
the `#lat,lon,zoom` hash of the "Открыть на большой карте" link, e.g. `?category=cave` — see
`pages/map.tsx`) are additive props for `LandingMapPreview` below; the collection/user-pages
usage is unaffected.

### `LandingMapPreview` (`components/shared/landing-map-preview`)

The location/pair landing page's compact map block (features/20-location-seo-pages.md,
"Шаблон страницы → Карта"), passed to `PageHeader` as its `aside`: wraps `PlacesMap`
(`compact`) behind an `IntersectionObserver` gate, so Leaflet is only loaded once the block
scrolls into view — the mobile first screen never pays for it. Takes the page's own place
list (already fetched for the grid) as markers; renders nothing without placed places, same
as `PlacesMap`. Category-only and `/places` pages have no map — places there are
nationwide, a preview would not mean anything.

### `PaginationBar` (`components/shared/pagination-bar`)

The row under a paginated list: the range of this page's items ("22–42 из 132", 13px
secondary) on the left and the `Pagination` links on the right, on the page background;
on phones the links come first, centred, with the range under them. Renders nothing when
everything fits on one page — the list itself is the count then. Page links are 32px
squares: secondary text, `--surface-2` on hover, `--color-main` on `--color-main-background`
for the current page, the same states as tabs and link pills. Every paginated list uses it
(places, collections, people, the user's places / bookmarks / visited / collections /
photos, the admin mailing table); there is no other pagination row.

### `ListingToolbar` (`components/shared/listing-toolbar`)

The filter row of a list page (section 6, "Listing toolbar"): `ListingToolbar` is the row,
`ListingToolbarGroup` keeps related controls together — `PlaceFilterPanel` (location +
category, then sort + order) and `UsersFilterPanel` (search, then sort + order) are built
from it and own no layout of their own.

### `LocationLinkList` (`components/shared/location-link-list`)

A titled `Container` of link pills with an optional count — one component behind all four
perelinking blocks of the landing template: category chips, child locations, "this
category by region", "this category nearby" (features/20-location-seo-pages.md, "Шаблон
страницы"). Renders nothing without items.

### `CategoryIcon` (`components/shared/category-icon`)

A place's category as its square icon (`public/images/poi/<category>.png`: a flat
rounded square, 12% corner radius like the logo, white pictogram, no border). Takes the
category key (`ApiModel.Categories`, what the API returns) and resolves the label from the
client catalogue (`utils/categories.ts` → `getCategoryTitle`); no component ever receives a
category title from the API. Links to
the category (`/places?category=…`, or `/places/{category}` once `NEXT_PUBLIC_LANDING_CATEGORIES`
is on — see CLAUDE.md → Environment and `utils/placesLanding.ts`) with the category name in
a kit `Tooltip` and as the link's name.
The category's colour is the icon background itself; there is no separate colour map. Sizes in use: 16 (cards, search
suggestions; small on purpose, so the category does not outweigh the cover and title),
40 (place hero, next to the h1). The place page shows the icon once, in the hero; the
breadcrumbs name the category in text (and the schema.org `BreadcrumbList` has the same
category level), so the sidebar facts have no category row.

### `CollectionCard` (`sections/collections/collection-card`)

`MediaTile` with a **cover mosaic** instead of one cover: the covers of the first places
in the author's order that have photos, up to four (`collection.covers` from the API).
One cover fills the tile, two make two columns, three put a tall one on the left and two
stacked on the right, four make a 2×2 grid. The mosaic is what tells a collection tile from
a place tile at a glance; it is derived on the server and follows the membership and order
automatically, so there is no cover setting — the author changes it by reordering the
places. On top: author + update time; below: title, region link and a stats row (places,
views).

## 6. Patterns

- **Dialogs.** `Dialog` with a `title`, body, and an actions row aligned right, secondary
  action first and the primary action last, both `size="medium"`. A destructive action in a
  settings dialog sits on the left of the footer as a `mode="link"` `variant="negative"`
  button and always asks for confirmation (`ConfirmationDialog`) naming what is deleted.
- **Prose.** Rendered markdown (place description, collection article) uses the `prose`
  mixin from `styles/mixins.sass`: 15px body (`--font-size-prose`) on a 1.55 line height, semibold `h2` 18px / `h3` 16px with
  more space above than below, disc/decimal lists, a left-bordered quote, rounded images,
  code on `--surface-2`. The place page keeps it inside the "Описание" `Container`, the
  collection page shows it bare on the page background; the text itself looks the same.
- **Form fields.** Kit `Input`, `Select`, `TextArea` and the project's `ContentEditor`
  (`components/ui/content-editor`, the markdown editor for descriptions) are outlined:
  `--input-background-color` (surface-1) with `--input-border` and the kit focus ring, so a
  field reads as a field on the page background and inside a `Container` alike. Grey
  surfaces — markers, snackbars, hover rows, badges — use `--surface-2`, never input tokens.
  `ContentEditor` is dressed as a `TextArea`: one bordered box, a 36px toolbar row of
  small icon buttons with a divider, text area of at least 120px (`minHeight`) that grows
  with the content; it has no save/cancel buttons of its own.
- **Forms in dialogs.** `Input`/`Select` `size="medium"`, labels above, character counters
  under limited fields, hints in `$fontSizeCaption` secondary text. Save is disabled until
  something changed.
- **Form state and unsaved changes.** Forms are built on `react-hook-form` (`useForm` +
  `Controller`, since kit fields don't forward refs); validation messages come from `rules`
  and server errors are put on their fields with `setError`. Anything the user can lose —
  a page form, an inline editor, a dialog, a comment draft — is wrapped in
  `useUnsavedChangesGuard(isDirty)` (`hooks/`): links, Back/Forward and router pushes open
  `<ConfirmationDialog {...dialogProps} />`, closing the tab gets the browser prompt.
  In-page discards (Cancel, closing a dialog) go through `confirmDiscard`; call
  `allowNavigation()` before navigating away after a successful save.
- **Pickers** ("В коллекцию", "Добавить места"): a search input only when the list is
  long, rows of 40px thumbnail + title + caption + control, a single collapsed "create"
  affordance at the bottom. "В коллекцию" is a domain component
  (`components/shared/add-to-collection`: `AddToCollectionButton` + `AddToCollectionModal`,
  used on the place page and in the map popup, `hideLabel` for the icon-only variant); other
  picker-style rows reuse its `collectionPickerStyles` instead of copying them.
- **Map popups** (reference: `components/map/osm-candidates/CandidatePopup`): 280px wide,
  no Leaflet inner margins; an optional full-bleed cover of a fixed height (156px, so autopan
  is right before the image loads) with the photo credits under it, dropped on a load error;
  then a 12px-padded body with 12px gaps: title (13px, weight 300, line height 1.3, the same as
  the place popup; up to 3 lines) → 13px secondary sublines → kit `Badge` chips with tooltips → callouts → the primary action
  (`size="medium"`, stretched) → collapsible details → 12px external links. The close button
  is the place popup's plain 24px cross: white over a cover, grey without one.
  Admin actions are full-width buttons: confirming a found duplicate inside its callout, "hide for good"
  (`outline` `negative`) last; destructive ones ask for confirmation.
  Exception to "tokens, not values": the candidate group colours (`GROUP_COLORS`) are hex
  values in JS, because Leaflet paints the markers from `pathOptions`;
  the photo counter over a cover is the same fixed dark pill as the stats over `MediaTile`.
- **Photo gallery** (`PhotoGallery`: profile, place page, place form, the user's photos page):
  a grid of 4:3 tiles, four columns (two on phones) with 4px gaps, so 8 photos make two
  whole rows; only the outer corners of the whole grid are rounded, tiles are square; previews are 700×500. The first 8 are shown and the rest collapse behind
  "Ещё фотографии"; a page of photos passes `showAll`.
- **Tabs** (`components/ui/tabs`, the user profile: activity, achievements, places,
  bookmarks, visited, collections, photos): a bar on a card (`--container-shadow`,
  4px padding) of items styled like the app bar navigation — 36px high (32px on phones),
  secondary text, `--surface-2` on hover, `--color-main` on `--color-main-background` for the
  active one. Tabs that are pages are links (`href`, `aria-current="page"`), never
  `router.push`. On phones the bar scrolls sideways without a scrollbar, the active tab is
  scrolled into view and the cut-off edges fade out. A kit primitive candidate.
- **Listing toolbar** (`ListingToolbar` + `ListingToolbarGroup`, used by `PlaceFilterPanel`,
  `UsersFilterPanel` and the admin `SendingMailFilterPanel`): the filter row directly above a list, on the page background,
  never in a `Container`. One row: the filters group (location, category; or the search
  field), then the sorting group (sort field, order); on wide screens every kit control
  gets the same width, however many there are, 8px apart. On phones the row scrolls
  sideways at fixed control widths with the groups kept together.
- **Expandable text** (`components/ui/expandable-text`): a paragraph that shows at most N
  lines (3, or 2 on phones) and ends with "… Подробнее" on the last visible line — the cut
  is measured (a hidden twin is laid out with shorter prefixes until the text, the ellipsis
  and the control fit), trimmed to a word, and re-measured on resize. The control is text
  only, in `--color-main`, inline with the text — never on a line of its own, never hiding
  a single word behind a whole extra line. A text that fits gets no control; expanding is
  one-way. The header lede and any other long intro use it; typography comes from the
  parent. A kit primitive candidate.
- **Empty states.** `EmptyState` with a title, one sentence and at most one action; copy
  differs for owners (what to do) and readers (what to expect).
- **Notifications.** Success and error toasts via `Notify`; an entity link in the toast is
  passed as `place` / `collection`, never embedded in the text. Raw API bodies are never
  shown (see `app/errorMiddleware.ts`).
- **Edit mode.** "Редактировать" in the page header or hero; in edit mode it becomes
  "Отмена" + "Готово" — the one place where text edits are confirmed or dropped (inline
  editors have no buttons of their own; list edits save as they happen). In edit mode lists show
  compact `size="small"` `mode="outline"` icon buttons grouped on the right, inline forms use
  `size="small"` controls of one height, Enter saves and Escape cancels.
- **Labels.** Actions are verbs that name the result ("В закладки", "В коллекцию",
  "Добавить места"), never generic "Сохранить" for a toggle. Icons are not reused across
  unrelated actions (the plus circle means "add place" in the app bar only).

## 7. Adding a component — checklist

1. Is it a primitive? Add it to `simple-react-ui-kit` and release the kit first.
2. Does an entity component already exist? Extend it with a variant or slot instead.
3. Put domain components in `components/shared/<name>` with `index.ts`, styles module and
   a test; sections only compose them.
4. Use tokens and `$mobileMaxWidth`; check the phone layout.
5. Add the component to the table in section 5 (or a new section) of this file.
