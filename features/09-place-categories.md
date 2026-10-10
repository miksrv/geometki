# Place Categories (niche taxonomy)

Tagging guide for the 23 category keys (texts and icons live in `categoryCatalogue` of the
client locales and `client/public/images/poi`).

## Rules for tagging a place

- A category answers "what will I see there and why go", not "which agency owns it".
- One level only: a place has exactly one category. Tags are the free second axis ("UFO",
  "WWII", "fishing"). No sub-types.
- States are not categories ("dangerous", "permit required", "overnight possible" are tags).
  `abandoned` is the exception: it is the brand of the project.
- Legend vs fact: a place goes to `mystic` only if removing the legend makes it uninteresting.
  A real event (Tunguska, Totsk) is `disaster`; a real military site with UFO lore (Area 51)
  is `military`.
- What you see, not what happened: a visible meteor crater is `landscape`, the Tunguska site
  (forest and a story) is `disaster`.

## Categories

Six groups; the groups exist only in the UI (filters, category pages), not in the API.

### Nature

| Key | Includes |
|---|---|
| `mountain` | peaks, outcrops, cliffs, rock pillars and arches |
| `cave` | caves, grottoes, karst sinkholes, ice caves |
| `waterfall` | waterfalls, cascades, rapids |
| `spring` | springs, holy and mineral springs, hot springs, geysers |
| `water` | karst and salt lakes, flooded quarries, rivers for recreation |
| `landscape` | canyons, gorges, craters, dunes, glaciers, monumental trees, geological outcrops |
| `viewpoint` | panoramic spots, lookout towers |

### Abandoned & industrial

| Key | Includes |
|---|---|
| `abandoned` | houses, schools, hospitals, camps, unfinished buildings, deserted villages, drowned towns |
| `industrial` | working and dead plants, quarries, mines, adits, spoil heaps |
| `military` | bases, forts, pillboxes, bunkers, missile silos, radar sites |

### History & architecture

| Key | Includes |
|---|---|
| `castle` | fortresses, kremlins, castles, city gates |
| `manor` | manors, palaces, estates (only these; every other building is `architecture`) |
| `architecture` | Soviet modernism, constructivism, wooden architecture, oddball and historical buildings |
| `religious` | churches (abandoned and wooden especially), cave monasteries, mosques, datsans |
| `archeology` | hillforts, burial mounds, dolmens, menhirs, petroglyphs |
| `engineering` | lighthouses, mills, water towers, dams, bridges, observatories |
| `transport` | vehicles on plinths, ship and aircraft graveyards, abandoned railways, locomotives |

### Monuments & art

| Key | Includes |
|---|---|
| `memorial` | WWII memorials, obelisks, busts, mass graves |
| `artwork` | odd sculptures and monuments, street art, Soviet mosaics, land art |

### Dark & strange

| Key | Includes |
|---|---|
| `disaster` | crash and death sites, nuclear test sites, radiation and exclusion zones, impact sites |
| `mystic` | places of power, anomalous zones, legend-driven sites |

### Leisure (service categories, not promoted)

| Key | Includes |
|---|---|
| `museum` | unusual and private museums, open-air museums, zoos |
| `camping` | campsites, equipped rest areas |

## Open: manual re-tagging

- `viewpoint`, `architecture`, `artwork`, `mystic` are empty; fill them by hand, using existing
  tags as hints.
- Non-manor buildings that were "historical buildings" under the old `manor` must move to
  `architecture`.
- Factories and quarries still under `abandoned` (and ex-`construction` ones now in
  `engineering`) belong in `industrial`; odd monuments now in `memorial` belong in `artwork`.
