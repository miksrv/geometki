# Feature: Categories Page Redesign (`/categories`)

## Problem Statement

The current `/categories` page is a plain vertical list: icon (15×18 px), title, description, place count, "Go to category" link — all separated by hairline dividers. Nothing about the page communicates that this is a community-powered platform where real people go out and discover places. It feels like a documentation index, not a discovery lobby.

**Core failures:**

| Issue | Impact |
|---|---|
| Tiny 15×18 px icons buried inline with text | Category identity is invisible at a glance |
| Flat vertical list with no visual hierarchy | All 23 categories feel equally important; no entry point for new visitors |
| Raw place count with no context | "15 places" means nothing — is that a lot or a little? |
| Zero community signals | No hint that real people contributed these places |
| No thematic grouping | Nature, history, and urban exploration are mixed together randomly |
| No relative-activity indicator | A user can't tell what's thriving vs. what's niche |
| Single entry point per category | One "Go to category" link is the only CTA; no pathway to latest activity |

---

## Mental Model Shift

The categories page is not a sitemap. It is the **discovery lobby** of a mini-social network — the place a new visitor lands and decides whether the platform is worth joining, and the place a returning explorer goes when they want to venture into unfamiliar territory. The reference points are:

- **AllTrails** category browser — visual cards, hero imagery, place counts as social proof
- **Reddit's Communities** — relative activity, freshness signals, community size
- **Foursquare Explore** — thematic grouping, "trending nearby", contributor context
- **iNaturalist** — observation counts as proof of community vibrancy

The redesigned page must answer three questions within five seconds of landing:
1. *What can I explore here?* → visual category grid with clear icons and names
2. *What's most worth my time?* → popularity hierarchy and "most active" highlights
3. *Who made this?* → community-framing language and place counts as social proof

---

## Proposed Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: "Categories of places"                                  │
├──────────────────────────────────────────────────────────────────┤
│  PLATFORM STATS BAR                                              │
│  [23 categories]  [1 200+ places]  [N explorers]                 │
├──────────────────────────────────────────────────────────────────┤
│  SPOTLIGHT STRIP — top 3 categories by place count               │
│  ┌─────────────────────┐ ┌───────────────────┐ ┌──────────────┐  │
│  │  🏚 ABANDONED       │ │  ⛰ MOUNTAINS     │ │  ⛪ RELIGIOUS│  │
│  │  128 places         │ │  113 places       │ │  109 places  │  │
│  │  ████████████ 100%  │ │  ██████████  88%  │ │  █████████   │  │
│  └─────────────────────┘ └───────────────────┘ └──────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  THEMATIC GROUPS (4 sections, each a card grid)                  │
│                                                                  │
│  ── Nature & Outdoors ────────────────────────────────────────   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ 🌊 Water │ │ ⛰ Mtn   │ │ 💧 Fall  │ │ 🏕 Camp  │             │
│  │   61 ●●● │ │  113 ●●●●│ │  31 ●●   │ │   8 ●    │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                  │
│  ── History & Culture ────────────────────────────────────────   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ 🏛 Museum│ │ ⛪ Relig │ │ 🏰 Castle│ │ 🪨 Arch  │            │
│  │   72 ●●● │ │  109 ●●●●│ │  19 ●●   │ │  15 ●    │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                  │
│  ── Urban & Industrial ───────────────────────────────────────   │
│  ── Unusual & Extreme ────────────────────────────────────────   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Section-by-Section Specification

### 1. Platform Stats Bar

Three counters rendered as chips directly below the page header. All derived from the `categories` array — no extra API call.

| Stat | Derivation | Label (RU / EN) |
|---|---|---|
| Total categories | `categories.length` | категорий / categories |
| Total places | `categories.reduce((s, c) => s + (c.count ?? 0), 0)` | мест в базе / places in the community |

These counters anchor the visitor in the platform's scale and frame the content as community output, not a static list.

---

### 2. Spotlight Strip

The **top 3 categories by `count`** rendered as larger, visually distinctive "hero" cards in a horizontal row (or stacked vertically on mobile). Each hero card contains:

- **Large icon** — the existing PNG from `categoryImage()`, rendered at **48×48 px** (vs current 15×18 px)
- **Category title** in a larger font size
- **Place count** displayed prominently (e.g. "128 places")
- **Popularity progress bar** — `<Progress>` component from the UI library; `value = Math.round((category.count / maxCount) * 100)`; color `"main"`
- Full card is a `<Link>` to `/places?category={name}`

The purpose is to give first-time visitors an immediate answer to "what's most popular on this platform?" and to create visual weight that pulls the eye down the page.

---

### 3. Thematic Groups

Replace the flat list with four thematic sections, each rendering a responsive card grid.

**Group definitions:**

| Group key | RU label | EN label | Categories |
|---|---|---|---|
| `nature` | Природа и активный отдых | Nature & Outdoors | `water`, `mountain`, `waterfall`, `spring`, `nature`, `cave`, `animals`, `camping` |
| `history` | История и культура | History & Culture | `museum`, `religious`, `castle`, `manor`, `memorial`, `monument`, `archeology` |
| `urban` | Города и индустрия | Urban & Industrial | `abandoned`, `military`, `transport`, `bridge`, `construction`, `mine` |
| `unusual` | Необычное и экстремальное | Unusual & Extreme | `death`, `radiation` |

**Group container:** Each section has a group title rendered as a section heading (`<h2>`) with a thin left-border accent in the brand blue, followed by the card grid.

**Card grid:** `display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px`

**Category card anatomy:**

```
┌──────────────────────────┐
│  [icon 40×40]            │
│  Category title          │
│  ● ● ● ○  N places       │
└──────────────────────────┘
```

- Full card is a `<Link href={/places?category={name}}>`
- Icon at **40×40 px** (vs current 15×18 px)
- Title in primary text color
- Place count + activity dots: `Math.round((count / maxCount) * 4)` filled dots
- Card has a subtle `box-shadow` and `border-radius: var(--border-radius)` border
- On hover: slight `translateY(-2px)` lift and shadow deepens (CSS transition)
- Cards for categories with `count === 0` are still shown but de-emphasised with `opacity: 0.5`

The description (`category.content`) is **deliberately omitted from the card** — it was the main source of monotony on the current page. The description appears in a **tooltip / popout** triggered by an info icon (ⓘ), keeping the grid clean while preserving the content for users who want it.

> **SEO constraint:** `category.content` must be present in the DOM on initial server render, regardless of how `Popout` is implemented. If the component injects content lazily (only on user interaction), Googlebot will not index the descriptions. The safe implementation is to render the text in the DOM unconditionally and control visibility via CSS only (e.g. a visually-hidden `<span>` alongside the popout trigger). Phase 4 must be validated with a raw HTML check (e.g. `curl` or "View Page Source") before merging to confirm the description text is present in the initial response.

---

### 4. What Is Removed / Changed

| Current element | Decision | Reason |
|---|---|---|
| Tiny 15×18 px icon inline with `<h3>` | **Replaced** | Icon is now the visual anchor of each card at 40–48 px |
| Flat vertical list with dividers | **Replaced** | Thematic grid layout with group headings |
| `"Интересных мест в категории: N"` text row | **Replaced** | Activity dots + count number on card |
| `"Перейти в категорию"` link at the bottom of each item | **Removed** | Entire card is the link; no redundant CTA needed |
| All 23 categories treated equally | **Replaced** | Spotlight (top 3) + grouped remainder |
| Description paragraph always visible | **Moved to info popout** | Keeps cards scannable; detail available on demand |

---

## Component Plan

```
pages/categories.tsx
└── AppLayout
    ├── Header  (unchanged)
    ├── CategoriesStats         — new: platform stat chips
    ├── CategoriesSpotlight     — new: top-3 hero cards with Progress bar
    └── CategoriesGroups        — new: thematic group sections
        └── CategoryCard        — new: reusable card (used in both Spotlight and Groups)
```

All new components live under `sections/categories/`. The page passes the full `categories` array down; all sorting and grouping is done client-side via `useMemo`. No new API calls are required.

**File structure:**

```
sections/categories/
  categories-stats/
    CategoriesStats.tsx
    styles.module.sass
    index.ts
  categories-spotlight/
    CategoriesSpotlight.tsx
    styles.module.sass
    index.ts
  categories-groups/
    CategoriesGroups.tsx
    styles.module.sass
    index.ts
  category-card/
    CategoryCard.tsx
    styles.module.sass
    index.ts
  index.ts    ← update to export all new components
```

`CategoriesList` is **retired** once the new components ship.

---

## Translation Keys to Add

Add to both `public/locales/ru/common.json` and `en/common.json`:

| Key | RU | EN |
|---|---|---|
| `cat-stat-categories` | `категорий` | `categories` |
| `cat-stat-places` | `мест в базе` | `places in the community` |
| `cat-group-nature` | `Природа и активный отдых` | `Nature & Outdoors` |
| `cat-group-history` | `История и культура` | `History & Culture` |
| `cat-group-urban` | `Города и индустрия` | `Urban & Industrial` |
| `cat-group-unusual` | `Необычное и экстремальное` | `Unusual & Extreme` |
| `cat-spotlight-title` | `Самые исследуемые` | `Most Explored` |
| `cat-places-count` | `мест` | `places` |
| `cat-description-label` | `Об этой категории` | `About this category` |

Keep all existing keys intact (`categories-places`, `all-geotags-in-category`, `go-to-category`, etc.).

---

## UI Library Components to Use

From `simple-react-ui-kit`:

| Component | Where used |
|---|---|
| `Container` | Outer wrapper for each section |
| `Progress` | Popularity bar on Spotlight cards; `value={pct}`, `color="main"` |
| `Popout` | Info popout (ⓘ) for category descriptions on grid cards |
| `Icon` | Info icon (`name="Feed"` or similar) as popout trigger |
| `cn` | Conditional class merging in `CategoryCard` (spotlight vs. grid variant, active/dim states) |

---

## Styling Notes

- **No hardcoded colors.** Use only CSS custom properties (`var(--color-main)`, `var(--text-color-secondary)`, etc.) and SASS variables from `@use '../../../styles/variables' as variables`.
- **Group section heading** — left border accent:
  ```sass
  .groupTitle
      border-left: 3px solid var(--color-main)
      padding-left: 10px
      margin-bottom: 12px
      font-size: variables.$fontSizeTitleH2
  ```
- **Card hover lift** — pure CSS, no JS:
  ```sass
  .categoryCard
      transition: transform 0.15s ease, box-shadow 0.15s ease
      &:hover
          transform: translateY(-2px)
          box-shadow: var(--container-shadow)
  ```
- **Dimmed zero-count cards:**
  ```sass
  .dimmed
      opacity: 0.45
      pointer-events: none
  ```

---

## Phased Delivery

| Phase | Scope | Effort |
|---|---|---|
| **1 — Grid + Groups** | Replace `CategoriesList` with `CategoriesGroups` + `CategoryCard`; thematic sections, larger icons, activity dots | S (1–2 days) |
| **2 — Spotlight** | Add `CategoriesSpotlight` (top-3 hero cards with `Progress` bar) | S (1 day) |
| **3 — Stats bar** | Add `CategoriesStats` chips | XS (half day) |
| **4 — Description popout** | Add ⓘ `Popout` with `category.content` to each card; `category.content` must be present in the initial DOM (CSS-only visibility) — validate with raw HTML check before merge | S (1 day) |
| **5 — Polish** | Hover lifts, transition animations, mobile layout tuning, dimmed zero-count cards | S (1 day) |

Phases 1–3 should ship together as a single PR (this is the minimum viable redesign). Phases 4–5 are follow-on polish.

---

## Success Metrics

- **Time on page** increases (visual hierarchy invites exploration)
- **Click-through rate** from `/categories` to `/places?category=…` increases
- **Bounce rate** decreases — more entry points and visual variety reduce "nothing to click"
- **New visitor retention** — the Spotlight strip gives an immediate answer to "what's the point of this platform?"
