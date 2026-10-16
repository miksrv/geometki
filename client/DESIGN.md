# Geometki design system

How the client UI is built and where each piece lives. Read this before adding or
changing any user-facing component.

## 1. Principles

- **One component per entity, variants for layout.** A place is always a `PlaceCard`, a
  collection is always a `CollectionCard`. Density and orientation are props, never a
  second component. Recognisability comes from the invariant parts, not from the layout.
- **Three entities, three page archetypes.** A place, a person and a collection must not
  look alike, so each entity page has its own skeleton and the reader always knows where
  they are. Place: a detail page that reads like an article (clean cover → title with the
  facts and the actions → the text + a sticky "where is it" card). Person: a
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

One font: the system stack of the kit (`--font-family`: San Francisco on Apple devices, Segoe
UI on Windows, Roboto on Android) with grayscale antialiasing (`styles/globals.sass`), no web
fonts. One scale, in pixels (sizes never drift with the parent): the tokens are in
`styles/theme.css` (kit tokens give 12 / 14 / 16) and step down on phones by themselves.

Text is set by **role**: a mixin of `styles/typography.sass` (`@use … as type`, then
`+type.titlePage`) carries the size, the weight, the line height and the tracking together,
so one level looks the same on every page. A component takes a role; a bare token is for
the rare text that is no role (a glyph, an input that must stay 16px on iOS).

| Role (mixin)   | px (phones) | Token                       | Weight · line height · tracking | Use                                                                        |
| -------------- | ----------- | --------------------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `titleDisplay` | 40 (28)     | `--font-size-display`       | 700 · 1.1 · −0.02em             | the guest home hero only; the rating average of the place                  |
| `titlePage`    | 30 (24)     | `--font-size-title-page`    | 600 · 1.15 · −0.01em, balanced  | **every page `h1`** (see below)                                            |
| `stat`         | 22          | `--font-size-stat`          | 600 · 1.1, tabular figures      | a number that is the point of its block: feed pulse, year in numbers, "+N" |
| `lead`         | 20 (17)     | `--font-size-lead`          | 400 · 1.55                      | the first paragraph of the place text                                      |
| `titleSection` | 18          | `--font-size-title-section` | 600 · 1.3 · −0.01em             | section `h2` (`Section`), prose `h2`                                       |
| prose          | 17 (16)     | `--font-size-prose`         | 400 · 1.7                       | long-form markdown (`prose` mixin of `styles/mixins.sass`)                 |
| `titleBlock`   | 16          | `--font-size-large`         | 600 · 1.3                       | block and card titles, sidebar `h3`, prose `h3`                            |
| `body`         | 14          | `--font-size`               | 400 · 1.5                       | UI text, controls, card text, the facts line of the place                  |
| `secondary`    | 13          | `--font-size-secondary`     | 400 · 1.45, secondary colour    | address, byline, values of a card                                          |
| `caption`      | 12          | `--font-size-small`         | 400 · 1.4, secondary colour     | breadcrumbs, captions, counters                                            |
| `overline`     | 12          | `--font-size-small`         | 600 · 1.4 · +0.04em, uppercase  | labels over groups of rows: feed days, menu and sheet titles               |
| `micro`        | 11          | `--font-size-micro`         | 400 · 1.35                      | credits and badges over photos, map labels                                 |

**One `h1` style everywhere.** The place, a collection, a profile, a list or landing, a form,
settings, the sign-in and 404 pages — the `h1` is `titlePage`, so the reader always knows
the top level of a page, and a title moving between page kinds never changes its look. The
guest home hero (and its closing band) is the one showcase on `titleDisplay`; a heading on a
coloured band may be 700 for contrast, never a different size.

Weights are the kit tokens (`--font-weight-normal` 400, `-medium` 500, `-semibold` 600);
700 is the bold of the showcase bands and the counters on them, 300 the map popup titles.
Exceptions to the scale: 10px for the counters on map markers and clusters and the axis
labels of `ContributionCalendar` — dense graphics, not text. No ad-hoc `em` or odd pixel
sizes anywhere else. Above the kit's 4…24px spacing the project adds `--space-8` (32px) and
`--space-10` (40px) for the air between reading sections; the first block of every page is
`--space-4` (16px) under the app bar.

## 2. Two layers

| Layer             | Lives in                                               | Knows about                    | Examples                                                                                            |
| ----------------- | ------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Primitives        | `simple-react-ui-kit` (separate repo, Storybook there) | Nothing domain-specific        | `Button`, `Input`, `Select`, `Dialog`, `Container`, `Popout`, `Icon`, `Skeleton`, tokens            |
| Domain components | `client/components/shared`                             | `ApiModel` types, routes, i18n | `PlaceCard`, `CollectionCard`, `FeedStory`, `MediaTile`, `UserAvatar`, `CategoryIcon`, `EmptyState` |

Page-specific composition lives in `client/sections/<area>` (e.g. `sections/collections`),
pages themselves in `client/pages`. Sections may compose domain components; they must not
re-implement them.

## 3. Layout

- **Width.** Content is capped by `--width-max` (1260px); the app bar is the only global
  chrome, there is no permanent sidebar.
- **Lists** are a grid of tiles on the page background, three columns on desktop and one
  on phones (`MediaTileGrid`, `--space-6` between rows and `--space-5` between columns: place
  tiles carry their text under the cover). Lists never sit inside a `Container`.
- **Place page** (`pages/places/[id]`): reads like an article, acts like a tool. Every block
  answers one question and no fact is repeated between them.
    - `PlaceHero` — "what is it and where": the `Breadcrumbs` (desktop) on the page background,
      then `PlaceCover`: the clean cover at 3:1 (at least 240px; cover files are 1800×600) with
      only a small credit over it, `--radius-xl` corners; no cover — no picture on desktop. On
      phones it is an edge-to-edge 4:3 carousel (CSS scroll snap) of the cover and the first 8
      photos with a "1 / N" pill of all of them (it opens all the photos in the viewer grid) and a last slide inviting
      to add photos; a tap opens that photo in the viewer. Under the picture, on the page background: the h1
      (`titlePage`) and one facts line — category (18px icon + name, a link to its
      places, in primary text), rating (a link to `#reviews`, or to `#rate` while unrated;
      plain for the author), reviews count (`#reviews`), distance. The address is only in the
      "Где это" card, the views only in "О месте".
    - `PlaceActions` — one main path: "Маршрут" is the only primary button, its menu holds
      "Карта Геометок" and the navigators (`MapLinks label="brand"`); then "Я здесь
      был(а)" (`WasHereButton`, green once marked), "Сохранить" (icon; a menu with the bookmark
      toggle and "В коллекцию"), "Поделиться" (icon; native share or the networks + copy link)
      and "⋯" (add photo, link photos nearby, change cover, edit, copy link, delete for admins).
      `variant="toolbar"` sits on the h1's line on desktop; `variant="bar"` is passed to
      `AppLayout` as `bottomBar` and replaces the bottom navigation on phones (same 52px height
      and translucent surface, 44px buttons), its menus open as `BottomSheet`s.
    - `.pageLayout` — a `1fr 360px` grid, `--space-6` between the columns. The main column is a
      flow of boxless sections `--space-10` apart (`--space-8` on phones): the photo mosaic
      (desktop only, below), the text, "Оценки и отзывы", "Что ещё посмотреть", "О месте". The
      sticky right column (`top: 64px`) is the "Где это" card. On phones the column dissolves
      and the order is explicit: text → "Где это" → reviews → explore → about (read → see where
      → go).
    - Photos — `PhotoGallery variant="mosaic"` with a visually hidden h2 (the photos speak for
      themselves): one big and four small tiles, a free tile becomes a dashed "Добавить фото"
      while there are fewer than five, a full mosaic carries a quiet "Добавить фото" pill over
      the big photo and "+N" on the last tile. A tile opens its photo, "+N" all the photos in
      the `PhotoViewer` (controlled `viewer`, shared with the hero carousel); the mosaic tiles
      carry no menus, editing is in the viewer. No photos: the whole block is the dashed drop
      target. `FileDropZone` wraps it all. Phones do not show the section.
    - The text — `PlaceDescription` with a visually hidden h2: `prose` at the reading size, the
      first paragraph a lead, markdown `#`/`##` rendered as h3, clamped at 540px (420 on phones)
      with a fade and "Читать полностью ⌄"; under it the tags as quiet chips. Read only: the
      text is edited in the place form ("⋯ → Редактировать"), a place without one links there.
    - "Где это" — `PlaceLocation` (`Container`): the interactive map (230px, the nearby places as
      markers) bleeding to the card edges, the distance over the address (most specific first,
      every level a link), the coordinates (copy on click), the navigators as three equal tiles,
      a rule, `PlaceVisited` (overlapping avatars + "3 человека были здесь"), the stretched
      "Я здесь был(а)" and the `PlaceCollections` line ("В 2 коллекциях: A, B и ещё N").
    - "Оценки и отзывы" — `PlaceReviews` (`#reviews`, a `Container` because it is interactive):
      the average (44px number, five read-only stars, the count) next to the bars of the scores
      5…1 (`distribution` of `GET /rating/:id`), `PlaceRatePrompt` (`#rate`) on a `--surface-2`
      plate — the only interactive stars, empty until hovered, a word per score, none for the
      author — then the reviews and the field with a hint on what to write; a guest gets the
      same field, a tap opens the sign-in dialog.
    - "Что ещё посмотреть" — `PlaceExplore`: button `Tabs` "Рядом" / the short category name
      ("Инженерные сооружения") over a `ScrollRail variant="cards"` of `PlaceCard` tiles; the link
      action follows the tab and carries the region ("Все места рядом" / "Все — Оренбургская
      область" to the location × category landing). Both lists stay in the HTML, the
      inactive one `hidden` — they are internal links for crawlers. A region tab with fewer
      than three places is dropped.
    - "О месте" — `PlaceAbout` (`Container`): the byline (avatar, the author's name, then one
      line "Автор · добавлено … · обновлено …" and, always on a line of its own under it, the
      editors as "[faces] 2 редактора"; views and photos on the right), then
      `PlaceActivity` as a disclosure row (an h3 button with the count): compact feed stories
      without the place, loaded on the first open.
- **Collection page** (`pages/collections/[id]`): `CollectionHeader` (a `PageHeader` with a
  byline) → the map (`PlacesMap`, see section 5) on the full content width →
  the description as article prose on the full content width (`prose` mixin) → the places as the usual
  `MediaTileGrid` of `PlaceCard` tiles. No cover, no sidebar, no facts block and no
  containers: the map is the visual of a collection, the title is its only heading. Order
  is the author's, but it is not numbered — numbers would read as a route. In edit mode
  the same tiles get small move/remove buttons over the top-right corner of the cover
  (`PlaceCard` `actions`), and a full-width "Добавить места" button follows the grid.
- **Places listing / landing pages** (`pages/places/index.tsx` for `/places`, `pages/places/landing/[...slug].tsx`
  for the `NEXT_PUBLIC_LANDING_*` pages): one skeleton, all of it page
  chrome on the page background, no `Container` anywhere above the perelinking blocks:
  `PageHeader` with the places count on the h1's baseline (`count`) and (page 1 only) the lede — the
  category's text, or the location summary — and, on location/pair pages, `LandingMapPreview`
  in the `aside` slot → the sticky filter panel (`PlaceFilterPanel`, section 6) → `PlacesListing`:
  the `MediaTileGrid` of `PlaceCard` tiles with the `PaginationBar` (desktop) or "Показать ещё"
  (phones) → (page 1 only) the `LocationLinkList` perelinking
  blocks, which are `Container`s because they are titled content. `/places` and category
  pages have no map: places there are nationwide. Filter changes build the canonical path
  (`utils/placesLanding.ts` `buildPlacesHref`) instead of `/places?…` once the relevant flag
  is on.
- **Home page** (`pages/index.tsx`, blocks in `sections/home`): its blocks are sections,
  `--space-6` apart (`--space-5` on phones) like on every page, the first one `--space-3` under
  the app bar. One page, two sets of blocks chosen by `isAuth` (never by user agent: a crawler
  is a guest and gets the guest page; the title, canonical and JSON-LD are the same for both).
  Guest: `HomeHero` (the photo `images/pages/home-hero.jpg` with the h1 — the one `titleDisplay`
  h1 of the site, 40px / 28px on phones — the lead, the site search (`SiteSearch variant="hero"`, the
  same as the app bar), the three fullest categories as chips plus "Рядом со мной", the live numbers
  of `/stats`) → `HomeCategories` (tiles of every category with places and their counts, twelve
  shown, six on phones, the rest hidden but still in the markup for the links) → `HomePlaces`
  ("Куда поехать": button `Tabs` popular this week / new / nearby over a `ScrollRail variant="cards"` of
  `PlaceCard` tiles; nearby asks for the location on its button only) → `HomeHowItWorks` (three
  step cards, each with a picture made of real pieces of the site — the fullest category icons,
  the "Я здесь был(а)" button, growing `LevelBadge`s — and the experience the step brings as the
  server counts it) → `HomeCollections` (`CollectionCard`s in a
  `MediaTileGrid`; a short row ends with a dashed "make your own" tile) → the regions
  `LocationLinkList` → the feed (three stories) and people `Container`s → `HomeJoin` (the brand
  gradient band with the sign-up button). Signed-in user: `HomeWelcome` (a card: the 96px square
  avatar as on the profile → three lines: the greeting h1, a 13px line "since {year} · the
  experience left to the next level", the `LevelBadge` + kit `Progress` + "experience / next"
  → the places / photos / visits counters on the right, each a link to that list of the
  profile, under the rest on phones; no action buttons — adding a place is in the app bar) → a
  `1fr 360px` grid of the feed and a side column with `HomeUnexplored` (OSM candidates around
  the visitor's location, picker-style rows, each a link to the map there) and the people → the
  categories as a `LocationLinkList` with counts → `HomePlaces` → `HomeCollections`. Chips and
  pills here have the `--border-radius` corners of every pill on the site, never round ends.
- **Sections, not containers.** The parts of one entity (its description, photos,
  comments, history, the facts about it) are `Section`s (`components/shared/section`, the
  same `title` / `action` / `footer` slots as the kit `Container`, a kit candidate): an h2
  (h3 in a sidebar, `level={3}`) with an optional `action` (`mode="link"` buttons),
  separated from each other by whitespace alone, on the page background. A box groups by enclosure, whitespace groups by proximity; nesting
  boxes inside the page card reads as "object inside object", which these are not.
- **Containers** (`Container` from the kit) are reserved for things of another nature than
  the page itself: a form (also a section switched to edit mode), a tool card with its own
  purpose (the "Где это" map card on the place page), and titled link blocks on listing
  pages (`LocationLinkList`). They carry a `title` and an optional `action`. Page chrome —
  the page header, filters, lists, pagination — sits on the page background, never in a
  `Container`. Empty states are a single line in place of the content, never an empty box.
- **Breakpoint.** One: `$mobileMaxWidth` (768px). The one exception is the feed's side column
  (`/activity`, the profile), which goes on top below `$feedSideColumnMaxWidth` (1024px): next
  to it the feed column would be under ~500px. Below 768px columns stack and side action
  groups wrap under the content.

## 4. Page header and breadcrumbs

`PageHeader` (`components/shared/page-header`) is the one header for list, form, admin and
collection pages. It is a stack of four text levels, each optional except the h1, read top
to bottom in decreasing weight:

| Level       | Prop          | Looks                                                                                                                                                      | Holds                                                                                                                                                                                           |
| ----------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| breadcrumbs | `breadcrumbs` | 12px secondary                                                                                                                                             | the path to the parent (table below)                                                                                                                                                            |
| title       | `title`       | h1, `titlePage` (30px, 24 on phones), weight 600, tight tracking, balanced wrapping                                                                        | what the page is                                                                                                                                                                                |
| meta line   | `description` | 13px secondary, one line                                                                                                                                   | facts about the entity: the collection byline (author avatar, places count, update time). Listings do not use it: their count sits on the title's baseline (`count`, 16px secondary: "48 мест") |
| lede        | `lede`        | 14px primary text, 1.55 line height, the full width of the text column; at most 3 lines (2 on phones), the last ending in "… Подробнее" (`ExpandableText`) | a few sentences introducing the page: the category text, the location summary                                                                                                                   |

Then `leading` for an avatar before the text, `actions` — `small` buttons on the h1's own
line, right-aligned, folded into the line box so the title line is no taller than without
them; under the title on phones — and `aside` for a block beside the text — the map
preview of a location landing — 340px wide, top-aligned with the title, stacking under the
text on phones. The header sits on the page background: the lede is never boxed in a
`Container` and never greyed out — it is the page's first paragraph, not a footnote.
The place page and the user profile use a hero instead. On the place page the
`Breadcrumbs` sit above the cover, the h1 and the facts line under it on the page
background, with the actions on the h1's line (`PlaceHero`, `PlaceActions`); on the profile
the h1 and actions are in the title row attached to the bottom of the profile card
(`UserHeader`). The h1 is `titlePage` everywhere (section 1a).

Breadcrumbs appear only on nested pages, where the app bar cannot show where you are:

| Page                                                                                                                                                                       | Breadcrumbs                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Section roots: places, collections, people, map, activity, search                                                                                                          | none                                |
| Filtered places list (`/places?category=…`)                                                                                                                                | Места › parent filters              |
| Category / location / pair landing (`/places/{category}`, `/places/{location}`, `/places/{location}/{category}`, behind the `NEXT_PUBLIC_LANDING_*` flags — see CLAUDE.md) | Места › location parents › location |
| Place page (above the cover, desktop only)                                                                                                                                 | Места › category                    |
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

A 260px cover (`--radius-xl`, no shadow, hover zoom) with an optional gradient band over its
top (collections put the author there) and the text under it on the page background: the
title (`titleBlock`, one line with an ellipsis) and one `secondary` line of facts, where the
first item gives way (an ellipsis) to the short stats — the same type and colours as the
`PlaceCard` tile, so both kinds of tiles read as one
grid. The cover is taller than a place's 2:1 on purpose: a mosaic needs the room.
`coverSrc` draws one cover, `covers` a mosaic of up to four (see `CollectionCard`). Content
uses `mediaTileStyles` (`author` — white, for the top band; `title`, `meta`, `region`, `stat`
— under the cover; `media` — the cover box, e.g. the home page's dashed "create" slot).
`MediaTileGrid` is the 3-column grid for both kinds of tiles.

### `PlaceCard` (`components/shared/place-card`)

The one card for a place.

| Variant                 | Use                                                                                         | Thumb                    | Heading                        |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------ |
| `tile` (default)        | `/places`, collection page, user places / bookmarks / visited, home and "nearby" card rails | 2:1 cover, text under it | `h2`                           |
| `row` + `size="medium"` | search results                                                                              | 120×80                   | `h3` (inside a titled section) |
| `row` + `size="small"`  | dense pickers and popups (map popup, planned)                                               | 96×72                    | `h3`                           |

The heading level is the `headingLevel` prop (2 by default, 3 inside another titled block).

Invariant order of parts in both variants: cover → category icon → title → address →
stats row. The title is one line cut with an ellipsis in both (the full title is the link's
`title`); so is a row's address + stats line, the address giving way to the stats. A row then shows at most two lines of the description (`content`, 13px, markdown
stripped) when the list sends it — search and the feed do, tile lists do not. The category is never a text label on a card: a tile shows its icon (24px, alone with a soft
shadow) in the top-left corner over the cover, a row puts it (16px) before the title; the name is the
icon's tooltip and accessible name (see `CategoryIcon`). Stats order is fixed: rating, distance, views, photos.

The tile is not a `MediaTile`: a 2:1 cover (`--radius-xl`, hover zoom; the previews are
680×300, cut from 3:1 covers, so a taller frame would crop and upscale them) and, under it on
the page background, the title (`titleBlock`, one line with an ellipsis, so the rows of a grid
line up), the address (`secondary`, one line of links) and the stats (the rating
as a gold `StarFilled` with a bold number, the distance as `--color-main` text without an icon).
Over the cover: the one-tap bookmark in the top-right corner (`PlaceCardBookmark`, a 32px dark
translucent circle, `--color-main` when on; a guest gets the sign-in dialog) and, for the
visitor's visited places, a green "Вы были здесь" pill bottom-left. The bookmark is on a tile
of any list: a signed-in visitor's state comes from `GET /bookmarks/places` (all their
bookmarked IDs, one cached request for every card, refreshed by each toggle), `bookmarked` of
`PlaceListItem` fills in until it loads — never a request per card. The pill reads `visited`,
which `GET /places` sends for a signed-in visitor only. A card is about the place:
it never shows who added it or when, and list responses (`ApiModel.PlaceListItem`) do not
even carry `author`. Props: `distanceKm` / `distanceLabel` override the API distance;
`actions` puts controls on the right of a row or over the top-right corner of a tile instead
of the bookmark (edit mode on the collection page); the row variant also has `leading` and `footer` slots for a
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

`compact` (200px high) and `fullMapQuery` (a query string put before the `#lat,lon,zoom`
hash of the "Открыть на большой карте" link, e.g. `?category=cave`) serve `LandingMapPreview`.

### `LandingMapPreview` (`components/shared/landing-map-preview`)

The location/pair landing page's map, passed to `PageHeader` as its `aside`: `PlacesMap`
(`compact`) behind an `IntersectionObserver` gate, so Leaflet loads only once the block
scrolls into view. Markers are the page's own place list; renders nothing without places.
Category-only and `/places` pages have no map.

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
`ListingToolbarGroup` keeps related controls together — `UsersFilterPanel` (search, then
sort + order) and the admin `SendingMailFilterPanel` are built from it and own no layout of
their own. The places listing has its own panel (`PlaceFilterPanel`, section 6).

### `PlacesListing` (`sections/place/places-listing`)

The grid of `/places` and the landing pages with its pagination: the `PaginationBar` on
desktop; on phones "Показать ещё N" appends the next page under the same URL with "Страница
1 из N" under it, while the page links stay in the markup (hidden) for crawlers.

### `LocationLinkList` (`components/shared/location-link-list`)

A titled `Container` of link pills with an optional count — one component behind all four
perelinking blocks of the landing template: category chips, child locations, "this
category by region", "this category nearby". Renders nothing without items.

### `CategoryIcon` (`components/shared/category-icon`)

A place's category as its square icon (`public/images/poi/<category>.png`: a flat
rounded square, 12% corner radius like the logo, white pictogram, no border). Takes the
category key (`ApiModel.Categories`, what the API returns) and resolves the label from the
client catalogue (`utils/categories.ts` → `getCategoryTitle`); no component ever receives a
category title from the API. Links to
the category (`buildCategoryHref`: `/places?category=…` or `/places/{category}`) with the
category name in a kit `Tooltip` and as the link's name.
The category's colour is the icon background itself; there is no separate colour map. Sizes in use: 16 (cards, search
suggestions; small on purpose, so the category does not outweigh the cover and title),
18 (the place hero facts line, followed by the category name: on the place page the
category is the first fact, so it is spelled out). The place page names the category once,
in the hero; the breadcrumbs repeat it in text on desktop (and the schema.org
`BreadcrumbList` has the same category level).

### `CollectionCard` (`components/shared/collection-card`)

`MediaTile` with a **cover mosaic** instead of one cover: the covers of the first places
in the author's order that have photos, up to four (`collection.covers` from the API).
One cover fills the tile, two make two columns, three put a tall one on the left and two
stacked on the right, four make a 2×2 grid. The mosaic is what tells a collection tile from
a place tile at a glance; it is derived on the server and follows the membership and order
automatically, so there is no cover setting — the author changes it by reordering the
places. Over the top of the cover: author + update time; under it: the title and one line —
the region link, places, views. `showAuthor={false}` drops the author where it is already shown (a feed story);
`headingLevel={3}` inside another titled block, as for `PlaceCard`.

### Activity feed (`components/shared/feed`)

The feed shows that the site is alive. The server sends ready **stories** — a group of
events of one author (a new place with its photos, a batch of ratings, a review) or an
achievement / a new level (`ApiModel.FeedStory`; grouping rules in
`server/app/Libraries/FeedAggregator.php`), so the client never groups anything.

- `FeedStory` — one card per story, the same for every kind: a head (avatar, author link,
  what happened, time ago) and a body that depends on the kind. Bodies reuse the entity
  components: photos are always one `FeedPhotoMosaic` (1 wide, 2 columns, 1 tall + 2, 2×2
  with "+N", any tile opens the lightbox) — a new place is a `PlaceCard` tile + the start of
  its description + the mosaic of its photos, a photo story is the mosaic with the place as
  a `PlaceCard` row; a review is a quote with
  the place row; ratings, visits and places added to a collection are up to three place rows
  (a rating with the author's five read-only stars in the row footer) and "and N more"; a
  collection is a `CollectionCard` without the author; an achievement / a level is its badge
  on a `--surface-2` plate. The action never carries a grammatical gender: Russian uses a noun
  phrase after a dash ("Мария — новое место"), English a verb ("Maria added a place").
- Weight sets the size: 3 (a picture), 2 (a card), 1 — edits, ratings, visits — a tighter
  card. The avatar is always `medium` (36px), the height of the two lines of the head. Cards
  sit on the page background, `--container-shadow`, 12px apart, as wide as their column.
- `density="compact"` puts the stories inside another block — the home page container, the
  place history section: no card of their own, a rule between them, place tiles become rows
  and descriptions are left out. `hidePlace` (the place history) drops the place from every
  story, a rating moves its stars into the head.
- Days are the viewer's days (the `tz` cookie, see CLAUDE.md → Visitor time zone).
  Relative times ("5 minutes ago") are `suppressHydrationWarning`.
- Photos of a story are named after the place ("Усадьба — фото 2") in `alt` and in their
  buttons; the last tile's button also says how many photos are left.
- `FeedList` — the stories in order, under day headings ("Сегодня", "Вчера", "1 октября",
  12px uppercase secondary) when `groupByDay`; two `FeedStoryLoader` skeletons while loading;
  an empty feed is one line of text.
- `FeedPulse` — "This week" (or "This month" when the week was quiet): the non-zero counts
  as 22px numbers with captions, the most active people (`UserAvatarGroup`), "last activity
  5 minutes ago" with a green live dot. `compact` is one line for the home page widget.

Where it is: `/activity` — `PageHeader`, then a `1fr 320px` grid: type
filter `Tabs` (links `?type=places|photos|reviews|collections|achievements`) above the feed
grouped by day with infinite scroll (`useInfiniteScroll`), `FeedPulse` in the sticky right
column (first on phones). Home page — a `Container` with the compact pulse and the five
latest stories of weight 2+, next to the "Активные пользователи" container (the main column
of the signed-in layout), as an exception to "lists never sit inside a `Container`": the
home widgets are titled blocks. Profile (`sections/user/user-activity`) — `ContributionCalendar`
across the page, then the same `1fr 320px` grid: the author's feed by day and
`ContributionSummary` in the sticky column.
Place page — the collapsed "История изменений" row at the end of "О месте": compact stories without the place,
"Показать больше" loads the next page.

### `ContributionCalendar` (`components/shared/contribution-calendar`)

A year of a person's activity (`GET /feed/calendar`): a square per day, weeks as columns,
the colour a share of `--color-main` by quartiles of the busiest day, month names over the
columns, weekday names on the left, a "Less ▢▢▢▢ More" legend. One CSS grid stretched to
the full width (about 20px squares on a desktop); a square is never under 10px, below that
(phones) the year scrolls sideways, opened at the latest weeks. Weeks start on Monday in
Russian and on Sunday in English. A `Container` titled with the year's total, the year's
count in its `action`: on the page background the empty squares (`--surface-2`) would merge
with it.

`ContributionSummary` — "The year in numbers", counted on the client from the same calendar:
actions, active days, the longest and the current run of days in a row (22px numbers in a
2×2 grid, the `FeedPulse` look) and the busiest day. Renders nothing for an empty year.

## 6. Patterns

- **Dialogs.** `Dialog` with a `title`, body, and an actions row aligned right, secondary
  action first and the primary action last, both `size="medium"`. A destructive action in a
  settings dialog sits on the left of the footer as a `mode="link"` `variant="negative"`
  button and always asks for confirmation (`ConfirmationDialog`) naming what is deleted.
- **Prose.** Rendered markdown (place description, collection article) uses the `prose`
  mixin from `styles/mixins.sass`: 17px body (`--font-size-prose`, 16px on phones) on a 1.7 line height, semibold `h2` 18px / `h3` 16px with
  more space above than below, disc/decimal lists, a left-bordered quote, rounded images,
  code on `--surface-2`. Both pages show it bare on the page background; the place page adds
  the lead (the first paragraph at `--font-size-lead`) and renders markdown h1/h2 as h3.
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
- **Menus** (every kit `Popout` with actions: the place actions, the user menu, a
  collection's and a photo's menus): the kit card (`--popout-radius`, a 1px ring and
  `--shadow-lg`) holds a `ul.contextListMenu` (`styles/globals.sass`), 220px minimum, 4px
  around the rows. A row is a link (navigates) or a button (acts in place), the same look:
  36px minimum, 8px × 12px insets, rounded `--radius-md`, an 18px icon (or a service logo) in
  `--icon-color-secondary` 12px before 14px primary text, `--surface-2` on hover and focus.
  Groups are split by `li[role="separator"]` (a 1px rule); `.contextListMenuLabel` (overline)
  names a group above the list; an on/off row ends with `.contextListMenuCheck` in
  `--color-main`; a destructive row is `li[data-negative]`, red text and icon, last and after
  a rule. The same lists go into the phone `BottomSheet` with 48px rows.
- **Bottom sheets** (`components/ui/bottom-sheet`, a kit primitive candidate: the kit
  `Popout` always opens downwards): the menus of a bar at the bottom of a phone screen slide
  up over a dimmed page — a grab handle, an optional 12px uppercase title, the same
  `contextListMenu` rows as the desktop popouts with 48px touch targets. Closes on the
  backdrop, Escape and any chosen row; focus goes in and back to the trigger. A form sheet
  (the places filters) passes `closeOnSelect={false}` and a `footer` pinned under the
  scrolling content.
- **Filter primitives** (`components/ui`, kit candidates, made in the app for the places
  filters): `Chip` — a 36px pill (28px `small`) with an optional icon, a toggle (`selected`,
  `--color-main` fill, `aria-pressed`) or a removal (`removable`, tinted with a ✕), a link with
  `href`, an optional quiet `count` after the label (facets); `ScrollRail` — the one horizontal scroller of the site (native scroll, no carousel
  library): round white arrows with a shadow while there is more to a side, hidden on touch
  screens; `chips` (items of their own width, faded edges, `ScrollRailSeparator` between
  groups) and `cards` (three equal place tiles, one and a peek on phones, scroll snap, bigger
  arrows at the middle of the covers, an arrow turns a whole row); `FieldTrigger` — the face of a field-like
  `Popout` trigger (icon, quiet name, value, chevron; outlined in `--color-main` when set);
  `OptionList` — rows to pick one value (32px icon tile, label and caption, a check on the chosen
  one, overline group labels); `Switch` — an on/off button (`role="switch"`), `field` (40px
  outlined, next to fields) or `row` (label and caption with the track on the right).
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
- **Photo viewer** (`PhotoViewer`, the place page): one dark full-screen viewer in both themes,
  two modes. All the photos — a header with the place, "Все фото (N)", "Добавить фото" and
  the close button (icons only on phones), a hint for editors, a grid of 4:3 tiles (200px
  minimum, two columns on phones) with "Повернуть" / "Удалить" over the corner on hover
  (always on touch screens; no rotation for linked photos) and "ваше фото" on the visitor's
  own. One photo — `PhotoLightbox` (zoom, swipes, the author caption, the "3 / 12" counter)
  with "Все фото" and "Добавить фото" in its toolbar, back to the grid at the same photo.
  Under the dialogs, so a delete confirmation shows over it.
- **Tabs** (`components/ui/tabs`, the user profile: activity, achievements, places,
  bookmarks, visited, collections, photos; the filters of `/activity`): a bar on a card (`--container-shadow`,
  4px padding) of items styled like the app bar navigation — 28px items, so the bar is 36px like a medium control,
  secondary text, `--surface-2` on hover, `--color-main` on `--color-main-background` for the
  active one. Tabs that are pages are links (`href`, `aria-current="page"`), never
  `router.push`. On phones the bar scrolls sideways without a scrollbar, the active tab is
  scrolled into view and the cut-off edges fade out. A kit primitive candidate.
- **Places filters** (`PlaceFilterPanel`, `/places` and the landing pages, built from the
  filter panel pieces): three questions —
  where, what, in which order — and only one filter of the site's own data, "Скрыть
  посещённые" (signed in, `?notVisited=1`, noindex). The URL is the only state: every change is a
  `buildFilterHref` link or push on page 1 (`buildPlacesHref` underneath, so landing paths
  win when the flags are on). The whole block is sticky under the app bar on a near-opaque page
  background (no `backdrop-filter`: it repaints on every scroll frame).
    - Desktop: one row — "Где" (`FieldTrigger` in a kit `Popout`: the search field, "Рядом со
      мной" (the distance sort over everything, asks the browser), "Везде", the three recent
      locations, the five fullest regions; typing shows found regions, districts and cities), the
      sort (`OptionList` of presets with their natural direction: popular now, for you (signed
      in), nearest, top rated, most viewed, newest, most discussed; there is no order control,
      `?order=` of old links is kept until the sort changes), the "Скрыть посещённые" `Switch`,
      with nothing applied a dashed "Продолжить: …" link to the last filtered search of this
      browser (read after mount: it sits in the row so the panel's height never changes), then
      `Tabs` "Список / Карта" on the right (the map gets the same single category). Under it
      the category rail (`ScrollRail` of `Chip` links: "Все", then the categories in their themed
      groups, `CATEGORY_GROUPS`, split by rules; several can be on), then the applied filters
      (removable `Chip`s and "Сбросить всё"). Filters apply at once.
    - Phones: a round search bar "Где искать?" with the summary under it and a round filters
      button with a counter, over the same rail; the applied row is hidden. "Где" opens a
      `BottomSheet` with the same options (applies on pick); the filters open a form sheet —
      sort pills, the categories as a 3-column grid by group, the switch row — with "Сбросить" and
      "Показать N мест" (counted for the draft, debounced). A floating "Карта" button sits over
      the bottom navigation.
    - Remembered in `localStorage` (`usePlacesFilterMemory`), never applied by itself: the
      recent locations and the last search.
- **Filter panel** (`components/shared/filter-panel`, the pieces of both panels below):
  `FilterPanel` (the block on a translucent blurred page background, `sticky` `always` or
  `phones`), `FilterToolbar` (the desktop row, `FilterToolbarSpacer` pushes the rest right),
  `FilterPopout` (a `FieldTrigger` with a dropdown, a fixed width), `FilterPhoneBar` and
  `FiltersButton` (the round phone button with the number of filters set), `CategoryRail`
  (the `ScrollRail` of category `Chip` links; with `counts` — the facets of a search — only the
  categories with places and those on, each with its number), `AppliedFilterList` (removable
  chips and "Сбросить всё") and `FiltersSheet` (the phone form sheet: sort pills, the category
  grid, the page's own rows; the page keeps the draft).
- **Site search** (`components/shared/site-search`: `SiteSearch` + `SiteSearchScreen`, data in
  `hooks/useSiteSearch`, the app bar and the home hero): a combobox, never a kit field. The panel
  answers before anything is typed — "Места рядом со мной" (asks the browser), "Недавние" (the last
  six searches and opened rows of this browser, `useSearchHistory`, with "Очистить"), "Популярные
  регионы" — and from three characters on (`GET /search/suggest`, debounced, the previous answer
  stays while the next loads): "Искать «…»" (the search page, also Enter with no row chosen), the
  point of typed coordinates, "Места" (category icon, category and "locality, region"), "Регионы и
  города" (the site's locations with places, their listing, the count), and only without them
  addresses "На карте". The `OptionList` look: 32px tiles, 44px rows (52px full-screen), overline
  group labels, the words of the query in semibold (`utils/highlight.ts`). Rows are links (a new
  tab works); arrows go round through the field, Enter opens, Escape closes; a footer names the
  keys on keyboard devices. Variants: `bar` (a quiet `--surface-2` field, 440px panel; "/" and
  Ctrl/⌘ K focus it from anywhere), `hero` (52px white field with a big shadow; the hero cuts the
  photo in `.backdrop`, so the panel hangs out of it), `screen` (phones: the whole screen, a back
  button, 16px text against the iOS zoom). Narrow screens get the app bar icon button and the hero
  field (`screenMaxWidth`) opening `SiteSearchScreen`.
- **Search filters** (`SearchFilterPanel`, `sections/search`, `/search`): the same pieces
  over the results and the map. The URL is the only state (`?q=&type=&category=a,b&sort=`,
  `buildSearchHref`); the API is always asked for every kind of result, so the `type` is the
  `Tabs` "Все · Места N · Адреса N · Координаты" (a tab with nothing is hidden, "Координаты"
  only when the query is a point). Where places are shown and found: the sort presets
  (`FilterPopout`, the most relevant first, "Ближе ко мне" asks the browser), the
  `CategoryRail` with the facets (`places.categories` of the response, counted before the
  category filter) and the applied filters. Desktop: not sticky — the results scroll in
  their own column; phones: sticky, the tabs with `FiltersButton` and the sheet ("Показать N
  мест" is counted from the facets, no request).
- **Listing toolbar** (`ListingToolbar` + `ListingToolbarGroup`, used by `UsersFilterPanel`
  and the admin `SendingMailFilterPanel`): the filter row directly above a list, on the page background,
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
- **Notifications.** Success and error toasts via `Notify` (`NotifyReplace` to update a toast
  with the same id); an entity link in the toast is passed as `place` / `collection`, never
  embedded in the text. Raw API bodies are never shown, and background requests (polling,
  marking read) never toast (see `app/errorMiddleware.ts`). One component, `Notification`:
  `variant="toast"` in the snackbar (at most four on screen, the rest queue; the countdown
  pauses on hover, focus and a hidden tab; errors are `role="alert"`, the snackbar is a polite
  live region) and `variant="list"` for the rows under the bell.
- **Edit mode.** "Редактировать" in the page header or hero; in edit mode it becomes
  "Отмена" + "Готово" — the one place where text edits are confirmed or dropped (inline
  editors have no buttons of their own; list edits save as they happen). In edit mode lists show
  compact `size="small"` `mode="outline"` icon buttons grouped on the right, inline forms use
  `size="small"` controls of one height, Enter saves and Escape cancels.
- **Labels.** Actions are verbs that name the result ("В закладки", "В коллекцию",
  "Добавить места"), never generic "Сохранить" for a toggle. "Сохранить" names a menu of
  such toggles only (the place page: bookmarks and collections). Icons are not reused across
  unrelated actions (the plus circle means "add place" in the app bar only).

## 7. Adding a component — checklist

1. Is it a primitive? Add it to `simple-react-ui-kit` and release the kit first.
2. Does an entity component already exist? Extend it with a variant or slot instead.
3. Put domain components in `components/shared/<name>` with `index.ts`, styles module and
   a test; sections only compose them.
4. Use tokens and `$mobileMaxWidth`; check the phone layout.
5. Add the component to the table in section 5 (or a new section) of this file.
