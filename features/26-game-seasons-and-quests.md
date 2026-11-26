# Feature 26: The Game — Seasons and Quests

> Status: built, ships open to everyone in 2.0.0. How it works is in `CLAUDE.md` → "The game",
> the API in `server/API.md` → "Game", the look in `client/DESIGN.md` → "The game"; the numbers
> are in `server/app/Config/Game.php`. Open problems and what is not built are the "Game: …"
> lines of `ISSUES.md`. Left here: the launch and the award pictures.

## Launch

- **Tested first.** Before the release everything is walked through on Android and on an
  iPhone: the quests, the confirmations, the season, the awards.
- **Ready at the launch:** the section "Game" with the description of the game, its mechanics
  and the table of points; the award pictures; the first quest.
- **The first quest is "Space Orenburg"** (the places of Gagarin and of cosmonautics in the
  city). The launch is announced by it: an advertisement in the owner's astronomy Telegram
  channel, the local media after that.
- **The launch is release 2.0.0**, possibly in January 2027. The first season is created by
  hand on the site ("Создать сезон" on `/game`) with its dates, title, description and its medal: one picture for
  every participant (also the season's picture), with gold, silver and bronze variants for the
  places 1–3. By then the owner adds about 2000 more places
  to the map, so that there is a field to play on.
- **The limited awards of the first season**, made by hand on `/admin/achievements` with the
  season's dates, without tiers, type "seasonal":
  - «Предстартовая подготовка» / "Pre-launch Training" (`prelaunch`, 50 XP): visit 10 places,
    give 10 ratings, write 10 reviews;
  - «Новые миры» / "New Worlds" (`new-worlds`, 100 XP): add 5 places, visit 10 museums and
    10 monuments (`places_visited` with the categories `museum` and `memorial`);
  - «Три витка» / "Three Orbits" (`three-orbits`, 100 XP): complete any three quests.

  Their medals: emblems in colour (`tools/medals/emblems/<slug>.png`), a steel rim, each its
  own frame — `python3 medal.py limited emblems/prelaunch.png --name prelaunch --solid --frame
  bold --ribbon "#ff7a2e" --field "#1c2a5a" --scale 1.15 --lift 0.06`; `new-worlds`:
  `--frame thin --field "#3a2466" --pattern rays --scale 1.1`; `three-orbits`: `--frame classic
  --field "#10305a" --pattern hexes --scale 1.12`.
- **The first season is «Поехали!» / "Let's Go!"**, from the release (about 15 December 2026)
  to 15 April 2027 — it ends right after Cosmonautics Day, in the line of the first quest.
  Its description (RU / EN):
  - «Первый сезон Геометок. Как Юрий Гагарин, который стал лётчиком в Оренбурге,
    исследователи отправляются в путь: находят интересные места, подтверждают визиты,
    открывают новые геометки и закрывают белые пятна на карте. Сезон завершается сразу после
    Дня космонавтики — тогда и посмотрим, кто ушёл дальше всех.»
  - "The first season of Geometki. Like Yuri Gagarin, who became a pilot in Orenburg,
    explorers set off: they find interesting places, confirm their visits, discover new places
    and fill in the white spots on the map. The season ends right after Cosmonautics Day — then
    we will see who has gone the furthest."

## Award pictures

Every award is a medal in the manner of the badges of Ingress (`Founder` as the reference,
the standard and event badges for the colours): a coloured field in a metal hexagon and one
line-art emblem in it. Chosen on 2026-11-16 after the flat enamel pins (2026-11-10) looked
primitive side by side.

- **Two parts.** The image generator draws only the **emblem**: line art on black, no frame;
  white is its base, pure green (#00ff00) its accent. The **frame and the tier** are drawn by
  `tools/medals/medal.py` (see its README), the same to the pixel for every award, so a set
  looks as one.
- **Shape:** a pointy-top hexagon (a cell of the hex layer of the map), a double frame: a
  bevelled metal rim, a dark gap, a thin inner line. The picture is 443×512, transparent, the
  hexagon's proportion of `AchievementIcon`.
- **One emblem per group.** The three tiers of an achievement are the same picture in the same
  colours; the tier is the metal of the rim and the colour of the field, as the standard badges
  of Ingress: **bronze** — a matte rim, a brown field, the base of the emblem warm cream;
  **silver** — a bright rim, a slate field, the base white with a faint glow; **gold** — a gold
  rim, an ochre field with a warm light, the base glowing.
- **Colours differ between groups:** the accent of the emblem is the group's own colour
  (`--accent`, the table below), the same on all three tiers.
- **Without tiers** the rim is dark steel and the colours are free, as the event badges of
  Ingress: the field (`--field`) and the emblem (`--color`) in any colours, or an emblem drawn
  in its own colours (`--own-colors`, any colours on black):
  - a **limited award** — a double inner line;
  - a **quest** — the inner line dashed as a path, the emblem orange unless chosen otherwise;
  - a **season** — four medals: gold, silver, bronze for the places 1–3, steel with the
    season's colour (cold light blue, warm coral) for every participant; the emblem smaller
    and higher, the year on a metal band at the bottom (`2027`, `26/27`), drawn by the script.
- **Medals differ, as on the profile of Ingress:** besides the colours, a medal takes one of
  the frames (`--frame`: `classic` — a bevelled rim and a thin inner line; `bold` — a thick
  ring in the group's colour between two metal edges; `thin` — one thin rim and the largest
  field) and a faint drawing of the field (`--pattern`: `rays` as Founder, `rings`, `hexes`,
  `honeycomb` as the hex layer of the map, `stripes`, or `none`). A group keeps its frame and
  pattern on all its tiers; neighbouring groups take different ones (the table below).
- **No text** in an emblem. **Every award has its own subject:** no two share one, and a new
  award takes a free subject, never a taken one.
- Shown at 40 px on the light and the dark theme: the emblem needs a strong silhouette, no
  hairlines.
- **Replacing** a picture keeps the award: upload it on `/admin/achievements/:id`, the id and
  the people who earned it stay.

### Prompt: an emblem

A new chat for every emblem, `Founder-medal.webp` and `ingress-res-badges-1.png` attached as
the reference. The emblem goes to `tools/medals/emblems/<name>.png`.

```
Generate an image right away, do not ask clarifying questions.

A single emblem for a game achievement medal, in the style of the attached
Ingress medals: a detailed but bold line-art illustration with confident
strokes of varied weight, a sense of depth and motion.

Two flat colours on a pure black background: the main drawing in pure
white (#ffffff) and its key detail — [ACCENT PART] — in pure green (#00ff00).
No other colours, no grey, no gradients, no glow.

Subject: [SUBJECT].

Composition: one compact centred shape that fills a circle about 80% of
the canvas; nothing sticks out of it, no small separate element standing
apart (no dot, pin or star on top). Strong silhouette that stays readable
when shrunk to 40x40 pixels: no hairlines, no tiny details.
No frame, no hexagon, no text, no letters, no numbers.
Square image, 1024x1024.
```

For an emblem in its own colours (an award without a tier) the second paragraph names the
colours instead. A row of the table fills the prompt: the subject goes to `[SUBJECT]`, the
accent part to `[ACCENT PART]`; then `python3 medal.py tier emblems/<group>.png --name <group>
--accent <colour> --frame <frame> --pattern <pattern> --preview`.

**Progress (2026-11-16):** the nine base groups are drawn (✓). `pathfinder` («Следопыт»:
confirmed visits to 10 / 30 / 120 places, 30 / 100 / 200 XP, category `game`) is made by hand
in the admin — migrations make no awards; `wayfarer` was dropped. Confirmation works with or
without a season, so its progress grows between seasons too.

| Group (`group_slug`) | Subject | Accent part | `--accent` | `--frame` / `--pattern` | Done |
|---|---|---|---|---|---|
| `explorer` | a winding footpath running from the foreground between rolling hills to the horizon, all inside a circle | the footpath | teal `#3fd8c8` | `classic` / `rays` | ✓ |
| `trailblazer` | a flag planted on the top of a mountain peak | the flag | red `#ff5a4f` | `bold` / `none` | ✓ |
| `photographer` | a classic camera seen from the front, slightly turned: the body, the viewfinder hump, a big round lens | the lens | sky blue `#5ab8ff` | `thin` / `rings` | ✓ |
| `curator` | a quill pen over an open book | the quill | violet `#b48cff` | `classic` / `stripes` | ✓ |
| `critic` | a star with rays bursting out of it | the rays | pink `#ff6fb1` | `bold` / `hexes` | ✓ |
| `trusted` | a shield between two laurel branches | the laurel branches | green `#5fd38a` | `classic` / `honeycomb` | ✓ |
| `veteran` | a chevron with wings | the chevron | royal blue `#4f7bff` | `bold` / `stripes` | ✓ |
| `regular` | a tear-off wall calendar, its days ticked off one after another | the tick marks | lime `#b8e05a` | `thin` / `rays` | ✓ |
| `streak` | a flame | the inner tongue of the flame | orange `#ff8a2e` | `classic` / `hexes` | ✓ |
| `pathfinder` | a pair of binoculars seen from the front, slightly turned, the strap curving below | the lenses | yellow `#ffd84a` | `thin` / `honeycomb` | ✓ |

### The first season: a portrait

The season «Поехали!» has a bust of Yuri Gagarin instead of a line-art emblem, in the manner
of the portrait badges of Ingress events: no circle, the bust stands on the band with
`12.04.2027` (Cosmonautics Day). The first place is in colour (gold), the second and the
third in two tones (silver, bronze), the participant all white on steel. Built with
`python3 medal.py season emblems/season-2027-gagarin.png --name season-2027-gagarin --portrait
--mono emblems/season-2027-gagarin-mono.png --year 12.04.2027 --accent "#ff7a2e" --scale 0.92`.
Two prompts in one chat, a colour photo of Gagarin attached to the first:

```
Generate an image right away, do not ask clarifying questions.

A single emblem for a game season medal: a bust of Yuri Gagarin, based on
the attached photo — in his spacesuit and white helmet with the visor
raised, a slight smile, facing the viewer, turned a little to the side.

Flat vector style: bold clean shapes of a few solid colours — the white
helmet, the orange spacesuit, warm skin, dark navy for the details and
shadows — at most two tones per colour, no gradients, no textures.
On a pure black background.

No circle, no ring, no round frame, no badge shape, no background scene:
only the bust, the shoulders cut off by a straight horizontal line at the
bottom. No text, no letters (no "СССР" on the helmet), no numbers.
Strong silhouette that stays readable when shrunk to 40x40 pixels.
Square image, 1024x1024.
```

```
Now draw exactly the same bust, the same pose, face and shapes, as bold
line art in two flat colours on a pure black background: the helmet, the
face and all the lines in pure white (#ffffff), the spacesuit filled with
pure green (#00ff00). No other colours, no grey, no gradients, no
shading. No circle, no frame, no text, no letters, no numbers. The
shoulders cut off by a straight horizontal line at the bottom, as before.
```

### Quests: a picture in colour

A quest's medal has no tiers: an emblem in colour (a flat poster illustration on black, kept as
drawn), the rim in the quests' own metal — anodised titanium (blue-violet, chosen 2026-11-16; copper
with a patina, `--metal patina`, stays as an option) — and a dashed inner line, a path. The first one, «Космический Оренбург»: a
Vostok-style rocket lifting off and the coat of arms of Orenburg at its base
(`emblems/quest-space-orenburg.png`), built with `python3 medal.py quest
emblems/quest-space-orenburg.png --name quest-space-orenburg --solid --scale 1.2`. The prompt
(the coat of arms attached):

```
Generate an image right away, do not ask clarifying questions.

A single emblem for a game quest medal "Space Orenburg", two parts side by
side and of the same height: on the left a classic Vostok-style rocket
lifting off straight upwards on a bold trail of flame and smoke, on the
right a heraldic shield — a simplified version of the attached coat of
arms of Orenburg. The smoke at the rocket's base rolls under the shield
and joins them into one wide group.

Flat vector style, the same as a bold poster illustration: clean shapes of
a few solid colours — white and light grey for the rocket, orange and
yellow for the flame, the blue and the gold of the coat of arms, dark navy
for the details and shadows — at most two tones per colour, no gradients,
no textures. On a pure black background.

No circle, no ring, no round frame, no badge shape, no stars or planets
around, no background scene: only the rocket with its trail and the
shield. The group fills the canvas evenly: about as wide as it is tall,
no large empty corner. No text, no letters, no numbers.
Strong silhouette that stays readable when shrunk to 40x40 pixels.
Square image, 1024x1024.
```

Reserved for the awards of the game, not to be used by the achievements:

- **Seasons:** one subject of the season's theme (a snowflake over mountains, a sun over a
  field).
- **Quests:** the landmark of the quest (a tower, a monument, a rocket for the space quest):
  every quest has its own.
- **Exploration of a location:** a compass, a hexagon grid filling up, a spyglass.
- **Confirmed visits:** a map pin with a check mark, a tent, a backpack.
