# Medals

The award pictures of Geometki: one line-art emblem (from the image generator: a white base
and a pure green accent on black, or any colours) in a metal hexagon drawn by `medal.py`. The
style, the prompt and the subjects are in `features/26-game-seasons-and-quests.md` →
"Award pictures".

```bash
pip install Pillow numpy

# an achievement with tiers: out/<name>-bronze|silver|gold.png; the green accent in the
# group's colour (the table in the spec), the field in the tier's
python3 medal.py tier emblems/explorer.png --name explorer --accent "#3fd8c8" --preview

# the frame (classic | bold | thin) and the faint drawing of the field
# (none | rays | rings | hexes | honeycomb | stripes): one per group, from the table in the spec
python3 medal.py tier emblems/trailblazer.png --name trailblazer --accent "#ff5a4f" --frame bold --pattern hexes

# an achievement without tiers (a limited award): dark steel, a double inner line, free colours
python3 medal.py limited emblems/<name>.png --name <name> --color "#ffd95a" --field "#5b2a86"

# an emblem drawn in its own colours keeps them
python3 medal.py limited emblems/<name>.png --name <name> --color "#ffd95a" --own-colors

# a quest: dark steel, a dashed inner line, the emblem orange unless --color
python3 medal.py quest emblems/<slug>.png --name quest-<slug>

# a season: out/<name>-1|2|3|participant.png, the year on a band
python3 medal.py season emblems/<theme>.png --name season-2027-cold --year "26/27" --theme cold
```

- `emblems/` keeps the sources, so any medal can be built again after a change of the frame.
- `out/` is not committed: the pictures are uploaded on `/admin/achievements/:id` (a season's
  on its edit page).
- `--preview` adds `out/<name>-preview.png`: the medals on the light and the dark theme at full
  size, 60 and 40 px.
- The metals, the light of each tier and the colours of quests and seasons are constants at the
  top of `medal.py`; after a change rebuild every emblem in `emblems/`.
