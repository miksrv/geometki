# Achievements Catalogue

Полный каталог достижений платформы: существующие (реализованы в `AchievementsSeeder.php`) и предложенные к добавлению.

Реализация движка описана в `features/01-achievements-badges.md`.

---
You are an illustrator specializing in game achievement badges and medals.

I will attach a reference template image of a round medal with a ribbon. Use it as the strict basis for ALL generations throughout this entire conversation.

**Constraints (never violate):**
- The medal size (diameter/bounding box) must EXACTLY match the template — do not scale it up or down, not even slightly.
- The ribbon width and height must EXACTLY match the template — do not resize or reshape the ribbon.
- Output image dimensions must match the template.
- Style: flat vector illustration with clean edges. No photorealism, no heavy 3D gradients. Subtle flat shading and gentle inner shadows are OK to give depth, but keep it minimal.
- White background (#FFFFFF), not transparent.
- Each medal must be centered in the canvas in the same position as the template.
- No text, no inscriptions, no numbers, no labels anywhere on the medal or ribbon — ever, unless I explicitly ask.
- The emblem/icon in the center must be simple, recognizable at small sizes (32–64px), and drawn in the same flat vector style as the medal itself.

**What changes per achievement group:**
- **Ribbon design:** Each group gets a unique ribbon with its own color palette, stripe pattern, or subtle woven motif. The ribbon design stays identical across all tiers within the group.
- **Medal shape:** Each group gets a unique medal silhouette (circle, shield, cog, starburst, hexagon, ornate Victorian frame, etc.). The silhouette stays identical across all tiers within the group. The outer bounding size always matches the template.
- **Medal emblem:** A simple iconic symbol in the center representing the achievement theme. I will specify the icon for each group.

**What changes per tier within a group:**
- **Bronze:** Medal body and rim in warm bronze tones (#CD7F32 range). The ribbon may gain a thin bronze accent line.
- **Silver:** Medal body and rim in cool silver tones (#C0C0C0 range). The ribbon may gain a thin silver accent line.
- **Gold:** Medal body and rim in rich gold tones (#FFD700 range). The ribbon may gain a thin gold accent line.
- Everything else (emblem, shape, ribbon layout, composition) stays identical — ONLY the metal color changes between tiers.

**For single-tier (non-tiered) achievements:**
- Generate one medal only. I will specify the color mood.

**Output format:**
- For tiered groups: generate all tiers in a single image, side by side (Bronze | Silver | Gold) with equal spacing, so I can compare consistency.
- For single-tier: generate one medal alone, centered.

**Consistency rule:** Once you establish a visual style in this conversation (line weight, shading approach, level of detail), maintain it for ALL subsequent medals. Every medal in this series should look like it belongs to the same icon set.

When I give you a new achievement, I will provide:
1. Group name
2. Central icon/theme
3. Number of tiers (3 or 1)
4. Any extra style notes

Generate the medals following all rules above. Are you ready?
---

Group: Critic / Критик
Icon: a five-pointed star (rating star)
Tiers: 3 (Bronze, Silver, Gold)
Notes: sharp and elegant feel — medal shape could be a star-burst or a faceted gem outline; ribbon in deep royal-purple and charcoal tones with thin diagonal stripes

Group: Trailblazer / Первопроходец
Icon: two footprints on a winding trail
Tiers: 3 (Bronze, Silver, Gold)
Notes: rugged adventurous feel — the medal shape could be a compass rose or rough-edged explorer's seal; ribbon with earthy forest-green and brown tones, evoking a jungle trail or mountain path

Group: Veteran / Ветеран
Icon: a laurel wreath with a chevron/rank insignia in the center
Tiers: 3 (Bronze, Silver, Gold)
Notes: military/honor aesthetic — medal shape could be a classic military cross or an ornate round seal with laurel border; ribbon in deep navy-blue and crimson with a central thin stripe

Group: Wanderer / Странник
Icon: map with a dotted route/path line
Tiers: 3 (Bronze, Silver, Gold)
Notes: adventurous feel, the ribbon could have a topographic-map-inspired pattern

---

## Категории

| Категория | Назначение |
|---|---|
| **exploration** | Создание и посещение мест |
| **content** | Качество и количество контента |
| **social** | Взаимодействие с контентом других |
| **reputation** | Долгосрочный вклад и уровень |
| **consistency** | Регулярность и привычка |
| **seasonal** | Ограниченные по времени события |

---

## Exploration

### `explorer` — Исследователь / Explorer
Tiered. Icon: `Compass`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_created >= 10 | 25 | Создайте 10 мест на карте | Create 10 places on the map |
| Silver | places_created >= 50 | 75 | Создайте 50 мест на карте | Create 50 places on the map |
| Gold | places_created >= 200 | 150 | Создайте 200 мест на карте | Create 200 places on the map |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Explorer / Исследователь
> Icon: a compass with a spinning needle
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: classic exploration vibe — medal shape could be a round compass bezel with notch markers; ribbon in warm sandy-tan and olive-green tones with subtle grid lines

---

### `wanderer` — Странник / Wanderer
Tiered. Icon: `Map`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_visited >= 25 | 25 | Посетите 25 мест | Visit 25 places |
| Silver | places_visited >= 100 | 75 | Посетите 100 мест | Visit 100 places |
| Gold | places_visited >= 500 | 150 | Посетите 500 мест | Visit 500 places |

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Wanderer / Странник
> Icon: map with a dotted route/path line
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: adventurous feel, the ribbon could have a topographic-map-inspired pattern

---

### `pioneer` — Первооткрыватель / Pioneer
Single (tier: none). Icon: `MapPin`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 1 | 15 | Добавьте первое место на карту | Add your first place to the map |

Онбординговая ачивка — первый шаг нового пользователя.

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Pioneer / Первооткрыватель
> Icon: map pin with a sparkle
> Tiers: 1 (single)
> Color mood: warm amber/copper, feels like a "first step" — humble but memorable
> Notes: medal shape — simple circle with a subtle notched border, nothing too ornate

---

### `scout` — Разведчик / Scout
Single (tier: none). Icon: `Navigation`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_visited >= 1 | 15 | Посетите первое место | Visit your first place |

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Scout / Разведчик
> Icon: a navigation arrow (direction pointer)
> Tiers: 1 (single)
> Color mood: cool teal/steel-blue — feels like a quiet first discovery
> Notes: medal shape — a simple rounded shield; ribbon in muted blue-grey tones

---

### `trailblazer` — Первопроходец / Trailblazer
Tiered. Комбо: и создаёт места, и посещает — отделяет «полевого» исследователя от «диванного картографа». Icon: `Footprints`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_created >= 5 AND places_visited >= 10 | 50 | Создайте 5 мест и посетите 10 | Create 5 places and visit 10 |
| Silver | places_created >= 25 AND places_visited >= 50 | 125 | Создайте 25 мест и посетите 50 | Create 25 places and visit 50 |
| Gold | places_created >= 100 AND places_visited >= 200 | 250 | Создайте 100 мест и посетите 200 | Create 100 places and visit 200 |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Trailblazer / Первопроходец
> Icon: two footprints on a winding trail
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: rugged adventurous feel — the medal shape could be a compass rose or rough-edged explorer's seal; ribbon with earthy forest-green and brown tones, evoking a jungle trail or mountain path

---

## Content

### `photographer` — Фотограф / Photographer
Tiered. Icon: `Camera`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | photos_uploaded >= 20 | 25 | Загрузите 20 фотографий | Upload 20 photos |
| Silver | photos_uploaded >= 100 | 75 | Загрузите 100 фотографий | Upload 100 photos |
| Gold | photos_uploaded >= 500 | 150 | Загрузите 500 фотографий | Upload 500 photos |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Photographer / Фотограф
> Icon: a classic camera (front view, simple lens circle)
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: clean modern feel — medal shape could be a rounded square (like a photo frame) or a circle with film-strip border; ribbon in warm magenta/coral and dark-grey tones

---

### `curator` — Куратор / Curator
Tiered. Icon: `Pencil`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_edited >= 10 | 30 | Отредактируйте 10 мест | Edit 10 places |
| Silver | places_edited >= 50 | 75 | Отредактируйте 50 мест | Edit 50 places |
| Gold | places_edited >= 200 AND comments_written >= 50 | 150 | Отредактируйте 200 мест и напишите 50 комментариев | Edit 200 places and write 50 comments |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Curator / Куратор
> Icon: a pencil over a document/page
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: scholarly/editorial feel — medal shape could be an ornate round seal with a fine border; ribbon in deep burgundy and cream tones with a thin pinstripe

---

### `debut` — Дебют / Debut
Single (tier: none). Icon: `ImagePlus`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | photos_uploaded >= 1 | 15 | Загрузите первую фотографию | Upload your first photo |

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Debut / Дебют
> Icon: an image/photo frame with a small plus sign
> Tiers: 1 (single)
> Color mood: fresh light-green/mint — a bright "first time" feeling
> Notes: medal shape — simple circle; ribbon in soft green and white tones

---

## Social

### `critic` — Критик / Critic
Tiered. Icon: `Star`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | ratings_given >= 20 | 50 | Поставьте 20 оценок | Give 20 ratings |
| Silver | ratings_given >= 100 | 125 | Поставьте 100 оценок | Give 100 ratings |
| Gold | ratings_given >= 500 | 250 | Поставьте 500 оценок | Give 500 ratings |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Critic / Критик
> Icon: a five-pointed star (rating star)
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: sharp and elegant feel — medal shape could be a star-burst or a faceted gem outline; ribbon in deep royal-purple and charcoal tones with thin diagonal stripes

---

### `commenter` — Комментатор / Commenter
Tiered. Icon: `MessageSquare`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | comments_written >= 10 | 40 | Напишите 10 комментариев | Write 10 comments |
| Silver | comments_written >= 50 | 100 | Напишите 50 комментариев | Write 50 comments |
| Gold | comments_written >= 200 | 200 | Напишите 200 комментариев | Write 200 comments |

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Commenter / Комментатор
> Icon: a speech bubble (square with rounded corners)
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: friendly conversational feel — medal shape could be a rounded hexagon or a soft-edged circle; ribbon in sky-blue and slate tones with horizontal stripes

---

### `voice` — Голос / Voice
Single (tier: none). Icon: `MessageCircle`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | comments_written >= 1 | 15 | Оставьте первый комментарий | Leave your first comment |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Voice / Голос
> Icon: a single round speech bubble with a small sound wave
> Tiers: 1 (single)
> Color mood: soft sky-blue/periwinkle — a gentle "first word" feeling
> Notes: medal shape — simple circle; ribbon in light blue and white tones

---

### `collector` — Коллекционер / Collector
Tiered. Icon: `Bookmark`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | bookmarks_added >= 30 | 30 | Добавьте 30 закладок | Add 30 bookmarks |
| Silver | bookmarks_added >= 100 | 75 | Добавьте 100 закладок | Add 100 bookmarks |
| Gold | bookmarks_added >= 300 | 150 | Добавьте 300 закладок | Add 300 bookmarks |

**Статус:** реализовано (Seeder 1 + Seeder 2)

> **Prompt:**
> Group: Collector / Коллекционер
> Icon: a bookmark ribbon (flag-shaped)
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: treasure/collection aesthetic — medal shape could be a shield or a rounded diamond; ribbon in deep teal and warm gold-ochre tones with a woven crosshatch pattern

---

### `all_rounder` — Универсал / All-Rounder
Single (tier: none). Prestige-ачивка за разностороннее участие. Icon: `Layers`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 10 AND photos_uploaded >= 20 AND comments_written >= 10 AND ratings_given >= 20 | 150 | Исследуйте, фотографируйте, комментируйте и оценивайте — делайте всё | Explore, photograph, comment, and rate — do everything |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: All-Rounder / Универсал
> Icon: four overlapping shapes (circle, star, square, triangle) forming a unified emblem
> Tiers: 1 (single)
> Color mood: rich multi-toned — deep indigo base with accents of teal, coral, and gold to represent versatility
> Notes: medal shape — an ornate octagon or multi-layered circle; ribbon in indigo and teal with subtle multi-color accent threads

---

## Reputation

### `trusted` — Доверенный / Trusted
Tiered. Icon: `Shield`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | reputation_score >= 50 | 25 | Достигните репутации 50 | Reach a reputation score of 50 |
| Silver | reputation_score >= 200 | 75 | Достигните репутации 200 | Reach a reputation score of 200 |
| Gold | reputation_score >= 1000 | 150 | Достигните репутации 1000 | Reach a reputation score of 1000 |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Trusted / Доверенный
> Icon: a shield with a checkmark
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: trustworthy/official feel — medal shape is a classic heraldic shield; ribbon in steel-blue and white tones with a single center stripe

---

### `veteran` — Ветеран / Veteran
Tiered. Icon: `Award`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | level_reached >= 5 | 25 | Достигните уровня 5 | Reach level 5 |
| Silver | level_reached >= 15 | 75 | Достигните уровня 15 | Reach level 15 |
| Gold | level_reached >= 25 | 150 | Достигните уровня 25 | Reach level 25 |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Veteran / Ветеран
> Icon: a laurel wreath with a chevron/rank insignia in the center
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: military/honor aesthetic — medal shape could be a classic military cross or an ornate round seal with laurel border; ribbon in deep navy-blue and crimson with a central thin stripe

---

### `legend` — Легенда / Legend
Single (tier: none). Ультра-редкий prestige-бейдж — финальная цель для топ-пользователей. Icon: `Crown`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 200 AND reputation_score >= 1000 AND level_reached >= 25 | 300 | Достигните высшего уровня, заработайте топовую репутацию и создайте 200 мест | Reach the highest level, earn top reputation, and create 200 places |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Legend / Легенда
> Icon: a crown with radiating light rays
> Tiers: 1 (single)
> Color mood: dark prestige — deep black/charcoal base with rich gold accents, feels ultra-rare and majestic
> Notes: medal shape — an ornate Victorian round frame with filigree; ribbon in black and gold with a regal velvet feel

---

## Consistency

### `regular` — Постоянный / Regular
Tiered. Icon: `Clock`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | days_active >= 7 | 30 | Будьте активны 7 разных дней | Be active on 7 different days |
| Silver | days_active >= 30 | 75 | Будьте активны 30 разных дней | Be active on 30 different days |
| Gold | days_active >= 100 | 150 | Будьте активны 100 разных дней | Be active on 100 different days |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Regular / Постоянный
> Icon: a clock face (simple, without numbers)
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: reliable/steady feel — medal shape could be a gear/cog (symbolizing consistency); ribbon in warm grey and soft orange tones with evenly spaced thin stripes

---

### `streak` — Серия / Streak
Tiered. Icon: `Flame`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | login_streak >= 7 | 30 | Заходите 7 дней подряд | Log in 7 days in a row |
| Silver | login_streak >= 30 | 75 | Заходите 30 дней подряд | Log in 30 days in a row |
| Gold | login_streak >= 60 | 150 | Заходите 60 дней подряд | Log in 60 days in a row |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Streak / Серия
> Icon: a flame
> Tiers: 3 (Bronze, Silver, Gold)
> Notes: energetic/fiery feel — medal shape could be a starburst or a circle with flame-lick edges; ribbon in deep red-orange and dark charcoal tones with a zigzag or chevron pattern

---

### `dedicated` — Преданный / Dedicated
Single (tier: none). Долгосрочная активность — выше порога `regular` Gold. Icon: `CalendarCheck`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | days_active >= 365 | 200 | Будьте активны 365 разных дней | Be active on 365 different days |

**Статус:** реализовано (Seeder 1)

> **Prompt:**
> Group: Dedicated / Преданный
> Icon: a calendar page with a checkmark
> Tiers: 1 (single)
> Color mood: deep sapphire-blue and silver — feels like long-term commitment and quiet pride
> Notes: medal shape — a refined circle with a subtle laurel or gear border; ribbon in deep blue and silver with a single center accent line

---

## Seasonal

Сезонные ачивки видны только в своё окно. После окончания сезона остаются на профиле с меткой сезона, но исчезают из каталога.

### Реализованные (Seeder 1)

| Slug | Тир | Окно | Условие | XP |
|---|---|---|---|---|
| `spring_explorer_2026` | Silver | 2026-03-01 → 2026-05-31 | places_visited >= 10 (category 5) AND places_visited >= 10 (category 8) | 100 |
| `summer_photographer_2026` | Gold | 2026-06-01 → 2026-08-31 | photos_uploaded >= 50 | 200 |
| `autumn_curator_2026` | Silver | 2026-09-01 → 2026-11-30 | places_edited >= 20 AND ratings_given >= 30 | 100 |
| `winter_wanderer_2026` | Bronze | 2026-12-01 → 2027-02-28 | places_visited >= 15 | 50 |
| `new_year_pioneer_2027` | none | 2027-01-01 → 2027-01-07 | places_created >= 1 | 30 |
| `spring_cleaner_2027` | Silver | 2027-03-01 → 2027-05-31 | places_edited >= 15 AND photos_uploaded >= 20 | 100 |
| `summer_explorer_2027` | Gold | 2027-06-01 → 2027-08-31 | places_visited >= 30 AND places_created >= 10 | 200 |

---

## Сводная таблица статусов

| Group | Tiers | Статус |
|---|---|---|
| `explorer` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `wanderer` | Bronze / Silver / Gold | реализовано (Seeder 1 + Seeder 2) |
| `pioneer` | none | реализовано (Seeder 1 + Seeder 2) |
| `scout` | none | реализовано (Seeder 1 + Seeder 2) |
| `trailblazer` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `photographer` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `curator` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `debut` | none | реализовано (Seeder 1 + Seeder 2) |
| `critic` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `commenter` | Bronze / Silver / Gold | реализовано (Seeder 1 + Seeder 2) |
| `voice` | none | реализовано (Seeder 1) |
| `collector` | Bronze / Silver / Gold | реализовано (Seeder 1 + Seeder 2) |
| `all_rounder` | none | реализовано (Seeder 1) |
| `trusted` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `veteran` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `legend` | none | реализовано (Seeder 1) |
| `regular` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `streak` | Bronze / Silver / Gold | реализовано (Seeder 1) |
| `dedicated` | none | реализовано (Seeder 1) |
| Seasonal 2026 (3 шт.) | — | реализовано (Seeder 1) |
| Seasonal 2026–2027 (4 шт.) | — | реализовано (Seeder 1) |
