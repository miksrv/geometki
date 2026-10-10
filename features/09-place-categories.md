# Feature: Place Categories (niche taxonomy)

## Positioning

Geometki is a portal of **unusual and little-known places**: abandoned buildings, industrial
sites, natural wonders, strange monuments, anomalous zones. Not a catalogue of every
attraction a city map already has.

The current 23 categories describe "any attraction". The largest one (`memorial` + `monument`,
209 of 1169 places) is the least unique content on the site, while the things that define the
niche (industrial, viewpoints, odd art, anomalous places) are either spread across several
categories or missing.

## Principles

- A category answers "what will I see there and why go", not "which agency owns it".
- Each category is a separate search intent and gets a landing page (`/places/{category}`,
  see `20-location-seo-pages.md`).
- One level only: a place has exactly one category. Tags remain the free second axis
  ("UFO", "WWII", "fishing"). No sub-types.
- States are not categories ("dangerous", "permit required", "overnight possible" are tags).
  `abandoned` stays because it is the brand of the project.
- Legend vs fact: a place goes to `mystic` only if removing the legend makes it uninteresting.
  A real event (Tunguska, Totsk) is `disaster`; a real military site with UFO lore (Area 51)
  is `military`.
- What you see, not what happened: a visible meteor crater is `landscape`, the Tunguska site
  (forest and a story) is `disaster`.
- Landing titles list the three most searched sub-types; everything else goes to the intro
  text and tags.

## Categories

23 keys in six groups. The groups are for the UI (filters, category pages), not for the API.

### Nature

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `mountain` | Mountains | Mountains, cliffs and rock pillars | peaks, outcrops, cliffs, rock arches |
| `cave` | Caves | Caves and grottoes | caves, grottoes, karst sinkholes, ice caves |
| `waterfall` | Waterfalls | Waterfalls and rapids | waterfalls, cascades, rapids |
| `spring` | Springs | Springs, hot springs and geysers | springs, holy and mineral springs, hot springs, geysers |
| `water` | Lakes | Unusual lakes and reservoirs | karst and salt lakes, flooded quarries, rivers for recreation |
| `landscape` | Natural wonders | Canyons, craters, dunes and natural landmarks | canyons, gorges, craters, dunes, glaciers, monumental trees, geological outcrops |
| `viewpoint` | Viewpoints | Viewpoints and panoramas | panoramic spots, lookout towers |

### Abandoned & industrial

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `abandoned` | Abandoned | Abandoned buildings and ghost villages | houses, schools, hospitals, camps, unfinished buildings, deserted villages, drowned towns |
| `industrial` | Industrial | Factories, mines and quarries | working and dead plants, quarries, adits, spoil heaps |
| `military` | Military | Military bases, forts and bunkers | bases, forts, pillboxes, bunkers, missile silos, radar sites |

### History & architecture

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `castle` | Fortresses | Fortresses, kremlins and castles | fortresses, kremlins, city gates |
| `manor` | Manors | Manors and palaces | manors, palaces, estates |
| `architecture` | Architecture | Unusual architecture and Soviet modernism | Soviet modernism, constructivism, wooden architecture, oddball buildings |
| `religious` | Temples | Temples, monasteries and holy places | churches (abandoned and wooden especially), cave monasteries, mosques, datsans |
| `archeology` | Archaeology | Hillforts, kurgans and megaliths | hillforts, burial mounds, dolmens, menhirs, petroglyphs |
| `engineering` | Engineering | Lighthouses, towers, bridges and observatories | lighthouses, mills, water towers, dams, old bridges, observatories |
| `transport` | Vehicles | Vehicles, ships and railways | vehicles on plinths, ship and aircraft graveyards, abandoned railways, locomotives |

### Monuments & art

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `memorial` | Monuments | Monuments and memorials | WWII memorials, obelisks, busts, mass graves |
| `artwork` | Art objects | Unusual monuments and art objects | odd sculptures, street art, Soviet mosaics, land art |

### Dark & strange

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `disaster` | Disasters | Disasters, nuclear test sites and radiation | crash and death sites, nuclear test sites, exclusion zones, impact sites |
| `mystic` | Anomalous | Anomalous and mystical places | places of power, anomalous zones, legend-driven sites |

### Leisure (service categories, not promoted)

| Key | Label | Landing page | Includes |
|---|---|---|---|
| `museum` | Museums | Museums, zoos and open-air parks | unusual and private museums, open-air museums, zoos |
| `camping` | Campsites | Campsites and overnight spots | campsites, equipped rest areas |

## Mapping from the current keys

| Current | New | How |
|---|---|---|
| `nature` | `landscape` | rename |
| `construction`, `bridge` | `engineering` | merge |
| `mine` | `industrial` | merge; factories and quarries move in from `construction` / `abandoned` by hand |
| `monument` | `memorial` | merge; odd ones move to `artwork` by hand |
| `death`, `radiation` | `disaster` | merge |
| `animals` | `museum` | merge |
| `viewpoint`, `architecture`, `artwork`, `industrial`, `mystic` | new | manual re-tagging of a few dozen places, helped by existing tags |
| everything else | unchanged | |

## Touch points

`ApiModel.Categories` enum, `server/app/Config/Categories.php`, icons in `public/images/poi`,
`categoryCatalogue` in both locales, the OSM candidates whitelist (`OsmCandidates.php`, which
also maps to a non-existent `battlefield` key today), a DB migration for `places.category`,
and 301 redirects from the retired landing slugs.
