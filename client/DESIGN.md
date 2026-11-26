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
| `titleSection` | 18          | `--font-size-title-section` | 600 · 1.3 · −0.01em             | section `h2` (`Section`), prose `h2`                                       |
| `reading`      | 17 (16)     | `--font-size-prose`         | 400 · 1.7, primary colour       | text on the page background: the header lede, a memo, a paragraph          |
| prose          | 17 (16)     | `--font-size-prose`         | 400 · 1.7                       | long-form markdown (`prose` mixin of `styles/mixins.sass`)                 |
| `titleBlock`   | 16          | `--font-size-large`         | 600 · 1.3                       | block and card titles, sidebar `h3`, prose `h3`                            |
| `body`         | 14          | `--font-size`               | 400 · 1.5                       | UI text, controls, card text, the facts line of the place                  |
| `secondary`    | 13          | `--font-size-secondary`     | 400 · 1.45, secondary colour    | address, byline, values of a card                                          |
| `caption`      | 12          | `--font-size-small`         | 400 · 1.4, secondary colour     | breadcrumbs, captions, counters                                            |
| `overline`     | 12          | `--font-size-small`         | 600 · 1.4 · +0.04em, uppercase  | labels over groups of rows: feed days, menu and sheet titles               |
| `micro`        | 11          | `--font-size-micro`         | 400 · 1.35                      | credits and badges over photos, map labels                                 |

**Text on the page background is read, not scanned.** A paragraph that lies on the page
background itself — no `Container`, card or band under it: the `PageHeader` lede, the memo
under the game's head, a paragraph between sections, the place description — is `reading`
(or `prose` for rendered markdown), 17px (16 on phones) on 1.7. `body` (14px) is the text
of the interface: inside cards, containers, dialogs, controls and forms. So a page's own words
look the same on every page, and the first paragraph is never smaller than the rest of the text.

**One `h1` style everywhere.** The place, a collection, a profile, a list or landing, a form,
settings, the sign-in and error (404, 500) pages — the `h1` is `titlePage`, so the reader always knows
the top level of a page, and a title moving between page kinds never changes its look. The
guest home hero (and its closing band) is the one showcase on `titleDisplay`, and the greeting
of the signed-in home (`UserProfileCard variant="home"`) is the one `h1` on `titleSection`: a line of a card next
to the avatar, not the name of a page. A heading on a coloured band may be 700 for contrast,
never a different size.

Weights are the kit tokens (`--font-weight-normal` 400, `-medium` 500, `-semibold` 600);
700 is the bold of the showcase bands and the counters on them, 300 the map popup titles.
Exceptions to the scale: 10px for the counters on map markers and clusters and the axis
labels of `ContributionCalendar` — dense graphics, not text. No ad-hoc `em` or odd pixel
sizes anywhere else. Above the kit's 4…24px spacing the project adds `--space-8` (32px) and
`--space-10` (40px) for the air between reading sections; the first block of every page is
`--space-4` (16px) under the app bar.

## 2. Two layers

| Layer             | Lives in                                               | Knows about                    | Examples                                                                                                        |
| ----------------- | ------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Primitives        | `simple-react-ui-kit` (separate repo, Storybook there) | Nothing domain-specific        | `Button`, `Input`, `Select`, `Dialog`, `Container`, `Popout`, `Icon`, `Skeleton`, tokens                        |
| Domain components | `client/components/shared`                             | `ApiModel` types, routes, i18n | `PlaceCard`, `CollectionCard`, `UserCard`, `FeedStory`, `MediaTile`, `UserAvatar`, `CategoryIcon`, `EmptyState` |

Page-specific composition lives in `client/sections/<area>` (e.g. `sections/collections`),
pages themselves in `client/pages`. Sections may compose domain components; they must not
re-implement them.

## 3. Layout

- **Width.** Content is capped by `--width-max` (1260px); the app bar is the only global
  chrome, there is no permanent sidebar.
- **Lists** are a grid of tiles on the page background, three columns on desktop and one
  on phones (`MediaTileGrid`), with the list gaps below. Lists never sit inside a `Container`.
- **Gaps.** Two kinds between blocks, tokens in `styles/theme.css`, never bare numbers:
    - **A list** — places, collections, quests, people, a rail of place tiles
      (`ScrollRail variant="cards"`) and its loaders: `--gap-list-row` (`--space-6`) between rows and
      `--gap-list-column` (`--space-5`) between columns, the same on every page. Tiles carry their
      text under the cover, so rows get more air than columns. The one exception: people on
      phones turn into lines, `--space-2` apart.
    - **Widgets** — the columns of a page (`1fr 360px` / `1fr 320px`: the home page, the place
      page, `/activity`, the profile, the game), the blocks of a side column, two cards side
      by side: `--gap-widgets` (`--space-4`), smaller than
      a list's — each is framed by its own surface.
    - Apart from both: the flow of the sections of a page, `--space-6` (`--space-5` on phones),
      and the page's own gap (`AppLayout`, `--space-4`) between the header, the content and the
      pagination — a list adds no margins of its own above or below.
- **Place page** (`pages/places/[id]`): reads like an article, acts like a tool. Every block
  answers one question and no fact is repeated between them.
    - `PlaceHero` — "what is it and where": the `Breadcrumbs` (desktop) on the page background,
      then `PlaceCover`: the clean cover at 3:1 (at least 240px; cover files are 1800×600) with
      only a small credit over it, `--border-radius` corners (as every photo and container); no cover — no picture on desktop. On
      phones it is an edge-to-edge 4:3 carousel (CSS scroll snap) of the cover and the first 8
      photos with a "1 / N" pill of all of them (it opens all the photos in the viewer grid), an "Добавить фото" pill
      of the same look in the other bottom corner and a last slide inviting to add photos; a tap opens that photo in the viewer. Under the picture, on the page background: the h1
      (`titlePage`, the full width: a long title is never squeezed by the buttons) and one facts
      line, the desktop actions on its right — category (18px icon + name, a link to its
      places, in primary text), rating (a link to `#reviews`, or to `#rate` while unrated;
      plain for the author), reviews count (`#reviews`), distance. The address is only in the
      "Где это" card, the views only in "О месте".
    - `PlaceActions` — one main path: "Маршрут" is the only primary button, its menu holds
      "Карта Геометок" and the navigators' route builders to the place in a new tab (`MapLinks
label="brand" directions`: Yandex Maps and Google Maps; Wikimapia has no routes); then "Сохранить" (icon; a menu with the bookmark
      toggle and "В коллекцию"), "Поделиться" (icon; native share or the networks + copy link)
      and "⋯" (add photo, link photos nearby, change cover, edit, copy link, delete for admins).
      No "Я здесь был(а)" here: it is only in the "Где это" card (a check-in from it on a phone
      opens the bar's sheet with the visit's questions, `openVisitSheet`).
      `variant="toolbar"` sits right of the h1 and the facts on desktop, centred on both lines; `variant="bar"` is passed to
      `AppLayout` as `bottomBar` and replaces the bottom navigation on phones (same 52px height
      and translucent surface, 44px buttons), its menus open as `BottomSheet`s.
    - `.pageLayout` — a `1fr 360px` grid, `--gap-widgets` between the columns like
      every side column. The main column is a
      flow of boxless sections `--space-6` apart (`--space-5` on phones) like on every page: the photo mosaic
      (desktop only, below), the text, "Оценки и отзывы", "Что ещё посмотреть", "О месте". The
      sticky right column (`top: 64px`) is the "Где это" card. On phones the column dissolves
      and the order is explicit: text → "Где это" → reviews → explore → about (read → see where
      → go).
    - Photos — `PhotoGallery variant="mosaic"` with a visually hidden h2 (the photos speak for
      themselves): one big and four small tiles, a free tile becomes a dashed "Добавить фото"
      while there are fewer than five, a full mosaic carries a quiet "Добавить фото" pill over
      the big photo and "+N" on the last tile. A tile opens its photo, "+N" all the photos in
      the `PhotoViewer` (controlled `viewer`, shared with the hero carousel); the mosaic tiles
      carry no menus, editing is in the viewer. No photos: the whole block is an `UploadZone`
      ("Фото этого места пока нет"). `FileDropZone` wraps it all. Phones do not show the section.
    - The text — `PlaceDescription` with a visually hidden h2: `prose` at the reading size (one
      size from the first paragraph on), markdown `#`/`##` rendered as h3, clamped at 540px (420 on phones)
      with a fade and "Читать полностью ⌄". Read only: the
      text is edited in the place form ("⋯ → Редактировать"), a place without one links there.
    - "Где это" — `PlaceLocation` (`Container`): the interactive map (230px, the nearby places as
      markers) bleeding to the card edges, the distance over the address (most specific first,
      every level a link), the coordinates (copy on click), the navigators as three equal tiles,
      "Как сейчас" (`PlaceNow`, 1–3 rows from the visitors' answers: "Дорога грунтовка…", under it "5 из 6 · day" and earlier years; then the features as two rows, "**Можно** купаться · рыбачить" and "**Нельзя** костёр", with the latest day, the agreement of each only in its `title`; hidden without answers),
      a rule, `PlaceVisitors` (up to five overlapping avatars and "N человек были здесь", under it
      "Последний визит: 13 октября 2026 · 23 визита"), the stretched "Я здесь был(а)" (`WasHereButton`:
      one tap checks in and a toast tells the visit number, no sheet, no form; for a week after a visit it reads "Вы здесь отметились" and a tap cancels the visit), under it (desktop only: on phones they are the bottom bar's sheet) `PlaceVisitQuestions` while the visitor's latest visit, of any day, lacks answers (up to three one-tap questions, one at a time: a short heading, `Chip`s, a quiet "Пропустить"; the last step, "Что здесь можно?", is a three-state `Chip` per feature — plain → `selected` yes → `negative` no → cleared, the taps of a few seconds saved in one request, the quiet button "Готово") and the `PlaceCollections` line ("В 2 коллекциях: A, B и ещё N").
    - "Оценки и отзывы" — `PlaceReviews` (`#reviews`, a `Container` because it is interactive):
      the average (44px number, `ScoreStars size="medium"`, the count) next to the bars of the scores
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
  is the author's, but it is not numbered — numbers would read as a quest. The author and any
  administrator get "Редактировать" (text only) and the actions menu in the header. In edit mode
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
  `PlaceCard` tiles; nearby asks for the location on its button only) → `HomeGameIntro` ("Игра":
  one line of what the game is, then the signed-in page's `GameSeason variant="home"` of the
  current or the announced season without a visitor's line — "Войти и играть", "Как играть ·
  Рейтинги сезона · Квесты"; from the cached `GET /game`, nothing between seasons) → `HomeHowItWorks` (three
  step cards, each with a picture made of real pieces of the site — the fullest category icons,
  the "Я здесь был(а)" button, growing `LevelBadge`s — and the experience the step brings as the
  server counts it) → `HomeCollections` (`CollectionCard`s in a
  `MediaTileGrid`; a short row ends with a dashed "make your own" tile) → the regions
  `LocationLinkList` → the feed (three stories) and people `Container`s → `HomeJoin` (the brand
  gradient band with the sign-up button). Signed-in user — not a summary of the sections (the
  navigation is that) but **the next step**, in the order of the site's one loop (find a place →
  go → confirm → geopoints), the person's own before the common: `UserProfileCard
variant="home"` (the profile's card, smaller: the greeting instead of the name, the avatar the
  only way to the profile (a ring on hover), no buttons; the facts are what moves — the week's
  actions and the run of days from the user's calendar, never the year of sign-up) → what they
  are in the middle of: the quest being walked, a `QuestCard` `size="small"` (the overline
  "Вы проходите квест" in place of the mode, the green bar "2 из 4 точек" and the primary
  "Продолжить квест" at its foot),
  `HomeFirstSteps` for a newcomer — no explored place and none added — ("С чего начать": three
  `--surface-2` tiles in one card, each a 40px icon mark, a title, one sentence and a secondary
  button; a step done has a green check and "Сделано" instead of the button; gone after the
  first visit or place, so nobody meets a row of zeros), then `HomeGame` (the season, the
  visitor's place; "The game" below) → `HomePlaces` with `recommended` (the tabs are "Для вас" —
  by the interests —, "Рядом со мной", "Новые"; the first two without the places already
  explored) → a `1fr 360px` grid of the feed (five stories) and a side column with
  `HomeUnexplored` (OSM candidates around
  the visitor's location, picker-style rows — the photo or the category icon of its map marker,
  the distance from the visitor on the right — each a link to the map there) and the people (the ten last seen: who is online, who was here and when; the block ends where the feed ends — the feed sets the height of the row, the list scrolls inside, and with a short feed the block keeps its 280px and goes no further) → `QuestsPromo`
  when there are quests left and none is being walked → `HomeCollections`. No categories list
  here: it is a section of the navigation, kept on the guest page. Chips and
  pills here have the `--border-radius` corners of every pill on the site, never round ends.
- **Profile** (`pages/users/[id]` and its tabs, `sections/user`): the person archetype — the
  profile card with its two pages at its foot; every page has the same head, so nothing
  jumps when switching.
    - `UserHero` — the `Breadcrumbs` (desktop) on the page background, then `UserProfileCard`
      (`variant="profile"`, section 5). The owner gets "Сменить фото" (the crop dialog,
      `UserAvatarEditor`) and "Настройки" under the level row, `small` secondary buttons on the
      left edge of the text; anyone else sees the same card without buttons.
    - The pages of the profile — "Обзор", "Места" — are not a bar of their own:
      they are the foot of the card (`UserProfileCard` `activeSection`). There are no pages of
      collections, bookmarks, visits or achievements: their old addresses redirect
      (`next.config.js`) to the matching set of "Места" (301) or to the profile (achievements:
      301, the awards are in the card; collections: temporary, they may come back); all
      the photos are a sub-page (below).
    - "Обзор" (`UserActivity`) — the place page's two columns, `1fr 320px`, `--gap-widgets` apart
      like the signed-in home, the side blocks `--gap-widgets` apart too. The main column: the
      `ContributionCalendar` (the year's activity) first, then the person's map (`UserPlacesMap`,
      no heading — the map speaks for itself: the places the person added, has been to and keeps
      in bookmarks on one `PlacesMap`, the places the person has been to and keeps in
      bookmarks with a round badge on the marker's top-right corner (`ToneBadge`,
      `components/map/tone-badge`), told by a white glyph as well as the colour — visited a check
      on `--color-green`, bookmark a bookmark on `--color-orange` — always, with one set only
      too; the places they added are plain markers; a place in several sets takes the badge of
      the first of visited, bookmark, added (`PlaceMark.tone`); the category icon itself stays
      clean, never framed; nothing stands over the map, so it sits right under the calendar:
      the set shown is chosen on the map itself, in its free top-right corner (absolutely
      positioned at the level of the map controls, under the app bar, not a map control) — a
      small radio group, one `--surface-1` plate as high as a `small` button (the kit's control size) with the chosen one on the
      brand tint: "Все 108", then each non-empty set with its number, the visited and
      bookmarks ones with the badge of their markers (the group is the legend, there is none
      under the map; on phones such a set is the badge and the number alone); with a single
      set there is no group; next to it a `small` secondary "Список мест" button leads to the
      list of the set shown; "Во весь
      экран" among the map controls on the left (`PlacesMap fullScreen`: only where the browser
      can put an element full screen — not an iPhone's Safari; full screen the wheel zooms);
      loaded in the
      browser, a set the profile's counts say is empty is not asked for, nothing at all without
      places), then the photos
      (`PhotoGallery boxless titleHidden`: no visible heading — a grid of photos says what it is,
      the name "Фотографии" stays for screen readers —, eight tiles, and when there
      are more the last one is darkened and carries "+390" — the rest —, a link to the photos
      sub-page: the sign of the place page's mosaic, no "Все N" on the heading's line) and the feed by
      day. Collections are not on the profile. The side column (not sticky: its blocks may be
      taller than the screen), every block a card: "Игра" (`UserGame`), "Задания" (`UserTasks`: the same `GameAwards` as
      the season's "Награды сезона" under another title — every limited award running now, begun
      and not over, whatever season is on or none, with the person's progress; nothing while none
      runs) and "Вклад" (`UserContribution`:
      ratings, reviews, edits as icon rows, hidden while all are zero). Below 1024px the side
      column comes first.
    - "Места" (`pages/users/[id]/places.tsx`) — `small` `Chip` links of the sets, `?show=`:
      "Добавленные" (default), "Посещённые" (the places visited at least once, the card's
      "посещено"; `?show=visits` of old links opens them), "Избранное"; the counts from the
      profile's statistic. Lists only (`PlacesList` + `PaginationBar`): the map is on the
      overview. An empty set is the same `EmptyState` in all
      three (the picture, a title and a sentence of its own): the owner reads what to do and gets
      a button ("Добавить место" for the added ones, "Найти места" for the rest), anyone else
      reads what will appear there. `EmptyState` falls back to "try other filters" without a
      `description`: a page that is not a search always passes one.
    - All the photos (`pages/users/[id]/photos.tsx`) — a sub-page of the overview, not a tab:
      the same `UserHero` ("Обзор" marked), then "Фотографии (N)" as a boxless
      `PhotoGallery`, 32 a page.
    - The reputation history (`pages/users/[id]/reputation.tsx`, `UserReputation`) — a sub-page
      the card's reputation leads to: the same `UserHero`, then a `Section` "История репутации"
      with the number of scores on the title's line, and every score that moved the reputation,
      the newest first, loaded as the list scrolls (`GET /users/:id/reputation`, 20 a page),
      grouped by month under the feed's overline with the month's sum at its end. A score is a
      low card like `AchievementRow` (`--surface-1`, the container shadow, 8px apart): the 56×42
      cover (the category icon without one) | the title, one line, over the score's
      `ScoreStars variant="single"` (★ 5), then "за добавление места · 3 ноября" (caption) | the share in a tinted badge in the secondary size,
      green or red — not a `stat`: a list of many numbers. Who scored is not told. Skeleton rows
      while loading; no scores — `EmptyState`.
- **Settings** (`pages/users/settings.tsx`, `UserForm`): a page of the profile, so it has the
  profile's head — `UserHero` (`isSettings`: the owner's "Настройки" button turns `primary`, the
  page shown, next to "Сменить фото"; a skeleton of the card until the user loads) — then a
  `FormSections` (section 6, "Page forms in parts"): the menu of the parts and the titled
  `FormSection` cards, "Профиль" and "Уведомления" with a secondary line on what they are for. "Профиль" (the name
  and the website side by side, the email read only with a hint), "Уведомления" (the device's
  push on a `--surface-2` plate, then the events in two overline groups, "Ваши места" and
  "Достижения и дайджест": a row per event with a `small` toggle `Chip` per channel in a fixed
  slot, an empty slot where the channel does not carry the event) and "Вход и пароль" (the
  password fields, or the service the account signs in with). Then "Отмена" and "Сохранить" in
  `FormActions` (section 6, "Page form actions") with "Есть несохранённые изменения". Skeleton
  cards while the profile loads.
- **Place form** (`pages/places/create.tsx`, `pages/places/[id]/edit.tsx`, `PlaceForm`):
  `PageHeader`, the page's messages (a server error, the OpenStreetMap hint, a new
  translation), then `FormSections` (section 6): the menu and the cards, each with a secondary
  line on what goes in it: "Название и категория" (the title and a searchable category select
  one under another on the full width), "Местоположение" (the map, 360px, 280px on phones: its center
  is the place, the category's icon marks it; the map shows the coordinates itself, so none
  under it — only an error on them, in red, with a red map border), "Описание"
  (`ContentEditor`, a line that the text is in one's own words) and, on a new place only,
  "Фотографии" (a line that photos can wait; an `UploadZone` "Добавьте фотографии места",
  then the gallery with its "Добавить фото" tile; `FileDropZone` around both). Then `FormActions`: "Добавить
  место" on a new place, enabled without changes (a prefilled one may be right as it is),
  "Сохранить" on an edit; off while photos upload. A new empty place starts at its title; an
  edit does not autofocus.
- **People page** (`pages/users/index.tsx`, `sections/user/users-listing`): a community, not a
  register — no table. `PageHeader` with the people count on the h1's baseline and (page 1, no
  search) the lede → `UsersFilterPanel` (a sticky `FilterPanel`: the name search, 300px, and
  the `SortPopout` of the presets "Активные" / "По сезону" (the game: the season's whole rating) / "По опыту" / "По репутации" / "Новички", each
  with a caption and its natural direction, under the search across the row on phones; there is no order control, `?order=` of old links is kept until
  the sort changes) → `UsersListing`: a 3-column grid of `UserCard` tiles (one column of
  lines on phones) with the `PaginationBar` on desktop and "Показать ещё" on phones, like
  `PlacesListing`. The cards are numbered only when the list is a ranking — sorted by
  experience or reputation, without a search. Nothing found — `EmptyState`.
- **The game** (`pages/game`, `sections/game`; features/26). The section people come back for.
  The words of it, the same in every text: **геометки** (the places), **геопоинты** (the points
  of a season, earned for explored geotags and kept in that season), **исследование** (being at
  a place; the people of the site are **исследователи**), **открытие** (adding a place to the
  map). In the navigation the map is always first (the one page with a template of its own),
  then the places, then "Игра" and, in the app bar, "Квесты"; in the phone bottom navigation
  the game takes the place right after the centre (the explorers give theirs up there, the
  quests are a tap away from the game page). Every page of it is rendered on the request,
  never cached: all of it is the visitor's own.
    - **Game page** (`/game`, `GamePage`) is the current season and its only page
      (`/game/seasons/<current>` redirects here), block under block on the full width, no
      `PageHeader`. Seasons are made by hand in the admin (own dates, title, description,
      one picture — the participant's medal — and its gold / silver / bronze variants), so there are gaps: between seasons `GET /game` has no season and
      the head is `GameNoSeason` — a calm card with the h1 "Новый сезон скоро начнётся", one
      short paragraph and two secondary buttons (rules, quests); the rating, the player's own
      season and the places are not rendered, the past season, the memo and `QuestsPromo`
      stay. A season announced but not begun (`upcoming`) has the same page without the
      rating: the card with "Скоро" and "Начнётся 1 декабря", the medals, the awards, the past
      season. Below, `GameSeason` is for the current one:
        1. `GameSeason`, the head — the one card of a season wherever it is shown, as
           `UserProfileCard` is of a person. `variant="page"` (here and on a past season's
           page): `--space-6`, a 112px picture (72 on phones), the season's name the h1 in
           `titlePage`. `variant="home"` (`HomeGame` on the signed-in home page): simpler —
           `--space-5`, 96px / 64, the name an h2 in `titleSection` that leads to `/game`, no
           dates, and compact: the head is no taller than the picture (overline, name, bar of
           time, a line of plain links "Рейтинги сезона · Как играть"). In both a neutral brand tint
           (`--color-main`) colours the left edge of the card — a season has no colour of its own.
           Above: the season's picture (the owner's, or a drawn star badge) | an
           overline ("Игровой сезон продолжается"; "Скоро" for an upcoming one), the name, the dates (page), the season's time as a
           thin 6px bar in the season's colour with "осталось 20 дней" (orange in the last week;
           it is time, not a goal: decorative, no `progressbar`), a line of plain links through a dot ("Рейтинги
           сезона · События · Как играть" on the home page; on the page "Все участники сезона ·
           События · Как играть", the first leads to the explorers' list in the season's order;
           "События" is the feed's check-ins, `/activity?type=visits`), "Войти и
           играть" for a guest (not for an upcoming season, which shows "Начнётся 1 декабря"
           in the place of the bar and has no counters) | the counters —
           `StatTiles`, the profile card's tiles, information only (no links): the visitor's
           place (a dash until they have geopoints; none for a guest) and how many play
           ("игроков"). Never "из N".
           On the page the card ends there — the rating and the valuable places are the
           page's own blocks —, after a full-width paragraph with the season's description (`reading`
           size; none without a description). The card has no administrator's controls: the
           buttons — on `/game` "Создать" first, then "Редактировать" — stand on a line above
           it (`SeasonAdminActions`; on a season's page the line of the breadcrumbs). The form
           (`SeasonForm`, `/game/seasons/create` and `/game/seasons/[id]/edit`) is a page form
           in parts like the place form (`FormSections`, the menu on the left): "Название" (title
           and description in Russian and English side by side; only the Russian title is
           required; no hint under the part), "Даты" (two `DateField`s — the kit `DatePicker` as a full-width field; off
           where the server locks them, without a word of explanation), and on an existing
           season "Картинки" (four `ImageSlot`s: the participant's medal — the season's
           picture —, gold, silver, bronze). "Удалить" only while the season has not begun. A
           new season goes on to its edit page for the pictures.
           Below, under a rule, on the home page only and while the season goes on — two equal
           columns (one on phones): the visitor in the table (`GET /game?rivals=1`) — lines of
           it: the place, a `small` avatar, the name, the geopoints as a `small` `GamePoints` pill (the
           rating's one), the own line
           on the brand tint. Two lines, together as tall as the place next to them: the
           player above and the visitor's own (the first one: their own and the player below).
           Someone who has not played stands under the last player, a dash for the place.
           Alone in the table: the `medium` avatar, the name and a `small` `GamePoints` (or
           "Посещайте интересные места и отмечайтесь на точках, чтобы попасть в рейтинг") | the next step — one place on a `--surface-2` plate, the whole plate a link to
           it: a 72×56 cover, the overline "Куда пойти", the title, the distance and "хватит,
           чтобы выйти на 8-е место" when its geopoints are more than the gap (for someone who
           has not played: "первая отметка — и вы в рейтинге"), `GamePoints plus`. The place is
           the first of the valuable ones (`GET /game/places`), the nearest when the location is
           known. No goal bar and no tasks.
           1a. The memo: one paragraph on the page background right under the head, on the full
           width, at the prose size — what the game is for a guest and someone who has not played,
           a reminder of the rules for a player —, ending with the sentence "Более подробно об
           игре читайте в разделе как играть." ("как играть" is the link to the help page). Text, not a card: the one thing on the page that is read.
        2. "Топ участников сезона" ("Рейтинг сезона" on a past season's page; `GameLeaders
variant="table"`): a `1fr 360px` grid — the lines in a card (place, the first three
           in the orange rank pill | a `medium` avatar | the name over "9 геометок" |
           `LevelBadge` 22 | the geopoints — `GamePoints` in its small size, the same pill as
           everywhere) | the side column. Its first thing is the location of the rating, a
           filter and so outside the card: a `FilterPopout` with a pin on the column's width,
           like the sort of a listing — "Весь мир", then the regions and towns the season is
           played in under overlines, each with its number of explorers. Under it what the
           page puts there: on the game page `GameAwards` ("Награды сезона") when the season
           has limited awards running now (begun, not over; a row each: the picture | the title,
           what it asks, a bar and "3 из 10" for one rule or a line per rule for several — never
           their sum —, until when; a green check once earned), then `GamePastSeasons` ("Прошлый сезон": always the last closed
           season, one low row — a 40px picture | the name over the dates | the podium's faces,
           a link to the season's page). The column sticks (`top: 64px`) while the lines scroll. Below 1024px one
           column: the filter, the lines, the awards and the past seasons. The lines sit in
           the card evenly: the same `--space-2` pull above the first and under the last one
           as on the sides. On
           the game page the top ten only, with "Весь рейтинг" on the heading's line — the
           explorers' list in the season's order (`/users?sort=season`). On a
           past season's page twenty a page, with "1–20 из 132" and the page links under them
           (a page is fetched on a tap: only this block is redrawn, faded while it loads).
           Everywhere the visitor's own line is highlighted: they always see themselves. In the
           top ten of the game page (`topOnly`) a visitor who is below it, or has no geopoints
           yet, takes its last line (a dash for the place); on a past season's page a line on
           another page stands under the lines, set apart by a dashed rule. A line under the
           pointer takes `--surface-2`.
        3. The visitor's own, one of two. `GameMine` ("Мой сезон") once they have a counted
           place: under the heading a paragraph of text at the prose size, on the full width
           (what the list is and what the game is for), then a chronicle in a card — over it one
           secondary line of what the season adds up
           to ("9 геометок · 50 геопоинтов"), then the site's list of places, `PlaceCard
variant="row"` in its small size without the excerpt, under hairlines, the latest
           first: under a place the facts ("12 ноября · отметка на месте"), on the right the
           geopoints it brought — `GamePoints plus`, the blue pill as everywhere (green is the
           rating's). Ten a page;
           under the card the `PaginationBar` ("1–10 из 300" | the page links — a page is
           fetched on a tap, the block faded while it loads). Otherwise (a guest, someone
           without a counted place) `GamePlaces` ("Какие места посетить"): `Tabs` "Рядом со
           мной" / "Везде" over one row of four `PlaceCard` tiles (two by two below 1024px)
           with the geopoints over the cover; "nearby" asks for the location on its button
           only. Never both. No feed on the page and no exploration: they are on `/activity`
           (the hero's "События") and on the profile.
        4. `QuestsPromo` (`components/shared/quests-promo`, made to stand on any page — the home
           one too): an invitation on the full width, no list — an overline "Квесты" in
           `--color-main`, a `titleSection` title, one sentence, the primary button "Выбрать
           квест" with "3 квеста" beside it | the picture, 480px (320 below 1024px, a low
           strip under the words on phones): a cover of the nearest quest, darkened, under a
           drawn dashed path of three numbered points — the marks of `QuestLayer`; the path
           alone on a tinted field without a cover.
- **Quests** (`pages/quests`, the components in `sections/game`; features/26). A section of its
  own, no part of the game's seasons: a quest is a game walked with a phone, once, whenever.
  Rendered on the request.
    - **Quests** (`/quests`, `QuestsPage`): a catalogue of outings in the manner of the trail
      catalogues — `PageHeader` (no breadcrumbs: a section root; the count on the h1's baseline,
      a lede that says what a quest is, an administrator's "Создать"); the shelf "Вы
      проходите" on every page and for every mode (the visitor's begun walks, `walk=active`,
      all of them — at most ten can be begun at once): `QuestCard` `small` cards one under
      another, the width of the page, with "Продолжить квест"; a row of `Tabs` links of the modes ("Все" and the three, `?mode=`, the list's
      filter only) with `Tabs` "Список / Карта" on the right below 1024px; then `QuestsMap`, a low
      band (280px) on the full width — the quests of the page as the pins of the quests' layer
      (`QuestMarks`, below), nothing more; a riddle quest is on no map but its own (its places
      are the answers); then the tiles, three a row (two below 1024px, one on phones), twelve a page
      (`walk=idle`: the nearest first with the visitor's location cookie, the walked ones last),
      the `PaginationBar`. Below 1024px the map replaces the tiles by the tab, 65vh high.
    - **Quest page** (`/quests/{id}`, `QuestPage`), an archetype of its own — a quest to walk,
      not a page to read, and what a link in a messenger opens (the cover is its `og:image`).
      `QuestHero`, the head: the breadcrumbs "Квесты" with an administrator's
      "Редактировать" on their line, then a card — the cover of the first point on the left,
      16:10 like every quest picture, inside the card's padding at the top (360px wide, 260 below
      1024px; on top edge to edge on phones; a riddle quest: the drawn map of the riddle quests, a photo quest its own drawn picture,
      also its `og:image`) | an overline "Квест" in `--color-main` with the mode as a tinted
      pill, the name as the h1, the town with a pin and right after it who walked the quest, as
      the place page's visitors (up to five `small` avatars overlapping in a ring of the card
      colour, "**1 человек** прошёл квест"; or "Ещё никто не проходил"), the description, and the facts as three `--surface-2` tiles (the number of points, the length,
      the time on foot) with the walk's action in the rest of their row (`QuestHeroAction`, under
      the tiles on phones and when the row is too narrow; the head grows no taller for it): not
      begun — the primary `large` "Войти и начать квест" / "Начать квест" (a walk begins only by
      this tap, never by itself) over one caption line (no timer; the sign-up is free; the limit
      of quests begun); begun — "2 / 6 точек подтверждено" over a green bar, under it a quiet
      `link` "Отказаться от квеста" behind a `ConfirmationDialog` (the progress goes, the visits
      made on it stay); walked — a green plate "Квест пройден" with the day and how long the walk took, from
      "Начать квест" to the last point ("12 ноября 2026 (2 д 3 ч)": the two largest units). The rest of the head is the same at every stage. One
      column, no side panel and no card of what is needed: under the head, until the walk is
      begun, `QuestHowTo` ("Как пройти квест": the mechanics in one `reading` paragraph on the
      page background, the whole width — a walk with a phone, "Я на месте" checked once and not
      kept, the computer only to look beforehand, any number of goes, the geopoints of the points
      and the experience of the whole quest —; then three cards as the guest home page's "Как это
      работает", texts of about one length: a picture of the site's real pieces on a brand tint
      over "Шаг N", a title and a text — begin it (the "Начать квест" button; a guest signs in
      first), go to the point (the marks of the timeline: confirmed, the one to go to, the next
      by the mode — a lock, "?" or a number; the text by the mode), check in on the spot ("Я на
      месте" with the quest's experience in the corner)); then "Точки квеста": the
      timeline beside the map (`1fr 400px`, the map sticky at `top: 64px` and 480px high, so it
      stays in sight while the list scrolls; below 1024px the map comes first, 360px, 260 on
      phones). The map (`QuestMap`: a framed card like `PlacesMap`, `QuestLayer` — the opened
      points as 28px numbered circles (a confirmed one as its place's 20px category icon, the
      site's place mark, with no popup), filled for the one to go
      to, outlined for the rest, a solid 3px line through them — green between two confirmed points,
      blue to one still ahead, as the timeline's rail —; "Моё местоположение" and full
      screen among the controls; a riddle quest's search zone as a dashed tinted circle the map
      is fitted to, shown before the first answer too, with no caption); `QuestSteps`, the timeline — the same marks on a rail (its line
      green between two confirmed points, blue to one still ahead, grey to a closed one; a lock
      on a closed point) and, per point, what the walker may see:
      the place as a `PlaceCard` row in a card with its hint, under a rule only what the
      walk needs ("Подтверждено 11 ноября" in green; on an open quest its own `small` "Я на месте";
      no geopoints: a quest is no part of a season); the point to go to has a 2px `--color-main` ring and, on a step
      quest begun, the `small` secondary "Проложить путь" — a walk to it in Yandex Maps (Google
      Maps on the English site) — beside the `small` primary "Я на месте"), the riddle of the
      current point in a ringed card (an overline "Загадка 3", the text — on a photo quest "Фото 3" and the place's
      first photo, whole in its own proportions (up to 520px high), enlarged in `PhotoLightbox` on a tap —, a caption on what to do;
      on a quest begun the `medium` primary "Я на месте" under it), or one quiet
      line ("Откроется после точки 2"); no distances between the points (the length is in the head).
      The button is "Я на месте" in every mode. On phones it is only a bar at the bottom of the
      screen in place of the navigation (`AppLayout` `bottomBar`: the progress and the button,
      40px in the 52px bar; "Начать квест" before the walk): it is pressed on the street,
      wherever the page is scrolled, and the page has no other — the head's "Начать квест" and
      the points' "Я на месте" are for wider screens (the head keeps only the reason a start is
      off). What a
      walker has not opened — the next step, the answer of a riddle — is not in the page at
      all: the API does not send it.
    - **Quest form** (`/quests/create`, `/quests/{id}/edit`, `QuestForm`,
      administrators): `PageHeader` (breadcrumbs "Квесты"), then `FormSections` (section 6): "Название и описание" (in
      the site's language only, as the place form: the other language is edited on its site and
      kept on a save; the API takes both, `titleRu` / `titleEn`… — a bot sends them at once; a
      title in one language is enough), "Режим и публикация" (an `OptionList` of the four modes with
      their icons and one line on each, then a `Switch variant="row"` "Опубликован") and "Точки"
      (the places in the walk's order as `--surface-2` rows: the number, the picker's 40px cover,
      the title over "120 м от предыдущей · category · address", `small` `outline` up / down /
      remove buttons, one hint field in the site's language — "Загадка" in the riddle mode, none
      on a photo quest; the total "4 точки · 7,2
      км"; a search field under the list with picker rows and "Добавить"). `FormActions` at the
      end, with "Удалить квест" at its start on an edit (`onDelete`). Each point's title is a
      link to its place in a new tab.
- **The game's other pages** (`sections/game`):
    - **How to play** (`/game/help`, `HelpPage`): a page to read on the full content
      width: `PageHeader` (breadcrumbs "Игра", the h1) → a `1fr 360px` grid, `--space-8` apart.
      The main column is the text as `prose` — `##` sections,
      numbered steps, a short FAQ; plain words, no numbers of the formula. The side column
      (the text's height): a tinted plate with the one primary button, "Начать игру", then "Точные
      числа" (`GamePointsTable`: the table of points folded behind its heading like the place
      page's activity log — "what | how much" rows with every number of the formula and the
      categories of a factor as their icons), then the contents of the text, sticky under the app
      bar (`TableOfContents`, section 6). Below 1024px one column, the side blocks after
      the text. The text is a Markdown file, not locale keys
      (section 6, "Page texts").
    - **Season medals** (`SeasonMedals`, `sections/game/season-medals`) — one block for the
      game page (current or upcoming season) and a season's page: a `Section` "Медали сезона",
      one paragraph (what the season gives: gold, silver and bronze to places 1–3, the grey
      medal to everyone else who took part) and four cards in a row (two by two on phones) —
      the medal picture, 72px, and its caption "1 место / 2 место / 3 место / Участник". On a
      closed season's page the visitor's own medal (`medalForPlace(me.place)`) has a 2px
      `--color-main` border and "Ваша медаль". `SeasonMedal` is one medal: its drawn picture
      (PNG or SVG of the admin) or, until it is made, the `AwardBadge` in its place — a gold,
      silver or bronze rim, and a neutral grey field for the participant (`category="neutral"`).
    - **Season page** (`/game/seasons/{id}`, `SeasonPage`) — of a season that is not the current
      one (the current one is the game page): the `Breadcrumbs` (desktop) and
      `GameSeason` as the head (the season's name is the h1, then its description) → for a closed season the podium, its
      winners as cards of people (the place in the orange rank pill, a `large` avatar, the name,
      the geotags, the geopoints; a season still taking photos has none: the table right under it
      starts with the same three) → `SeasonMedals` → `GameAwards` when the season has
      limited awards → "Рейтинг сезона" (not for an upcoming season) (`GameLeaders expandable`, 20 lines and "Показать ещё"). A
      closed season's table is frozen.
    - **Admin** (`/admin/*`; role admin only; the word is "Управление" / "Management", never
      "Админка"; the app bar's user menu has the one link "Управление"). The admin is a
      workspace of its own, not a page of the site — the approach and the map of its pieces
      are in **`ADMIN-UI.md`**, read it before any admin change. `AdminLayout`
      (`components/layout/admin-layout`): a side navigation ("Обзор" and the sections of
      `ADMIN_SECTIONS`, a mark on a section that needs attention, "На сайт" at the bottom; a
      scrolling row under a top bar on phones) and the content beside it; no site header,
      search, footer or bottom navigation. **Обзор** (`/admin`, `AdminPage` in
      `sections/admin`): "Требует внимания" (`AdminAttention`, the rules of
      `useAdminAttention`: a section badge in the rule's tone, one sentence, one `small`
      secondary button to where it is fixed; a calm line with a green check when there is
      nothing) and a card per section (`AdminWidget`: the icon and the title as a link, facts
      — a label and a value on a line, the value a link into the filtered list, red / orange
      when it needs a look —, the create action in the footer). Seasons have no section: they are made on the site
      (see "The game"). **Достижения:** on, off, limited running now.
      **Рассылки:** in the queue, errors of the last 7 days, sent in total. The dashboard
      never repeats a public page (the season's progress, players and points are on `/game`)
      or a list of the admin. A card loads and fails on its own: skeleton lines, a quiet line
      on an error; never a spinner, never the whole page. There is no intro text under the
      title of any admin page. The frame, tables, badges and forms of the admin are shared: see "Admin pages"
      in section 6. **Achievements** (`/admin/achievements`,
      `AchievementForm`): "Название и группа" (both titles required), "Вид" (tier, type,
      sort order, the "включено" `Switch` row), "Окно сезона" (only for a seasonal one; switching
      back to permanent clears the dates), "Награда" (experience, the medal `ImageSlot` once the
      achievement exists), "Правила" (rows of metric, value and place category, at least one);
      "Удалить" in the actions row (an achievement someone has earned is switched off, not
      deleted). The list: the views "Все / Включены / Выключены" with counts (`AdminViews`), a
      filter row (`AchievementFilterPanel`: search over the titles, type; filtered on
      the client, kept in the URL), the columns name (the "Выключено" badge right after the
      title of a switched-off award, whose other cells are muted), tier, type,
      "Получили" (right-aligned). **Email sending** has no page (the sent letters are not
      browsed; the queue keeps them a week): a dashboard card "Отправка писем" with a plain
      title — the last run of the sending job (red when it stopped), letters sent in 24 hours,
      the queue (red with overdue letters), errors of the week — and its alerts in "Требует
      внимания" without a link (it is fixed on the server).
    - `PlaceGame` in the "Где это" card of a place, under "Я здесь был(а)"
      — one quiet line on a `--surface-2` plate, no button of its own: there is one check-in on
      the site, "Я здесь был(а)" (its tap also asks the browser for the position, with or
      without a season: on the spot the visit is confirmed — "Визит подтверждён", in a season it
      also counts there — otherwise it is a plain visit and nothing is said). Without a season the
      line is only about the visit of this week: "Визит не подтверждён" with "Я сейчас здесь", or
      a green "Визит подтверждён"; nothing before a visit. In a season: "+30 за отметку на месте" before a visit; "В сезон не засчитано" with a
      link button "Я сейчас здесь" for a visit of the week made elsewhere; the geopoints got and
      a green "Засчитано в сезоне" once counted (by a check-in on the spot, or by a photo shot
      here — which leaves the button unpressed and asks no questions). Cancelling a visit that
      brought geopoints asks first (`ConfirmationDialog`). Few words on purpose: the rule is on
      "Как играть", not on the page;
      `HomeGame` on the signed-in home page, on the full width under the welcome card (and under
      the quest being walked or a newcomer's first steps, when there are any) — the
      game is the main thing of the site. One card, `GameSeason variant="home"` (see the game
      page above): the season, its bar of time and the links "Рейтинги сезона · Как играть"
      (no taller than the season's picture) | the place and the players as tiles —, and under
      the rule two lines of the table (the player above, the visitor) and the next place to go to. The place is
      the way on: no buttons at all. The location is never asked for here; nothing between
      seasons — and when there is no season at all, and for an announced one;
      `UserGame` in the profile overview's
      side column: first `GameExploration` ("Исследовано", for all time: the share of
      the whole map as one big number, then the four regions and three towns the person has
      been to most, a bar and "2 из 320 мест"; exploration is being there, the places a
      person added are their discoveries, not this), then what a season is — "Игра" (geopoints
      of the season and the place as icon rows); the medals of the seasons (`SeasonMedal`: the
      admin's picture or the drawn badge by the medal the season gave; the season's picture
      while it is open) and of the walked quests (`QuestMedal`: the quest's medal, or until it
      is uploaded the hexagon of an award without a tier around the cover of the first point —
      a riddle quest's drawn cover) are among the awards of the profile's card (`UserAwardsShowcase`); a walked quest leaves the
      invitations to the quests and is last in `/quests`; `LocationLeaders` on a location's places page, after the list
      ("Лидеры сезона: Оренбург", five lines; nothing while nobody has played there).
- **Sections, not containers.** The parts of one entity (its description, photos,
  comments, history, the facts about it) are `Section`s (`components/shared/section`, the
  same `title` / `action` / `footer` slots as the kit `Container`, a kit candidate): an h2
  with an optional `action` (`mode="link"` buttons),
  separated from each other by whitespace alone, on the page background. A box groups by enclosure, whitespace groups by proximity; nesting
  boxes inside the page card reads as "object inside object", which these are not.
- **Containers** (`Container` from the kit) are reserved for things of another nature than
  the page itself: the blocks of a side column — every side column of the site is cards (the
  profile's, the home page's, the game's, a quest's walk, "Где это"): a summary beside the
  page, not a part of its flow —, a form (also a section switched to edit mode), a tool card with its own
  purpose (the "Где это" map card on the place page), and titled link blocks on listing
  pages (`LocationLinkList`). They carry a `title` and an optional `action`. Page chrome —
  the page header, filters, lists, pagination — sits on the page background, never in a
  `Container`. Empty states are a single line in place of the content, never an empty box.
- **Loading is a skeleton.** Content that loads (a list, a card, a block) shows `Skeleton`
  placeholders of its own shape — the rows or cards it will be, with the sizes of their parts
  (`PlaceCardLoader`, `FeedStoryLoader`, the reputation history's rows). The kit `Spinner` is
  `width: 100%; height: 100%`: dropped bare into a page it grows to the width of its container
  and looks huge. It goes only inside a box of a set size that is busy — a button's `loading`,
  a photo tile being uploaded or rotated, an icon slot — never as the placeholder of content.
- **Breakpoint.** One: `$mobileMaxWidth` (768px). The one exception is the feed's side column
  (`/activity`, the profile), which goes on top below `$feedSideColumnMaxWidth` (1024px): next
  to it the feed column would be under ~500px. Below 768px columns stack and side action
  groups wrap under the content.

## 4. Page header and breadcrumbs

`PageHeader` (`components/shared/page-header`) is the one header for list, form, admin and
collection pages. It is a stack of four text levels, each optional except the h1, read top
to bottom in decreasing weight:

| Level       | Prop          | Looks                                                                                                                                                               | Holds                                                                                                                                                                                           |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| breadcrumbs | `breadcrumbs` | 12px secondary                                                                                                                                                      | the path to the parent (table below)                                                                                                                                                            |
| title       | `title`       | h1, `titlePage` (30px, 24 on phones), weight 600, tight tracking, balanced wrapping                                                                                 | what the page is                                                                                                                                                                                |
| meta line   | `description` | 13px secondary, one line                                                                                                                                            | facts about the entity: the collection byline (author avatar, places count, update time). Listings do not use it: their count sits on the title's baseline (`count`, 16px secondary: "48 мест") |
| lede        | `lede`        | `reading` (17px, 16 on phones, primary, 1.7), the full width of the text column; at most 3 lines (2 on phones), the last ending in "… Подробнее" (`ExpandableText`) | a few sentences introducing the page: the category text, the location summary                                                                                                                   |

Then `leading` for an avatar before the text, `actions` — buttons on the h1's own line,
right-aligned, folded into the line box so the title line is no taller than without them;
under the title on phones — and `aside` for a block beside the text — the map
preview of a location landing — 340px wide, top-aligned with the title, stacking under the
text on phones. The header sits on the page background: the lede is never boxed in a
`Container` and never greyed out — it is the page's first paragraph, not a footnote.
The place page and the user profile use a hero instead. On the place page the
`Breadcrumbs` sit above the cover, the h1 and the facts line under it on the page
background: the h1 and the facts under it on the left, the actions on the right, centred on
both lines (`PlaceHero`, `PlaceActions`); on the profile
the `Breadcrumbs` sit above the profile card and the h1 is the name inside it, the owner's
"Настройки" on its line (`UserHero`). The h1 is `titlePage` everywhere (section 1a).

**Buttons beside a page title** — every button on the right of an h1 (`PageHeader` /
`AdminPageShell` `actions`, the place page's `PlaceActions`) is the kit's `size="medium"`
(14px text, 18px icons) at 32px: the header sets `--size-control-medium: 32px` around them, so
pages pass `medium` and never `small` or their own height. The same holds for a line of the
administrator's buttons above a head card (`QuestHero`, `SeasonAdminActions`): `medium` at 32px.
A create or edit button there is text only, no icon, and a plain verb: the page already says
what is made or edited ("Создать", "Редактировать" — on `/collections`, `/quests`, `/game`).

Breadcrumbs appear only on nested pages, where the app bar cannot show where you are:

| Page                                                                                                                                                                       | Breadcrumbs                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Section roots: places, collections, explorers, map, activity, search, the game, the quests                                                                                 | none                                |
| Filtered places list (`/places?category=…`)                                                                                                                                | Места › parent filters              |
| Category / location / pair landing (`/places/{category}`, `/places/{location}`, `/places/{location}/{category}`, behind the `NEXT_PUBLIC_LANDING_*` flags — see CLAUDE.md) | Места › location parents › location |
| Place page (above the cover, desktop only)                                                                                                                                 | Места › category                    |
| Collection page                                                                                                                                                            | Коллекции                           |
| Create / edit place                                                                                                                                                        | Места (› place)                     |
| Profile, its tabs and photos (above the profile card, desktop only)                                                                                                        | Исследователи                       |
| Settings (above the profile card, desktop only)                                                                                                                            | Исследователи                       |
| Admin forms (a section's own page has none: the side navigation says where one is)                                                                                         | section                             |
| Game sub-pages: a past season (above the season card, desktop only), "How to play", the season form                                                                        | Игра (› season)                     |
| A quest (above its head card, desktop only), the quest form                                                                                                                | Квесты (› quest)                    |

The trail starts at the section (the logo is the way home) and stops at the parent; the
current page is the h1 next to it, so it is not repeated. There is no "back" button: the
last crumb is the way back. Schema.org `BreadcrumbList` is separate data and keeps the
full chain from the home page.

## 5. Cards

**One corner for photos and boxes.** A photo (a tile's cover, the place's picture, a thumbnail)
and a box (a card, a container, a tile with a background) take `--border-radius` /
`--container-radius` — the same 6px as the buttons and the pills (`styles/theme.css`). Never
`--radius-xl` on them: a cover rounder than the card beside it reads as another site. The bottom
sheet's top corners are the one larger radius, as a system sheet.

### `MediaTile` — photo tile primitive (`components/shared/media-tile`)

A 260px cover (`--border-radius`, no shadow, hover zoom) with an optional gradient band over its
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

The tile is not a `MediaTile`: a 2:1 cover (`--border-radius`, hover zoom; the previews are
680×300, cut from 3:1 covers, so a taller frame would crop and upscale them) and, under it on
the page background, the title (`titleBlock`, one line with an ellipsis, so the rows of a grid
line up), the address (`secondary`, one line of links) and the stats (the rating
as a gold `StarFilled` with a bold number, the distance as `--color-main` text without an icon).
Over the cover, for the visitor's visited places: a green "Вы были здесь" pill bottom-left
(it reads `visited`, which the lists send for a signed-in visitor only). A card has no
bookmark: one is made on the place page (and, for now, in the map's popup) — opening the
place is the simpler way than a button on every tile. A card is about the place:
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
`ListingToolbarGroup` keeps related controls together — the admin `AchievementFilterPanel`
is built from it and owns no layout of its own. The places listing has its own panel (`PlaceFilterPanel`, section 6).

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

### `ScoreStars` (`components/shared/score-stars`)

One score — a person's vote or a place's average — is five read-only solid stars everywhere:
the given ones in `--color-star`, the rest in `--surface-3`; an average is rounded to whole
stars and its number goes next to them. `small` (14px) in a line of text (the feed's rating
stories), `medium` (16px) in the reviews summary; `variant="single"` — one star in
`--color-star` and the semibold number, the rating stat of a `PlaceCard` tile — in a list of
many scores (the reputation history). Never "5★" in
text, never `--color-orange` stars. A place's rating as a fact or a stat is one
`StarFilled` in `--color-star` before the number (the hero, the card tiles). The interactive
stars of rating a place are `Rating`.

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

### `UserCard` (`components/shared/user-card`)

The one card of a person. A person is not a picture, so unlike a place or a collection the
card has no cover: the avatar leads, on a `--surface-1` card (`--container-shadow`,
`--container-radius`, `--shadow-md` on hover). The name link is stretched over the whole card (one
tab stop, the card opens the profile); the covers and the counts sit above it and lead to
the profile tabs. Hovering the tile lifts it by the shadow only: the name keeps its colour and
gets no underline, only the counts react to the pointer.

| Variant          | Use                                         | Parts                                                                                                                                                                                              |
| ---------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tile` (default) | the people page grid                        | 56px avatar, name, "был(а) … · с 2022 года", a third line — `Reputation`, then (the game) `GamePoints` small with the geopoints of the season —, level, covers, counts; a line of a list on phones |
| `row`            | a dense list inside a block (home "people") | 36px avatar, name, when, `LevelBadge` 22, `Reputation`; the line of `GameLeaders`: no rules between the people, `--surface-2` under the pointer                                                    |

Invariant order of a tile: the head (avatar with the online mark, name `titleBlock`, a
`secondary` line: "на сайте" in green or the time ago, then the year of sign-up) → the level
(`LevelBadge` 28, the tier name — every three levels share a colour and a name, `levelTier`
in `utils/levels.ts`, `levelTier.<n>` in `common.json` — the experience within the level and a
4px bar in the tier colour) → the strip of covers → the counts: places, photos, visited (each
a link into the profile — "Места", the photos sub-page, "Места → Посещённые": a 16px icon, the semibold number and the word in its form — "186 мест", never a bare number). The reputation is on the third line under the name, not here.
The strip is the person's four newest places with a cover (`places` of `GET /users?places=1`,
one windowed query for a page): 4:3 frames 4px apart with only the outer corners rounded, the
category icon (16px) over each, the last one "+N" over a dark veil when there are more,
leading to the user's places; a person without places gets a dashed "Открытий пока нет" line of
the strip's height, so the tiles of a row stay level. Only a list that asks for `places` gets
a strip. `rank` puts "#N" in the top-right corner (the first three on `--color-orange-background`).
On phones a tile turns into a line: avatar, name and when, the badge, the counts under
them; no covers and no progress. The time ago and the online mark come in the browser
(`useClientOnly`): the lists are cached.

### `UserProfileCard` (`components/shared/user-profile-card`)

The card of one person at the top of a page: the profile (`variant="profile"`, the default) and
the signed-in home page (`variant="home"`). A `--surface-1` card (`--container-shadow`,
`--container-radius` like every container and the tabs bar): the square avatar | the title, one facts line and the level | the counters. The counters are `StatTiles` (`components/ui/stat-tiles`), the one component of a card's counters: equal `--surface-2` tiles, a number in the `stat` size over a caption; a tile with a link leads to what it counts (the profile), without one it only informs (the season card's place and players).

| Part    | `profile`                                                                 | `home`                                       |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| Padding | `--space-6`, the tallest card of the site                                 | `--space-5`                                  |
| Avatar  | 160px (88 on phones)                                                      | 96px (64), a link to the profile             |
| Title   | the name, the page h1 (`titlePage`)                                       | "С возвращением, Имя!" (`titleSection`)      |
| Facts   | "На сайте" / "Был(а) …" (in the browser), "Участник с 2014 года", website | `facts`: the week's actions, the run of days |
| Buttons | `actions` under the level: the owner's "Сменить фото", "Настройки"        | none: the avatar leads to the profile        |

On the profile, at the foot, under a rule and edge to edge: the pages of the profile —
"Обзор", "Места", each a 16px icon and a 13px word, 40px high (on phones they
share the width); the page shown (`activeSection`) is in `--color-main` with a 2px underline.
The home card has no such row: the profile's tabs belong to the profile, and the avatar and the
counters already lead into it.

The level row: `LevelBadge`, "15 уровень · tier", the experience within the level over a 6px bar
in the tier colour. The counters, four equal tiles (`--surface-2`, the number in `stat`):
places, photos and visited places — links to "Места", the photos sub-page and "Места →
Посещённые" — and the
reputation, signed and green or red, a link to its history (the reputation sub-page) like the
other counters. A profile that came without its statistic shows no counters, never zeros.

**Awards** (`awards`, the profile only: `UserAwardsShowcase`, `sections/user/user-awards`) go
under the counters: everything the person earned — the seasons' medals, the walked quests, the
best step of each achievement — in that order, the newest first, as **one row** of hexagons
exactly as wide as the counters (`AwardRow`: as many as fit at 56px with 6px between, then grown
to the width; the row never wraps, so the card keeps its height), 8px under the counters, the
gap of the tiles. The column is centred in the row: as far from the card's edge as from the rule
of the tabs. The rule of the row, on every profile: the earned
ones first, then the permanent ones not earned yet (under the lock) to the end of the row; the
last cell is always the way to every award — the first award the row does not hold, seen
through a grey hexagon plate (`--surface-3` at 82%) with "+N", the number of the awards not held
("···" when all fit). A newcomer with nothing earned sees a row of locked awards: what there is to earn. It opens the dialog of every award (`AwardsDialog`): no
header — a round close button in its corner, the backdrop and Escape —, no groups, one honeycomb of five
in a row (`AwardHoneycomb`: every other row half a hexagon to the right, the rows a quarter into
each other, 6px along every edge — the hexagons of the map, the badges of Ingress; the hexagons
grow to fill the width, ~118px in the 640px dialog): the earned ones, then the permanent
(`base`) achievements not earned yet, in the order of the catalogue — a seasonal or a limited one not
earned is never shown. **A locked
award** has one look everywhere (`AwardPicture`): the medal of its first step grey at 35%, a lock
alone in the middle (no plate), in the text colour, 30% of the hexagon's height. A hexagon's tooltip: the name, then the place in a season, the day a quest was walked, or the start
of an achievement's description. The list of a profile counts nothing (`users/:id/achievements`:
no progress); the card of an achievement asks for its own counts (`users/:id/achievements/:group`)
when it opens, a `Skeleton` in place of the count meanwhile. Any hexagon, in the row or in the dialog, opens the card of the award
(`AwardDialog`) — over the dialog of every award when opened from it: no overlay of its own,
the dialog under it dimmed, the backdrop and Escape close the card first. The card (460px): the 168px
medal; a season — "Сезон игры · 1 сентября — 30 ноября 2026" ("· идёт сейчас" while it runs),
its place, geopoints and places visited as `StatTiles`, "Страница сезона"; a quest — when it
was walked and its text (no experience: a quest's reward is its medal), "Страница квеста"; the
page button is `secondary` and `stretched`, across the card; an achievement — right
under the medal the count every step is measured by, a bare large number in `stat` ("101"; a
single achievement not earned — "3 из 10"), then the description of the next step (what to do
now; the last one's when all are passed). An achievement of several rules (`progress.rules`)
never shows their sum: a `--surface-2` row per rule instead — the metric's name ("Отредактировано
геометок", "Посещено геометок"), the real count and, until all steps are passed, "27 из 50" of
the next step, the number green once that rule is met. With steps, the steps
side by side, not links: the 52px medal of each (under the lock until passed; its description in
the hint) with the number it asks (several rules: "25 · 50", in the order of the rows) over the day it came
(a step passed by jumping over it — the server awards the higher step alone — has the day of
the first higher step awarded; "Не получена"). No progress bar: the numbers
of the steps say how far the next one is. Nothing without awards.

Below 1024px the counters (and the awards) go under the rest; on phones the avatar shares the first row
with the title and the facts under it (online or last seen, the year), the level and the
counters go across.

**Avatars are round** (`UserAvatar`, `UserAvatarGroup`) everywhere a person is named next to
something else — cards, bylines, the feed, menus; the size is `tiny` 28, `small` 20, `medium`
36 or `large` 56 (the `UserCard` tile). The one square avatar (with the `--border-radius`
corners) is the big one of `UserProfileCard` (160px on the profile, 96px on the home page): there it is the picture of the
page, not a mark in a line.

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
  (a rating with the author's `ScoreStars` in the row footer) and "and N more"; a
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
  12px uppercase secondary) when `groupByDay`; two `FeedStoryLoader` skeletons while loading, in the stories' density (compact: no card,
  no media block, the rule from the story above);
  an empty feed is one line of text.
- `FeedPulse` — "This week" (or "This month" when the week was quiet): the non-zero counts
  as 22px numbers with captions, the most active people (`UserAvatarGroup`), "last activity
  5 minutes ago" with a green live dot. `compact` is one line for the home page widget.

Where it is: `/activity` — `PageHeader`, then a `1fr 320px` grid: type
filter `Tabs` (links `?type=places|photos|reviews|collections|achievements|visits` — "Посещения" is
the check-ins, the visit stories with the geopoints they brought) above the feed
grouped by day with infinite scroll (`useInfiniteScroll`), `FeedPulse` in the sticky right
column (first on phones). Home page — a `Container` with the compact pulse and the
latest stories of weight 2+ (five for a signed-in user: the main column, with the white spots
nearby and the people on the side; three for a guest, next to the people), as an exception to "lists never sit inside a `Container`": the
home widgets are titled blocks. Profile overview (`sections/user/user-activity`) — the same
`1fr 320px` grid: the photos, the `ContributionCalendar` and the author's feed by day, with
the profile's side blocks in the side column.
Place page — the collapsed "История изменений" row at the end of "О месте": compact stories without the place,
"Показать больше" loads the next page.

### `ContributionCalendar` (`components/shared/contribution-calendar`)

A year of a person's activity (`GET /feed/calendar`): a square per day, weeks as columns,
the colour a share of `--color-main` by quartiles of the busiest day, month names over the
columns, weekday names on the left. Under the squares one line: on the left the busiest day
of the year ("Самый активный день — 16 октября: 3 действия", the one fact the squares do not
say by themselves), on the right the "Less ▢▢▢▢ More" legend. One CSS grid stretched to
the full width (about 20px squares on a desktop); a square is never under 10px, below that
(phones) the year scrolls sideways, opened at the latest weeks. Weeks start on Monday in
Russian and on Sunday in English. A `Container` titled with the year's total, the year's
count in its `action`: on the page background the empty squares (`--surface-2`) would merge
with it.

There is no card of the year's numbers beside it: the actions are in the title, the active
days are the squares, and records of days in a row are not shown — less to read.

### Marks: the hexagon and the pill

Two kinds of marks, never mixed, so each reads without a caption:

- **A hexagon is what a person has become or earned**: the level (`LevelBadge`), an award
  (`AwardBadge`, or its drawn picture), a season. One pointy-top hexagon, one make — the rim, a
  flat field and one light thing on it (a number, a symbol); no gloss, no outlines. The level's
  field is the colour of its tier (three levels share one: `--color-level-<tier>`, its `-rim`
  and its `-ink`): deep colours with the awards' cream number, 5:1 and more so it reads at
  22px — only the first tier is a pale grey and the last one bright gold, both with the
  awards' navy number; an award's
  rim is its tier and its field its group's colour; a season's medal is its own picture, or
  the drawn one: the rim gold, silver or bronze, the participant's field neutral grey.
- **A pill is what is counted**: the geopoints of a season (`GamePoints`: a pin with a check
  and the number on the brand tint) and the reputation (`Reputation`: a star and the number
  with its sign, on a green tint above zero, a red one below, grey at zero). The same make —
  `--border-radius` corners, a 16px mark, a semibold tabular number —, in the same two sizes:
  24px, and 20px (`small`) in cards and lines. Side by side they are told by the mark and the
  colour: reputation first, then geopoints.

### The game: `GamePoints`, `QuestCard`, `GameLeaders`, the award badge

- `GamePoints` (`components/shared/game-points`) — geopoints (the points of a season), one look everywhere: the
  mark of the game (a map pin with a check: a confirmed visit) and the number in tabular
  figures. What an action gives is `plus` ("+30"), a score is a plain number. `tint` (the
  default: `--color-main` on `--color-main-background`, a 24px pill, 20px `small`), `cover`
  (the fixed dark pill over a photo: `PlaceCard` `badge`, the bottom-right corner of a tile's
  cover), `plain` (no pill: a table, the rating). Always blue, the visitor's own points too:
  never green (that is a confirmation). Never a
  star (that is a rating) and never a hexagon (that is a level).
- `QuestCard` (`components/shared/quest-card`) — the one card of a quest, wherever it is shown,
  a card on `--surface-1`, one link (the title's) stretched over it; hovering lifts it by the
  shadow only, like `UserCard`. `size="medium"`, the `/quests` tile: the cover of the quest's
  first point on top (16:10; a riddle quest's places are the answers: the drawn map of the riddle
  quests, `public/images/quests/riddle-cover.webp` — `questCoverSrc()`; a first point without a
  cover: the mode's icon on a dotted brand tint), over it the mode (a white pill, top left), the distance from
  the visitor to the start, or to the edge of a riddle quest's search zone (a dark pill, top
  right, with the location cookie); under it the town
  with a pin (an orange "Черновик" beside it for administrators), the title in `titleSection`
  on two lines at most, two lines of the description in the secondary colour, the facts with
  their icons — "4 точки", "7,2 км", "≈ 2 ч" —, and at the foot, over a separator, who walked
  it ("Прошли 12 исследователей", or "Станьте первым, кто его пройдёт") on the left and the
  walker's own state on the right: "+30 опыта" (the long "за квест до конца" in its title;
  experience, not geopoints: a quest is no part of a season), a green "Квест пройден", or the
  6px green bar with "2 из 4 точек" over the whole foot from the tap on "Начать квест". The time
  is an estimate: 4 km/h along the straight lines and four minutes a point. The same tile is
  the popup of a quest's pin on a map (`QuestMarks`), without its shadow. `size="small"`
  is a quest being walked (the shelf of `/quests`, the one on the home page): a low card the
  width of the page — a 16:10 thumbnail, 196px wide (108 on phones), inside the card's padding on
  the left (the same format as the tile's cover, never stretched), then the mode (or the
  `overline`), the title and one line of the town, the points and the length, and on the right
  the 240px bar of the walk with "2 из 6 точек" and the `action` ("Продолжить квест"); on phones
  the bar goes under the thumbnail and the words. Hovering lifts it like the tile. `overline`
  replaces the mode with a line in `--color-main`, `action` puts a control at the foot on the
  right, above the card's link — desktop only: on phones the whole card is the way in.
- `GameLeaders` (`components/shared/game-leaders`) — the rating of a season: `small` `Chip`s of
  the scope in a `ScrollRail` ("Везде", then the regions and towns the season is played in,
  each with its number of players) over a list of people — the place (the first three in the
  orange rank pill of the people list) | a `medium` avatar | the name over "9 мест · 1 квест"
  | `LevelBadge` 22 | the geopoints (`GamePoints` small, the pill of everywhere). The visitor's own line is on
  `--color-main-background`; when it is below the lines shown it goes under the list as a
  sentence. The previous scope stays, faded, while the next one loads; skeleton rows the first
  time. `location` fixes the scope (a location's page), `expandable` adds "Показать ещё".
- **Awards are medals in the manner of Ingress** (features/26 → "Award pictures",
  `tools/medals`): one pointy-top hexagon in a metal rim lit from above, a dark gap, a thin
  inner line and the field. A tier gives the metal and the field (bronze brown, silver slate,
  gold ochre) under a light emblem; an award without a tier (a season, a quest) has dark steel
  and its field and emblem in the group's colour (a season's warm or cold).
  An award without a drawn picture gets the same medal drawn in SVG (`AwardBadge` behind
  `AchievementIcon`, by the award's `tier`, `group_slug` and a purely visual `category` (`seasonal`, `neutral`,
  `quest`, the field colour): a snowflake or a sun over water for a season, a dotted line to a
  flag for quests, a star for anything else), so nothing in the game is a generic icon. The colours are the
  `--color-medal-*`, `--color-award-*` and `--color-season-*` tokens of `styles/theme.css`, the
  same in both themes
  like the drawn pictures; the season's colour also paints the award's progress bar.

## 6. Patterns

- **Dialogs.** `Dialog` with a `title`, body, and an actions row aligned right, secondary
  action first and the primary action last, both `size="medium"`. A destructive action in a
  settings dialog sits on the left of the footer as a `mode="link"` `variant="negative"`
  button and always asks for confirmation (`ConfirmationDialog`) naming what is deleted.
- **Prose.** Rendered markdown (place description, collection article) uses the `prose`
  mixin from `styles/mixins.sass`: 17px body (`--font-size-prose`, 16px on phones) on a 1.7 line height, semibold `h2` 18px / `h3` 16px with
  more space above than below, disc/decimal lists, a left-bordered quote, rounded images,
  code on `--surface-2`. Both pages show it bare on the page background; the place page
  renders markdown h1/h2 as h3. No lead: the first paragraph is the size of the rest, on every
  page — the text does not jump.
- **Page texts.** The long text of a static page ("Как играть", a page about the project) is a
  Markdown file per language in `client/content` (`<page>.<locale>.md`), not keys of
  `common.json`: the page reads it on the server (`loadContentPage()`, `utils/content.server.tsx`)
  and shows the ready HTML in a `prose` column. A page may take its title and SEO description
  from the file's front matter too ("О проекте"). `common.json` keeps the short labels of the
  interface. Rules of writing are in `client/content/README.md`.
- **Contents of an article** (`components/ui/table-of-contents`, `TableOfContents`): a page to
  read (a page text above) lists its `##` sections in its side column — the server gives every
  `##` an id (`с-чего-всё-началось`) and the list of them (`headings`). A "Содержание" caption,
  then the sections as rows on a thin 2px rail in secondary text; the section in view is in
  `--color-main` with the rail marked beside it (scroll spy, `hooks/useScrollSpy.ts` — the same
  as the page forms' menu). A click scrolls smoothly, the heading stops under the app bar
  (`scroll-margin-top: 64px`), the anchor goes into the address without a history entry. Sticky
  under the app bar (`top: 64px`); phones have the text alone; fewer than two sections, no list.
  "О проекте" (`/about`) and "Правила" (`/rules`) are one page, `ContentPage`
  (`sections/content/content-page`, data function `getContentPageProps(<file>)`): the text | a
  240px column of the contents. Its photos: a paragraph of images in the file is a row of them
  (`content-gallery`: as many columns as photos, at most four, two on phones; 3:2 crops, `--space-2`
  apart), each a button opening the lightbox of all the page's photos (zoom, the alt text as the
  caption); a new page of the kind is a Markdown pair and a two-line file in
  `pages/`, linked from the footer. "Как играть": the contents
  under the side blocks, the only sticky thing of the column.
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
  and server errors are put on their fields with `setError`. A failed save brings the first
  field with an error (in the page order) to the middle of the screen and focuses it —
  `handleSubmit(onValid, (errors) => scrollToFirstError(errors))` (`utils/scrollToFirstError`),
  and the same for the server's errors once they are on their fields; fields are found by
  `name`, so every field passes its `name` (the kit fields do not forward refs), and a field
  without an input of its own carries `data-field` (a `Select`, an editor's wrapper, the map
  that sets `lat` and `lon`: `data-field="lat lon"`). The error of such a field is shown under
  it as red caption text. A failed save shows no toast: the fields and the summary tell. Anything the user can lose —
  a page form, an inline editor, a dialog, a comment draft — is wrapped in
  `useUnsavedChangesGuard(isDirty)` (`hooks/`): links, Back/Forward and router pushes open
  `<ConfirmationDialog {...dialogProps} />`, closing the tab gets the browser prompt.
  In-page discards (Cancel, closing a dialog) go through `confirmDiscard`; call
  `allowNavigation()` before navigating away after a successful save.
- **Page forms in parts** (`components/ui/form-sections`: `FormSections`, `FormSection`): a
  page form of several parts (the settings, the place form) is a `240px 1fr` grid on the full
  content width, `--space-4` apart like every side column. On the left a sticky vertical menu
  of the parts (`top: 64px`; the old site menu's look: 36px rows, a 20px icon in the link
  colour, `--surface-3` on hover, the part in view white with `--color-main`); a click
  scrolls smoothly to the card without a history entry and the mark goes straight to it; as
  the page scrolls the mark follows — the last card whose top has passed the line under the
  app bar, the last card at the very end of the page. On the right the parts: a titled
  `FormSection` (a `Container` with an id, a secondary line on what goes in it, stopping under
  the app bar when scrolled to), the form's messages above them, `FormActions` after them.
  Phones: no menu, the cards on the full content width. A form of one part takes no menu.
- **Page form actions** (`components/ui/form-actions`, `FormActions`): every form on a page (not
  in a dialog) ends with this component, never a hand-made row of buttons. The page passes
  `dirty`, `loading`, `onSave` and `onCancel` (no Cancel without it); `saveLabel`,
  `cancelLabel` and `message` only where the defaults do not fit ("Добавить место");
  `saveDisabled` replaces the default rule (off until a change) for a form that may be saved
  untouched — a new entity — or must wait (uploads in progress). The entity's destructive
  action goes in the same row (`onDelete`, `deleteLabel`, `deleteDisabled`): a red secondary
  button at its start (on phones on a line of its own under the buttons), never a link
  elsewhere on the page, and never on the floating bar.
  One row — secondary "Отмена" first, primary "Сохранить" last, `medium`,
  on the right; stretched in equal halves on phones. Save is disabled until something changed.
  With no changes the row stays in its place under the form. With changes it shows the note
  "Есть несохранённые изменения" on the left, and while its place is below the screen (the
  user scrolled up to the fields) it floats: a bar fixed to the bottom of the screen on the
  full window width, dressed as the app bar — `--container-background`, a 1px `--border` rule
  and a light shadow on the page side, 50px tall, the content on `--width-max` with the page's
  side paddings (16px, 10px on phones) so the buttons line up with the form, 32px buttons,
  the bottom safe area. On phones it sits over the bottom navigation, the note is hidden (the
  bar itself says there are changes). As the place scrolls in, the bar lands back into it;
  the place keeps the row's height, so the page never jumps. Never a sticky row inside the
  form's column, never a second bar on the page.
- **Admin pages** (`/admin/*`; reuse these, do not rebuild them per page):
  `getAdminServerSideProps` (`utils/adminPage.ts`) is every admin page's `getServerSideProps`
  (translations, auth from the cookies, 404 for anyone but an administrator); `AdminPageShell`
  (`components/shared/admin-page-shell`) is the frame — `AdminLayout`, `noindex` head, `PageHeader`
  (a nested page passes `section` and gets its one crumb; `count` on the title's baseline,
  `actions` on the title line) — and shows, in place of the content, the `EmptyState` with a
  link back (`notFound`, `error`), so an edit page never hangs on a wrong id. **No spinner while an admin page loads:**
  an edit form stands in its place with every field and button off (the form's `loading`,
  `FormActions disabled`), a list shows skeleton rows, a dialog skeleton lines — the kit
  `Spinner` without a size stretches over its whole container.
  `AdminWidget` (`components/shared/admin-widget`) is the dashboard's section card (head, `facts`, footer).
  A list page passes `fit`: on desktop it is one viewport high and only the table scrolls, in
  its card under the sticky header (`AdminLayout fit`; phones keep the scrolling page).
  `AdminViews` (`components/shared/admin-views`): the list's common views as `small` toggle
  `Chip`s with counts, above the filter row; a list's filters, sorting and page live in the
  URL (`useQueryFilters`), and an empty filtered list offers "Сбросить фильтры".
  `AdminTable` (`components/shared/admin-table`): typed columns with `render(row)`, skeleton
  rows, an `EmptyState` with the create action, the server's sort (`sortable`, `sort`, `onSort`),
  the horizontal scroll of the kit `Table` on phones, `variant: 'number'` for a right-aligned
  count; `AdminTitleCell` is the name cell, the one way into a row (a link to the form or a
  button that opens a dialog, a `badge` after the title, secondary lines) — no "edit" buttons. A status is a `StatusBadge` (`components/shared/status-badge`: tone
  `success` / `info` / `warning` / `danger` / `neutral`, theme tokens, no `!important`) with the
  domain's status → tone map in `tones.ts`. Forms are page forms without the menu of the parts
  (titled `FormSection` cards one under another, no vertical tabs — `client/ADMIN-UI.md` → Forms; `FormActions` with `onDelete`, `useUnsavedChangesGuard`
  inside the form, `handleSubmit(onSubmit, scrollToFirstError)`, `name` / `data-field` on every
  field); a form owns its mutations: server field errors go on their fields (`parseServerErrors`
  and `applyServerErrors`, `utils/formErrors.ts`), the rest in a `Message` at the top, a save
  or a delete says "Сохранено" / "Удалено" in a toast. A text in two languages is a
  `LocaleFieldPair` (the language in words: "Название (русский)", never a flag); a hint is a
  `HintedField` / `FieldHint` right under its field (`aria-describedby`; a `hint` prop is a kit
  candidate); a number is kept as text while typed. A picture is an `ImageSlot`
  (`components/shared/image-slot`): preview, caption, "Загрузить" / "Заменить", remove; PNG or SVG
  up to 1 MB checked before the upload, saved at once, a toast for a refused, failed or saved
  file; an entity not created yet explains that the picture comes after creation. Icon-only
  buttons carry an `aria-label` that names the row ("Редактировать: Холодный сезон").
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
  `--color-main` fill, `aria-pressed`; `negative` — the "no" of a three-state toggle: struck label, muted tint, `aria-pressed="mixed"`) or a removal (`removable`, tinted with a ✕), a link with
  `href`, an optional quiet `count` after the label (facets); `ScrollRail` — the one horizontal scroller of the site (native scroll, no carousel
  library): round white arrows with a shadow while there is more to a side, hidden on touch
  screens; `chips` (items of their own width, faded edges, `ScrollRailSeparator` between
  groups) and `cards` (three equal place tiles, one the full width on phones, scroll snap, bigger
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
- **Hex layer** (`components/map/hex-layer`, `/map`, places mode): below zoom 11 (`HEX_MAX_ZOOM`) the place
  and spot markers give way to pointy-top hexagons (32px circumradius) binned in the browser from one
  `GET /exploration/points`. One fill per cell (`hexFill`): its three states mixed by their
  shares, in quarters, in OKLab (two hues meet in a clean middle, not in grey), at one opacity
  (0.8): pale green (`#d4ece0`) for the places nobody has added yet (the open candidates), green
  (`#2f9e77`) for the places on the map, the main blue for the places the signed-in visitor has
  been to (at least a quarter of blue with one visit, so it is seen). Every state has a hue, so a
  guest sees a map of green, not of grey. The cells sit in their own pane (`hexes`) that
  multiplies the tiles (`mix-blend-mode`; a path cannot, the pane isolates it): the colours keep
  their strength over the light map, its roads and labels show through. The edge is blue in the
  cells the visitor has been to, dark green (`#24785b`) otherwise and dashed while nothing in the
  cell is on the map. No label inside; the counts are in the tooltip, one a line ("Вы были", "На
  карте", "Не добавлено"), the zeros left out. A click on a cell zooms in by two on its centre.
  `HexLegend` names the colours in the map's bottom-left column while the hexagons are shown
  ("Вы были" for a signed-in visitor only).
  White spots ("Неоткрытые места" to the visitor, the same for admins): the layer is the
  ghosts of place markers: the same 20px square with the candidate's category icon, the whole
  marker at 40% opacity, no extra frame (`Marker` + `divIcon`, one icon per category), no panel
  and no map button of its own (the layer loads quietly), a "Не открыто" badge and the
  "add this place first: +35" action in the popup. No admin mode: linking candidates to places
  is a separate admin page to come, not a map popup.
  The site's own objects are the first group of checkboxes in the layers panel of `/map`, under
  the base maps and the overlays: "Неоткрытые" (the white spots), "Геометки" (the places) and
  "Геоквесты" (`MapObjectLayersEnum`, `InteractiveMap enableObjectLayers`), all on by default and
  kept with the map settings (an empty choice too); zoomed out, the hexagons count only the
  objects that are on. The "Геометки / Фотографии" switch is commented out for now: the map
  always shows the places, a saved "Фотографии" is not read.
  Quests (`QuestMarks`, `components/map/quest-marks`): the "Геоквесты" checkbox shows every quest (`GET /game/quests/marks`, loaded once); `/quests` passes the
  quests of its page instead (`quests`). A quest is made like a place marker: the same 20px
  square with 3px corners and the 1px white frame, in `#3770b1` with a white flag (a riddle
  quest: a white "?") in place of a category picture; its centre is the start. A riddle quest is
  not on these maps: its places are the answers, its search zone is drawn on its own page only. The name on hover; a click opens a 280px popup that is the
  `QuestCard` tile itself, loaded then.
  Exception to "tokens, not values": the hex layer's colours (`#3770b1`, the greens `#2f9e77`,
  `#d4ece0` and the edge `#24785b`, `hex-layer/constants.ts`) are hex values in JS, because Leaflet paints the polygons from `pathOptions`;
  the photo counter over a cover is the same fixed dark pill as the stats over `MediaTile`.
- **Photo gallery** (`PhotoGallery`: profile, place page, place form, the user's photos page):
  a grid of 4:3 tiles, four columns (two on phones) with 4px gaps, so 8 photos make two
  whole rows; only the outer corners of the whole grid are rounded, tiles are square; previews are 700×500. The first 8 are shown and the rest collapse behind
  "Ещё фотографии"; a page of photos passes `showAll`.
- **Floating prompt** (`components/ui/floating-prompt`, `FloatingPrompt`): the one card the site
  floats over the page to ask or tell one thing — the cookie notice (`CookieNotice`) and the
  push offer (`PushPrompt`). Bottom right on desktop, 440px at most, clear of the toasts
  (bottom left); on phones at the top under the app bar, on the full width, clear of the
  toasts and the bottom navigation. `--container-background`, `--popout-shadow`, an optional
  title, the text (primary when there is no title), the buttons with the main one first.
  One at a time: the cookie notice comes first, to every visitor until closed on the browser
  ("Понятно"; Escape does not close it); the push offer waits for it and then appears after an
  action as before (Escape puts it off). Shown only once the browser knows the stored
  answer, so a cached page never flashes one. Never a modal, never on page load for push.
- **Photo upload** (`components/ui/upload-zone`, `UploadZone`): every place a photo is
  uploaded from shows one face while there is nothing yet — a dashed field on `--surface-2`
  (180px minimum, `--border-strong` dash, the main colour on hover and focus) with a Camera
  icon, a title saying what to do and a small hint: "Нажмите или перетащите…" and the formats
  and limit. A click opens the picker; files dropped on it are taken (`onDrop`), unless a
  `FileDropZone` around it already takes them (the place page, the place form) — then the
  zone has no `onDrop`, or one drop would upload twice. The caller owns the file input and
  checks the type and size before sending, with a toast naming what fits: photos of a place
  (`PhotoUploader`) — JPG, PNG or WEBP up to 10 MB, several at once; an avatar
  (`UserAvatarEditor`) — JPG, PNG or WEBP up to 5 MB, one; the picture of a mailing
  (`MailingImage`, the admin) — JPG or PNG up to 2 MB, one (mail clients show no WEBP), then
  shown at the letter's width with "Заменить" and "Удалить". No GIF anywhere (the API takes
  none). Once there are photos, adding more is the gallery's "Добавить фото" tile (or the
  mosaic's pill), not a second zone. Never a bare file input or a hand-made upload button.
- **Photo viewer** (`PhotoViewer`, the place page): one dark full-screen viewer in both themes,
  two modes. All the photos — a header with the place, "Все фото (N)", "Добавить фото" and
  the close button (icons only on phones), a hint for editors, a grid of 4:3 tiles (200px
  minimum, two columns on phones) with "Повернуть" / "Удалить" over the corner on hover
  (always on touch screens; no rotation for linked photos) and "ваше фото" on the visitor's
  own. One photo — `PhotoLightbox` (zoom, swipes, the author caption, the "3 / 12" counter)
  with "Все фото" and "Добавить фото" in its toolbar, back to the grid at the same photo.
  Under the dialogs, so a delete confirmation shows over it.
- **Tabs** (`components/ui/tabs`, the filters of `/activity`; the profile's pages are the foot
  of `UserProfileCard` instead): a bar on a card (`--container-shadow`,
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
  `FilterPopout` (a `FieldTrigger` with a dropdown, a fixed width), `SortPopout` (the sort
  field: a `FilterPopout` of the sort presets in an `OptionList`, label and caption, the
  places listing, the search and the people page), `FilterPhoneBar` and
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
  (`SortPopout`, the most relevant first, "Ближе ко мне" asks the browser), the
  `CategoryRail` with the facets (`places.categories` of the response, counted before the
  category filter) and the applied filters. Desktop: not sticky — the results scroll in
  their own column; phones: sticky, the tabs with `FiltersButton` and the sheet ("Показать N
  мест" is counted from the facets, no request).
- **Listing toolbar** (`ListingToolbar` + `ListingToolbarGroup`, used by the admin
  `AchievementFilterPanel`): the filter row directly above a list, on the page background,
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
- **App bar icon buttons** (the search on narrow screens, the bell): the quiet family of the
  navigation items, never outlined — kit `Button mode="link"` recoloured to `--text-color-primary`
  (`.iconButton` in the app bar styles), `--surface-2` on hover, the active look (`--color-main` on
  `--color-main-background`) while its popup is open. A count over an icon button (the bell, the
  phone `FiltersButton`, the map category control and the candidates) is one `Counter`: an 18px
  pill in the corner, `--font-size-micro`, red for news (unread), `color="main"` for a setting
  (how many filters are on); the parent only places it.
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
