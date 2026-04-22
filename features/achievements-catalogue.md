# Achievements Catalogue

Полный каталог достижений платформы: существующие (реализованы в `AchievementsSeeder.php`) и предложенные к добавлению.

Реализация движка описана в `features/01-achievements-badges.md`.

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

**Статус:** реализовано

---

### `wanderer` — Странник / Wanderer
Tiered. Icon: `Map`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_visited >= 25 | 25 | Посетите 25 мест | Visit 25 places |
| Silver | places_visited >= 100 | 75 | Посетите 100 мест | Visit 100 places |
| Gold | places_visited >= 500 | 150 | Посетите 500 мест | Visit 500 places |

**Статус:** реализовано

---

### `pioneer` — Первооткрыватель / Pioneer
Single (tier: none). Icon: `MapPin`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 1 | 15 | Добавьте первое место на карту | Add your first place to the map |

Онбординговая ачивка — первый шаг нового пользователя.

**Статус:** предложено

---

### `scout` — Разведчик / Scout
Single (tier: none). Icon: `Navigation`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_visited >= 1 | 15 | Посетите первое место | Visit your first place |

**Статус:** предложено

---

### `trailblazer` — Первопроходец / Trailblazer
Tiered. Комбо: и создаёт места, и посещает — отделяет «полевого» исследователя от «диванного картографа». Icon: `Footprints`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_created >= 5 AND places_visited >= 10 | 50 | Создайте 5 мест и посетите 10 | Create 5 places and visit 10 |
| Silver | places_created >= 25 AND places_visited >= 50 | 125 | Создайте 25 мест и посетите 50 | Create 25 places and visit 50 |
| Gold | places_created >= 100 AND places_visited >= 200 | 250 | Создайте 100 мест и посетите 200 | Create 100 places and visit 200 |

**Статус:** предложено

---

## Content

### `photographer` — Фотограф / Photographer
Tiered. Icon: `Camera`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | photos_uploaded >= 20 | 25 | Загрузите 20 фотографий | Upload 20 photos |
| Silver | photos_uploaded >= 100 | 75 | Загрузите 100 фотографий | Upload 100 photos |
| Gold | photos_uploaded >= 500 | 150 | Загрузите 500 фотографий | Upload 500 photos |

**Статус:** реализовано

---

### `curator` — Куратор / Curator
Tiered. Icon: `Pencil`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | places_edited >= 10 | 30 | Отредактируйте 10 мест | Edit 10 places |
| Silver | places_edited >= 50 | 75 | Отредактируйте 50 мест | Edit 50 places |
| Gold | places_edited >= 200 AND comments_written >= 50 | 150 | Отредактируйте 200 мест и напишите 50 комментариев | Edit 200 places and write 50 comments |

**Статус:** реализовано

---

### `debut` — Дебют / Debut
Single (tier: none). Icon: `ImagePlus`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | photos_uploaded >= 1 | 15 | Загрузите первую фотографию | Upload your first photo |

**Статус:** предложено

---

## Social

### `critic` — Критик / Critic
Tiered. Icon: `Star`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | ratings_given >= 20 | 50 | Поставьте 20 оценок | Give 20 ratings |
| Silver | ratings_given >= 100 | 125 | Поставьте 100 оценок | Give 100 ratings |
| Gold | ratings_given >= 500 | 250 | Поставьте 500 оценок | Give 500 ratings |

**Статус:** Bronze и Silver реализованы; **Gold — предложено**

---

### `commenter` — Комментатор / Commenter
Tiered. Icon: `MessageSquare`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | comments_written >= 10 | 40 | Напишите 10 комментариев | Write 10 comments |
| Silver | comments_written >= 50 | 100 | Напишите 50 комментариев | Write 50 comments |
| Gold | comments_written >= 200 | 200 | Напишите 200 комментариев | Write 200 comments |

**Статус:** реализовано

---

### `voice` — Голос / Voice
Single (tier: none). Icon: `MessageCircle`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | comments_written >= 1 | 15 | Оставьте первый комментарий | Leave your first comment |

**Статус:** предложено

---

### `collector` — Коллекционер / Collector
Tiered. Icon: `Bookmark`

Сейчас реализован как tier: none (30 закладок). Предлагается расширить до трёх тиров.

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | bookmarks_added >= 30 | 30 | Добавьте 30 закладок | Add 30 bookmarks |
| Silver | bookmarks_added >= 100 | 75 | Добавьте 100 закладок | Add 100 bookmarks |
| Gold | bookmarks_added >= 300 | 150 | Добавьте 300 закладок | Add 300 bookmarks |

**Статус:** Bronze реализован (как tier: none); **Silver и Gold — предложено**

---

### `all_rounder` — Универсал / All-Rounder
Single (tier: none). Prestige-ачивка за разностороннее участие. Icon: `Layers`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 10 AND photos_uploaded >= 20 AND comments_written >= 10 AND ratings_given >= 20 | 150 | Исследуйте, фотографируйте, комментируйте и оценивайте — делайте всё | Explore, photograph, comment, and rate — do everything |

**Статус:** предложено

---

## Reputation

### `trusted` — Доверенный / Trusted
Tiered. Icon: `Shield`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | reputation_score >= 50 | 25 | Достигните репутации 50 | Reach a reputation score of 50 |
| Silver | reputation_score >= 200 | 75 | Достигните репутации 200 | Reach a reputation score of 200 |
| Gold | reputation_score >= 1000 | 150 | Достигните репутации 1000 | Reach a reputation score of 1000 |

**Статус:** реализовано

---

### `veteran` — Ветеран / Veteran
Tiered. Icon: `Award`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | level_reached >= 5 | 25 | Достигните уровня 5 | Reach level 5 |
| Silver | level_reached >= 15 | 75 | Достигните уровня 15 | Reach level 15 |
| Gold | level_reached >= 25 | 150 | Достигните уровня 25 | Reach level 25 |

**Статус:** реализовано

---

### `legend` — Легенда / Legend
Single (tier: none). Ультра-редкий prestige-бейдж — финальная цель для топ-пользователей. Icon: `Crown`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | places_created >= 200 AND reputation_score >= 1000 AND level_reached >= 25 | 300 | Достигните высшего уровня, заработайте топовую репутацию и создайте 200 мест | Reach the highest level, earn top reputation, and create 200 places |

**Статус:** предложено

---

## Consistency

### `regular` — Постоянный / Regular
Tiered. Icon: `Clock`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | days_active >= 7 | 30 | Будьте активны 7 разных дней | Be active on 7 different days |
| Silver | days_active >= 30 | 75 | Будьте активны 30 разных дней | Be active on 30 different days |
| Gold | days_active >= 100 | 150 | Будьте активны 100 разных дней | Be active on 100 different days |

**Статус:** реализовано

---

### `streak` — Серия / Streak
Tiered. Icon: `Flame`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| Bronze | login_streak >= 7 | 30 | Заходите 7 дней подряд | Log in 7 days in a row |
| Silver | login_streak >= 30 | 75 | Заходите 30 дней подряд | Log in 30 days in a row |
| Gold | login_streak >= 60 | 150 | Заходите 60 дней подряд | Log in 60 days in a row |

**Статус:** Bronze и Silver реализованы; **Gold — предложено**

---

### `dedicated` — Преданный / Dedicated
Single (tier: none). Долгосрочная активность — выше порога `regular` Gold. Icon: `CalendarCheck`

| Tier | Условие | XP | Описание RU | Описание EN |
|---|---|---|---|---|
| none | days_active >= 365 | 200 | Будьте активны 365 разных дней | Be active on 365 different days |

**Статус:** предложено

---

## Seasonal

Сезонные ачивки видны только в своё окно. После окончания сезона остаются на профиле с меткой сезона, но исчезают из каталога.

### Реализованные

| Slug | Тир | Окно | Условие |
|---|---|---|---|
| `spring_explorer_2026` | Silver | 2026-03-01 → 2026-05-31 | places_visited >= 10 (category 5) AND places_visited >= 10 (category 8) |
| `summer_photographer_2026` | Gold | 2026-06-01 → 2026-08-31 | photos_uploaded >= 50 |
| `autumn_curator_2026` | Silver | 2026-09-01 → 2026-11-30 | places_edited >= 20 AND ratings_given >= 30 |

### Предложенные

| Slug | Тир | Окно | Условие | XP |
|---|---|---|---|---|
| `winter_wanderer_2026` | Bronze | 2026-12-01 → 2027-02-28 | places_visited >= 15 | 50 |
| `new_year_pioneer_2027` | none | 2027-01-01 → 2027-01-07 | places_created >= 1 | 30 |
| `spring_cleaner_2027` | Silver | 2027-03-01 → 2027-05-31 | places_edited >= 15 AND photos_uploaded >= 20 | 100 |
| `summer_explorer_2027` | Gold | 2027-06-01 → 2027-08-31 | places_visited >= 30 AND places_created >= 10 | 200 |

---

## Сводная таблица статусов

| Group | Tiers | Статус |
|---|---|---|
| `explorer` | Bronze / Silver / Gold | реализовано |
| `wanderer` | Bronze / Silver / Gold | реализовано |
| `pioneer` | none | **предложено** |
| `scout` | none | **предложено** |
| `trailblazer` | Bronze / Silver / Gold | **предложено** |
| `photographer` | Bronze / Silver / Gold | реализовано |
| `curator` | Bronze / Silver / Gold | реализовано |
| `debut` | none | **предложено** |
| `critic` | Bronze / Silver / **Gold** | частично (Gold — **предложено**) |
| `commenter` | Bronze / Silver / Gold | реализовано |
| `voice` | none | **предложено** |
| `collector` | Bronze / **Silver / Gold** | частично (Silver/Gold — **предложено**) |
| `all_rounder` | none | **предложено** |
| `trusted` | Bronze / Silver / Gold | реализовано |
| `veteran` | Bronze / Silver / Gold | реализовано |
| `legend` | none | **предложено** |
| `regular` | Bronze / Silver / Gold | реализовано |
| `streak` | Bronze / Silver / **Gold** | частично (Gold — **предложено**) |
| `dedicated` | none | **предложено** |
| Seasonal 2026 (3 шт.) | — | реализовано |
| Seasonal 2026–2027 (4 шт.) | — | **предложено** |
