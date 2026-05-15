# 20. Location SEO Pages — Семантические страницы по локациям

## Идея

Превратить данные таблиц `location_countries`, `location_regions`, `location_districts`, `location_localities` в полноценные SEO-лендинги для каждой географической единицы вместо query-параметров (`/places?locality=1`).

## Проблема

- URL вида `/places?locality=1` не индексируются поисковиками как отдельные страницы
- Нет возможности задать уникальные meta теги для каждой локации
- Список городов без контекста — плохой UX
- Упущенный трафик по geo-запросам ("интересные места в Сочи")

---

## URL-архитектура

Семантические slug-URL вместо query params:

```
/places                            → все места (существующая)
/places/countries/russia           → места в стране
/places/regions/krasnodar-krai     → места в регионе
/places/localities/sochi           → места в городе/нас. пункте
/places/districts/tsentralny       → места в районе
```

Иерархия URL отражает иерархию таблиц: country → region → district → locality.

---

## Структура страницы локации

```
┌─────────────────────────────────────────────────────┐
│  Breadcrumb: Россия / Краснодарский край / Сочи     │
├─────────────────────────────────────────────────────┤
│  H1: Интересные места в Сочи                        │
│  Подзаголовок: Найдено 142 места                    │
├──────────────┬──────────────────────────────────────┤
│  Мини-карта  │  Фильтр по категориям                │
│  с кластера  ├──────────────────────────────────────┤
│  ми мест     │  Список / Сетка карточек мест        │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│  Похожие места рядом:                               │
│  Адлер · Красная Поляна · Лазаревское               │
│  (ссылки на соседние localities того же region)     │
└─────────────────────────────────────────────────────┘
```

Ключевые элементы:
- **Breadcrumb** с JSON-LD разметкой (страна → регион → город)
- **Мини-карта** с кластерами мест данной локации
- **Related localities** — соседние населённые пункты (внутренняя перелинковка)
- **Фильтр по категориям** внутри локации, если у мест есть теги

---

## Meta теги — автоматическая генерация

Шаблоны на основе данных из БД:

```typescript
// /places/localities/sochi
title:       "Интересные места в Сочи — {count} мест | Geometki"
description: "Откройте {count} интересных мест в Сочи, {region_name}. 
              Карта, фото и описания: парки, памятники, природа."
canonical:   "https://geometki.com/places/localities/sochi"
og:image:    // статическая карта через Mapbox Static API с точками мест

// /places/regions/krasnodar-krai
title:       "Интересные места Краснодарского края — {count} мест | Geometki"
description: "Все интересные места Краснодарского края: {top_3_cities}. 
              Интерактивная карта и фото."
```

### Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Интересные места в Сочи",
  "url": "https://geometki.com/places/localities/sochi",
  "numberOfItems": 142,
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "url": "...", "name": "..." }
  ]
}
```

---

## "Карта городов" — точка входа

Вместо страницы `/localities` со скучным списком — **интерактивная карта**:

- Пузырьки/кружки на карте = населённые пункты, размер пузырька ∝ количество мест
- Hover — показывает название и count
- Клик — переход на `/places/localities/{slug}`
- Для мобайла — иерархический drill-down: Страна → Регион → Город

---

## SEO-паттерны

| Паттерн | Реализация |
|---|---|
| Hreflang | `/en/places/localities/sochi` для английской версии |
| Sitemap | Авто-генерация XML sitemap для всех локаций |
| Breadcrumb schema | JSON-LD `BreadcrumbList` на каждой странице |
| Canonical | На комбо-фильтрах указывать canonical на базовую страницу локации |
| Internal linking | Breadcrumbs + блок "Похожие города" |
| `noindex` | Локации с 0 мест — закрыть от индексации |

---

## Технические требования (клиент)

- Новые страницы Next.js: `pages/places/localities/[slug].tsx`, `pages/places/regions/[slug].tsx` и т.д.
- `getStaticPaths` + `getStaticPaths` для ISR (Incremental Static Regeneration)
- Slug генерировать на сервере (transliteration) и хранить в БД
- RTK Query эндпоинт: `GET /places?locality_slug=sochi` или через ID

## Технические требования (сервер)

- Добавить поле `slug` в таблицы локаций (уникальный, URL-safe)
- Новые эндпоинты: `GET /localities`, `GET /localities/{slug}`, аналогично для regions/countries
- Возвращать `count` мест для каждой локации

---

## Приоритет реализации

1. **Slug поля** в БД + миграция
2. **API эндпоинты** для localities и regions
3. **Страницы** `/places/localities/[slug]` и `/places/regions/[slug]`
4. **Meta теги** + JSON-LD
5. **Sitemap** обновление
6. **"Карта городов"** как точка входа (опционально, следующий этап)
