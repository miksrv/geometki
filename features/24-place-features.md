# 24. Place Features — turning tags into geocaching-style attributes

> Status: an idea to develop, not a spec. Nothing here is decided; the lists and numbers are a starting point for discussion.

## The idea

Replace free-form tags with a closed set of **place features**, the way geocaching does cache attributes: a fixed list of icons, each meaning one practical fact about the place ("swimming possible", "4×4 needed", "free", "dangerous structures"), with a yes or a no value. Features answer "can I go there, how, with whom and what will I do" — the questions categories do not answer and tags never did.

The UI already hints at this: the tag input is labelled "place features" (`input_tags-label`), and the removed `/tags` page was called "Features of places".

## Why tags do not work today

Numbers from a recent production snapshot (the place list ends 2026-08-20):

- **842 tags**, 471 (56%) used once, only 74 used on 10+ places.
- **3771 links** on 1124 of 1169 places (3.4 per place).
- **~50% of links duplicate the category**: `памятник` on memorials, `гора` on mountains, `водопад` on waterfalls.
- **~16% are place names** (307 tags: Оренбург, Урал, Башкортостан) that the location hierarchy already covers.
- **~4.5% are real features** (38 tags: рыбалка, купание, пляж, зимой, бесплатно, сплав).
- **499 tags (59%) have no English title**; the existing ones are machine translations (`вершина → vertex`, `замок → lock`, `укрепление → strengthening`).
- Typos and variants of one word: `заброшенное / заброшка / заброшнное / заброшенно`, `пещера / пещеры`.
- For 530 places (45%) the tags add nothing beyond the category and the address.

At the same time tags carry the highest weight in personal recommendations (`UserInterestProfilesModel`, `PlacesModel::applyRecommendationSort`), so the smartest mechanism on the site runs on the noisiest data. Tag pages `/places?tag=` are indexable (against the rule in `20-location-seo-pages.md`), so most of them are one-place thin pages.

## How geocaching does it

- About 70 attributes with icons, grouped: permissions, conditions, facilities, hazards, equipment.
- Each attribute is **yes or no**: "dogs allowed" and a crossed-out "no dogs" are both useful facts.
- The cache page shows an icon grid with tooltips.
- Advanced search can **include and exclude** attributes: "available in winter" and not "boat required".

## What is different here

| Geocaching | Geometki |
|---|---|
| The cache owner sets attributes | Places are a shared wiki — anyone could set them, with history in `activity` |
| Yes / no | Probably **yes / no / unknown**; today almost everything is unknown |
| Attributes exist from the moment a cache is published | We have almost no feature data, so collecting it is part of the idea, not a later task |

An icon grid that is empty on 95% of places would be worse than the current hashtags, so the idea only works together with a way to fill it.

## A draft list (~35)

| Group | Features (yes / no) |
|---|---|
| Access | by ordinary car · 4×4 needed · walk under 1 km / 1–5 km / over 5 km · by water / boat · public transport nearby · parking |
| When | all year · accessible in winter · seasonal (floods, closures) · good at night · opening hours |
| Money and rules | free · paid entry · permit or pass needed · guarded territory · dogs allowed · drones allowed |
| Who it suits | with kids · with a stroller · wheelchair accessible · fitness needed |
| What to do | swimming · fishing · camping / overnight · campfire allowed · viewpoint · photo spot |
| Facilities | drinking water · toilet · food nearby · picnic spots |
| Hazards | collapsing structures · cliffs / drop-offs · ticks · wild animals · no mobile signal |
| Equipment | flashlight · helmet / rope · waders · wetsuit |

Hazards and equipment matter most for abandoned places and caves — two of the largest categories.

## Filling the data

- **Questions after a visit.** When someone marks a place as visited, ask 2–3 one-tap questions: "Can you swim here? Yes / No / Don't know". XP for answers. Fits freshness badges (`15`): "confirmed by a visitor in August 2026".
- **OpenStreetMap.** `fee`, `access`, `wheelchair`, `drinking_water`, `seasonal`, `dog`, `leisure=swimming_area` map well onto the list; the OSM collector already reads these objects.
- **Old tags** that fit: рыбалка, купание, пляж, кемпинг / палатки, зимой, бесплатно, сплав, дайвинг, лыжи, кафе, питьевой.
- **`tools/places`** sets features when it publishes a place.
- **Editing** as an icon grid with a three-way toggle — no typing, quick on a phone.

## Where features could show up

- **Place page** — a compact icon grid near the top; "no" crossed out, "unknown" hidden.
- **Place card** — up to three priority icons (access, season, hazard).
- **Filters** — include / exclude chips on `/places`, the landings and the map, combined with AND.
- **Recommendations** — interest profiles on clean keys instead of tags; maybe an editable "your interests" list in settings (the `ignored` flag already exists).
- **Follows and digests** (`12`, `16`) — "new places with swimming near me".
- **Seasonal events** (`06`) — winter places straight from the season group.
- **Quality score** (`05`, `15`) — "has features" instead of "has a tag".

## SEO

- Structured data maps one to one: `amenityFeature` → `LocationFeatureSpecification` with `value: true/false`, plus `isAccessibleForFree` and `publicAccess`.
- Feature filter pages are `noindex` by default. Later, maybe a whitelist of pairs with real search demand and their own text: "waterfalls where you can swim", "caves for beginners", "places to go with kids in {region}".

## What happens to the old tags

Half of today's links are not features but **object subtypes**: `церковь` or `завод` on an abandoned place, `бюст` or `обелиск` on a memorial. Since a place has one category, these tags are a useful second dimension, and pages like "abandoned churches" or "mosques of Bashkortostan" are a strong SEO asset. Features do not replace them.

Options: drop them, or map them to a subtype key before deleting tags, even if a subtype field appears in the UI only later. Themes could be kept the same way (WWII, USSR, space, aviation, radiation, UNESCO — 10–15 after merging synonyms). Place names and typos go.

Old `/places?tag=` URLs would redirect (301) to the new filter or to `/places`.

## Rough shape

Same pattern as categories (`server/app/Config/Categories.php`): a key whitelist in `server/app/Config/Features.php`, the enum on the client, texts in `common.json` under `featureCatalogue.<key>`, icons in `client/public/images/features/`. Storage could be `places_features (place_id, feature_key, value, user_id, updated_at)`, unique by place and key.

## Open questions

- Two states or three? Is "unknown" shown anywhere?
- Who can set a feature: anyone, the author, users above some level? How are conflicting answers resolved — last edit, majority of visitors?
- How many features: 30 is easy to scan, 70 is geocaching-complete.
- Per-category lists (no "swimming" for a museum) or one list for all?
- Do subtypes and themes go into the same idea, or become separate ones?
- Icons: our own set, or an open icon set with a licence that allows it?
- Do features count towards XP and achievements, and how to avoid farming one-tap answers?
- What happens to `features/15` (its "Complete" status and score formula use tags)?
