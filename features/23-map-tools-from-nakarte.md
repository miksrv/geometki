# 23. Map Tools from nakarte.me — панорамы, профиль высот и другие инструменты карты

> Статус: не начато, кроме мелочей, отмеченных ниже. На `/map` уже есть рулетка и площадь (`components/map/ruler`, `components/map/area-measure`), координаты под курсором (`components/map/coordinates-control`), контекстное меню с копированием координат и ссылками на Яндекс/Google (`components/map/context-menu`, `components/shared/map-links`), центр и зум в URL (`/map#lat,lon,zoom`).

## Источник

[nakarte.me](https://nakarte.me), исходники [wladich/nakarte](https://github.com/wladich/nakarte), лицензия **MIT** — код можно переносить с указанием автора. nakarte на «голом» Leaflet и Knockout, у нас react-leaflet: модули из `src/lib/` переписываются React-компонентами по образцу `Ruler.tsx`.

---

## 1. Панорамы: Mapillary и Google Street View

Модуль nakarte: `leaflet.control.panoramas` (источники `google`, `mapillary`, `mapycz`, `wikimedia`). Кнопка включает слой покрытия, клик ищет ближайшую панораму в радиусе, панорама открывается в панели, маркер на карте синхронизирован с направлением взгляда.

- **Mapillary** — бесплатно, нужен только токен; официальный векторный слой покрытия и просмотрщик `mapillary-js`. В России покрытие часто свежее, чем у Google — делать первым.
- **Google Street View** — Maps JS API по требованию, `StreetViewService.getPanorama({ location, radius, preference: NEAREST })`, `StreetViewPanorama`. Нужен ключ с биллингом (есть бесплатная квота, поставить лимит). Слой покрытия nakarte берёт с недокументированного URL (серая зона по ToS) — обойтись без слоя: клик и поиск ближайшей панорамы.
- UI: одна кнопка «Панорамы» и выбор источника; Wikimedia Commons — третьим источником.

## 2. Wikimedia Commons: лимит в 50 точек

Слой `components/map/wikimedia-commons/` (`generator=geosearch`, `ggslimit=50`). На крупной области слой уже не запрашивает API и показывает «Приблизьте карту» (`components/map/layers-status`). Осталось: в плотных местах фото в десятки раз больше 50, показываются случайные (панель помечает `50+`). nakarte рисует покрытие из своих бинарных тайлов на canvas — их сервер подключать нельзя. Наш вариант: разбить область на несколько запросов или кластеризовать.

## 3. Профиль высот для рулетки

Модули `leaflet.control.elevation-profile`, `elevations`. График высот по линии рулетки, набор/сброс, минимум/максимум. Источник высот: Open-Meteo Elevation API или Mapbox Terrain-RGB (токен Mapbox есть).

## 4. Небольшие инструменты

| Фича | Модуль nakarte | Что осталось |
|---|---|---|
| Координаты под курсором | `leaflet.control.coordinates` | Несколько форматов (десятичные, градусы-минуты-секунды) на основе `functions/coordinates.ts` |
| Азимут | `leaflet.control.azimuth`, `magnetic-declination` | Направление и расстояние между двумя точками с учётом магнитного склонения |
| Состояние карты в URL | `leaflet.hashState` | Слой в URL (центр и зум уже есть; настройки карты пока только в `localStorage`, `components/map/mapSettings.ts`) |

## 5. Крупные фичи (позже)

| Фича | Модуль nakarte | Суть |
|---|---|---|
| Импорт и экспорт GPX/KML | `leaflet.control.track-list` | Свой трек на карту или скачать маршрут |
| Печать в PDF | `leaflet.control.printPages` | Нишевая |
| Дополнительные слои | `westraPasses`, `soviet-topomaps-grid`, `wikimapia` | Тайлы с серверов nakarte подключать нельзя; у каждого источника проверять лицензию |

### Wikimapia

nakarte берёт внутренние тайлы wikimapia.org через свой прокси (недокументированный формат, вероятно против их условий) — так не делать. Легальный путь — официальный API (`api.wikimapia.org`, `function=box`, ключ, лимиты, CC BY-SA с атрибуцией) через наш сервер с кэшем, как `OsmCollector` ходит в Overpass. Данные Wikimapia во многом устарели, OSM обычно полезнее. Пригодится сам приём nakarte: полигоны на `<canvas>` в `L.GridLayer`, подсветка при наведении через `isPointInPolygon` — например, для контуров объектов в `components/map/osm-candidates/`.

---

## Порядок

1. Панорамы: Mapillary, затем Google Street View, Wikimedia третьим источником.
2. Профиль высот для рулетки.
3. Форматы координат, слой в URL.
4. Остальное по необходимости.
