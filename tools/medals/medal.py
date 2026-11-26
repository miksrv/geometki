#!/usr/bin/env python3
"""
Builds the award pictures of Geometki from one emblem: a white drawing on black
(see README.md). The frame is drawn here, the same for every award, so a set
looks as one; only the emblem comes from the image generator.

    # an achievement with tiers: three medals, one picture in three metals
    python3 medal.py tier emblems/explorer.png --name explorer

    # an achievement without tiers (a limited award): dark steel, the emblem in its colour
    python3 medal.py limited emblems/autumn.png --name autumn --color "#3fd8c8"

    # a quest: dark steel, a dashed inner line (a path), the emblem in the quest orange
    python3 medal.py quest emblems/space.png --name quest-space

    # a season: gold, silver, bronze for the places 1–3 and steel for every participant,
    # the year on a band
    python3 medal.py season emblems/winter.png --name season-2027-cold --year "26/27" --theme cold

The pictures land in out/ (443×512, transparent, the hexagon's proportion of
AchievementIcon); --preview adds a sheet on the light and the dark theme at full
size, 60 and 40 px.
"""
import argparse
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SS = 2                                   # supersampling
H = 512 * SS
W = round(H * math.sqrt(3) / 2)          # a pointy-top hexagon: 0.866 of its height
CX, CY, R = W / 2, H / 2, H / 2 - 2 * SS

EMBLEM_BOX = 0.72                        # the emblem's longer side, of the field's width

# A metal: the bevel of the rim (top, middle, bottom) and the thin inner line
METALS = {
    'bronze': dict(rim=('#e6b48e', '#a86a40', '#4f2f1a'), line='#b07a52'),
    'silver': dict(rim=('#ffffff', '#c3cad2', '#5f6770'), line='#d6dde4'),
    'gold':   dict(rim=('#fff4bf', '#e8b23a', '#7a4c0c'), line='#f2c75a'),
    'steel':  dict(rim=('#c9d0d8', '#6f7882', '#262a30'), line='#8a939c'),
    # The quests' own metals: anodised titanium, or copper with a patina
    'titanium': dict(rim=('#dfe4ff', '#7f86e6', '#2b2a6e'), line='#a9a6f2'),
    'patina':   dict(rim=('#c8f1e4', '#4fae98', '#1d4a44'), line='#7fcdb8'),
}

# The field under a quest's emblem in colour: dark, in the shade of its metal
QUEST_FIELDS = {'titanium': ('#272c5c', '#0f1128'), 'patina': ('#1f4a45', '#0c1a19'), 'steel': ('#2a3140', '#0e1013')}

# The inside of a tier, as the standard badges of Ingress: the field takes the tier's colour
# (centre, edge), the emblem's base is light (top, bottom), its accent keeps the group's colour;
# the glow behind the emblem (colour, strength in %). Bronze is dull, silver cool, gold shines
TIER_LOOKS = {
    'bronze': dict(art=('#f0dcc6', '#cdb093'), field=('#6e4c33', '#3a281b'), glow=None),
    'silver': dict(art=('#ffffff', '#e2e8ef'), field=('#5f6a76', '#2c333b'), glow=('#ffffff', 30)),
    'gold':   dict(art=('#fffaf0', '#fbe7b8'), field=('#8f6d2c', '#4a3613'), glow=('#ffd36b', 60)),
}

QUEST_COLOR = '#ff8a3d'
PORTRAIT_GLOW = ('#ffffff', 10)           # a season's bust: a faint light, no halo
SEASON_COLORS = {'cold': '#8fd3ff', 'warm': '#ff8f6b'}
FONTS = [
    '/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shade(h, k):
    """The colour darkened (k < 1) or lightened (k > 1)"""
    c = rgb(h)
    c = tuple(min(255, round(v * k)) if k <= 1 else round(v + (255 - v) * (k - 1)) for v in c)
    return '#%02x%02x%02x' % c


def contrast(a, b):
    """The WCAG contrast ratio of two colours"""
    def lum(c):
        c = [v / 255 for v in c]
        c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def hexagon(r):
    return [(CX + r * math.cos(math.radians(-90 + 60 * k)), CY + r * math.sin(math.radians(-90 + 60 * k)))
            for k in range(6)]


def hex_mask(r):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(hexagon(r), fill=255)
    return m


def solid(colour):
    return Image.new('RGB', (W, H), rgb(colour))


def vgrad(stops, reverse=False):
    """A vertical gradient through the colours, top to bottom"""
    cols = [rgb(c) for c in stops][::-1 if reverse else 1]
    g = Image.new('RGB', (1, H))
    for y in range(H):
        t = y / (H - 1) * (len(cols) - 1)
        i = min(int(t), len(cols) - 2)
        g.putpixel((0, y), lerp(cols[i], cols[i + 1], t - i))
    return g.resize((W, H))


def rgrad(inner, outer, radius):
    """A radial gradient from the centre"""
    a, b = rgb(inner), rgb(outer)
    sw, sh = 128, round(128 * H / W)
    small = Image.new('RGB', (sw, sh))
    for y in range(sh):
        for x in range(sw):
            d = math.hypot((x + .5) / sw * W - CX, (y + .5) / sh * H - CY) / radius
            small.putpixel((x, y), lerp(a, b, min(1, d)))
    return small.resize((W, H), Image.BICUBIC)


def load_emblem(path, scale=1.0, lift=0.0, stand=None):
    """
    An emblem on black: white is its base, pure green (#00ff00) its accent, any other colour is
    kept as drawn (an emblem in its own colours). Cropped, scaled into the field, centred; above a
    band a season's emblem is smaller (scale) and raised (lift, of the radius); a portrait
    stands on a line (stand: y, its bottom there, its width `scale` of the field). Returns the
    masks of the base and of the accent, the colours as drawn and the filled silhouette (solid)
    """
    art = Image.open(path).convert('RGB')
    r, g, b = art.split()
    shape = ImageChops.lighter(ImageChops.lighter(r, g), b)            # how much is drawn here
    art = art.crop(shape.point(lambda v: 255 if v > 40 else 0).getbbox())
    canvas = Image.new('RGB', (W, H), 0)
    if stand is None:
        box = R * math.sqrt(3) * 0.88 * EMBLEM_BOX * scale
        k = box / max(art.size)
        art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
        canvas.paste(art, (round(CX - art.width / 2), round(CY - R * lift - art.height / 2)))
    else:
        k = R * math.sqrt(3) * 0.88 * scale / art.width
        art = art.resize((round(art.width * k), round(art.height * k)), Image.LANCZOS)
        canvas.paste(art, (round(CX - art.width / 2), round(stand - art.height)))
    r, g, b = canvas.split()
    shape = ImageChops.lighter(ImageChops.lighter(r, g), b)
    # Green stands out of red and blue: the accent
    accent = ImageChops.subtract(g, ImageChops.lighter(r, b)).point(lambda v: min(255, v * 2))
    accent = ImageChops.multiply(accent, shape)
    base = ImageChops.subtract(shape, accent)
    # The silhouette: everything the black around it does not reach from the corners
    flood = canvas.copy()
    for corner in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        ImageDraw.floodfill(flood, corner, (255, 0, 255), thresh=30)
    fr, fg, fb = flood.split()
    outside = ImageChops.multiply(fr.point(lambda v: 255 if v == 255 else 0), fg.point(lambda v: 255 if v == 0 else 0))
    outside = ImageChops.multiply(outside, fb.point(lambda v: 255 if v == 255 else 0))
    solid_mask = ImageChops.invert(outside).filter(ImageFilter.GaussianBlur(SS * 0.7))
    return dict(base=base, accent=accent, shape=shape, colours=canvas, solid=solid_mask)


def _unmultiply(colours, cover):
    """Colours drawn on black, brought to full strength: their cover becomes the mask instead"""
    import numpy as np
    c = np.asarray(colours, dtype=np.float32)
    a = np.asarray(cover, dtype=np.float32)[..., None]
    return Image.fromarray(np.clip(c * 255 / a, 0, 255).astype(np.uint8), 'RGB')


def dashed_hexagon(draw, r, colour, width, dash, gap):
    """The inner line of a quest: a path of dashes along the hexagon"""
    pts = hexagon(r) + [hexagon(r)[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        n = max(1, round(length / (dash + gap)))
        step = length / n
        for i in range(n):
            a = (i * step + gap / 2) / length
            b = (i * step + gap / 2 + step - gap) / length
            draw.line([(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a), (x0 + (x1 - x0) * b, y0 + (y1 - y0) * b)],
                      fill=rgb(colour), width=width)


def pattern_mask(kind, field_r):
    """A faint drawing of the field behind the emblem, so medals of one kind differ"""
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    w = round(R * 0.014)
    if kind == 'rays':          # as Founder: a ring and rays out of it
        r0 = R * 0.62
        d.ellipse([CX - r0, CY - r0, CX + r0, CY + r0], outline=255, width=w)
        for k in range(12):
            a = math.radians(k * 30 + 15)
            d.line([(CX + r0 * 1.08 * math.cos(a), CY + r0 * 1.08 * math.sin(a)),
                    (CX + R * math.cos(a), CY + R * math.sin(a))], fill=255, width=w)
    elif kind == 'rings':       # circles around the emblem
        for k in (0.5, 0.62, 0.74):
            d.ellipse([CX - R * k, CY - R * k, CX + R * k, CY + R * k], outline=255, width=w)
    elif kind == 'hexes':       # hexagons inside one another
        for k in (0.48, 0.62, 0.76):
            d.polygon(hexagon(R * k), outline=255, width=w)
    elif kind == 'honeycomb':   # the hex layer of the map
        a = R * 0.16
        dx, dy = a * math.sqrt(3), a * 1.5
        for row in range(-8, 9):
            for col in range(-6, 7):
                x = CX + col * dx + (dx / 2 if row % 2 else 0)
                y = CY + row * dy
                d.polygon([(x + a * math.cos(math.radians(-90 + 60 * k)), y + a * math.sin(math.radians(-90 + 60 * k)))
                           for k in range(6)], outline=255, width=max(1, w // 2))
    elif kind == 'stripes':     # diagonal stripes
        step = R * 0.14
        for k in range(-20, 21):
            x = CX + k * step
            d.line([(x - H, CY + H), (x + H, CY - H)], fill=255, width=w * 2)
    return ImageChops.multiply(m, hex_mask(field_r))


def medal(emblem, metal, art, field, glow=None, line='solid', band=None, accent=None, own=False,
          frame='classic', pattern='none', ribbon=None):
    """
    One medal. metal: a key of METALS; art: the colours of the emblem's base (top, bottom);
    accent: the colour of its green parts; own: the emblem in the colours it was drawn in;
    field: (centre, edge); glow: (colour, %); line: 'solid' | 'double' | 'dashed';
    band: (text, colour) or None; frame: 'classic' (a bevelled rim and a thin inner line),
    'bold' (a thick coloured ring between two metal edges, the colour `ribbon`) or 'thin' (one
    thin rim, the largest field); pattern: the faint drawing of the field (pattern_mask)
    """
    m = METALS[metal]
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    img.paste(vgrad(m['rim']), (0, 0), hex_mask(R))                         # the bevel, lit from above
    if frame == 'thin':
        img.paste(vgrad(m['rim'], reverse=True), (0, 0), hex_mask(R * 0.96))
        img.paste(solid('#0a0b0d'), (0, 0), hex_mask(R * 0.935))
        line = None
        field_r = R * 0.925
    elif frame == 'bold':
        # The metal stays wide enough to show the tier; the ring is the group's colour, toned down
        ribbon = ribbon or field[0]
        img.paste(vgrad(m['rim'], reverse=True), (0, 0), hex_mask(R * 0.95))
        img.paste(solid('#0a0b0d'), (0, 0), hex_mask(R * 0.925))
        img.paste(vgrad((shade(ribbon, 0.95), shade(ribbon, 0.7), shade(ribbon, 0.45))), (0, 0), hex_mask(R * 0.915))
        img.paste(solid('#0a0b0d'), (0, 0), hex_mask(R * 0.83))
        img.paste(vgrad(m['rim']), (0, 0), hex_mask(R * 0.82))
        line = None
        field_r = R * 0.795
    else:
        img.paste(vgrad(m['rim'], reverse=True), (0, 0), hex_mask(R * 0.95))    # its inner slope
        img.paste(solid('#0a0b0d'), (0, 0), hex_mask(R * 0.915))                # the gap
        field_r = R * 0.88

    if line is None:
        pass
    elif line == 'dashed':
        img.paste(rgrad(*field, R * 0.9), (0, 0), hex_mask(R * 0.895))
        dashed_hexagon(ImageDraw.Draw(img), R * 0.885, m['line'], round(R * 0.016), R * 0.07, R * 0.045)
        field_r = R * 0.87
    else:
        img.paste(solid(m['line']), (0, 0), hex_mask(R * 0.895))           # the thin inner line
        if line == 'double':
            img.paste(solid('#0a0b0d'), (0, 0), hex_mask(R * 0.88))
            img.paste(solid(m['line']), (0, 0), hex_mask(R * 0.865))
            field_r = R * 0.85

    field_mask = hex_mask(field_r)
    img.paste(rgrad(*field, R * 0.9), (0, 0), field_mask)
    if pattern != 'none':
        faint = pattern_mask(pattern, field_r).point(lambda v: v * 22 // 100)
        # Only around the emblem: inside its outline the field stays clean
        x0, y0, x1, y1 = emblem['shape'].getbbox()
        pad = R * 0.03
        clear = Image.new('L', (W, H), 0)
        ImageDraw.Draw(clear).ellipse([x0 - pad, y0 - pad, x1 + pad, y1 + pad], fill=255)
        faint = ImageChops.subtract(faint, clear.filter(ImageFilter.GaussianBlur(R * 0.01)))
        img.paste(solid(art[0]), (0, 0), faint)
    if glow:
        colour, strength = glow
        g = emblem['shape'].filter(ImageFilter.GaussianBlur(12 * SS)).point(lambda v: min(255, v * strength // 100))
        img.paste(solid(colour), (0, 0), ImageChops.multiply(g, field_mask))
    if own == 'solid':
        # A portrait in colour: as drawn, its dark lines too, inside its silhouette
        img.paste(emblem['colours'], (0, 0), ImageChops.multiply(emblem['solid'], field_mask))
    elif own:
        # The colours as drawn: each pixel brought to full strength, its brightness is its cover
        shape = emblem['shape']
        full = _unmultiply(emblem['colours'], shape.point(lambda v: max(v, 1)))
        img.paste(full, (0, 0), ImageChops.multiply(shape, field_mask))
    else:
        img.paste(vgrad(art), (0, 0), ImageChops.multiply(emblem['base'], field_mask))
        img.paste(solid(accent) if accent else vgrad(art), (0, 0), ImageChops.multiply(emblem['accent'], field_mask))

    if band:
        text, colour = band
        top, bottom = CY + R * 0.52, CY + R * 0.74
        bar = Image.new('L', (W, H), 0)
        ImageDraw.Draw(bar).rectangle([0, top, W, bottom], fill=255)
        bar = ImageChops.multiply(bar, hex_mask(R * 0.895))
        img.paste(solid('#0a0b0d'), (0, 0), bar.filter(ImageFilter.MaxFilter(2 * round(R * 0.012) + 1)))
        # The band is lit within itself, from the light of the metal to its middle: the dark of the
        # rim's bottom would swallow the text
        light, middle = rgb(METALS[metal]['rim'][0]), rgb(METALS[metal]['rim'][1])
        strip = Image.new('RGB', (1, H))
        for y in range(H):
            t = min(1, max(0, (y - top) / (bottom - top)))
            strip.putpixel((0, y), lerp(light, middle, t))
        img.paste(strip.resize((W, H)), (0, 0), bar)
        # The text dark or white, whichever reads better on the band's middle
        band_colour = lerp(light, middle, 0.6)
        ink = max((colour, '#ffffff'), key=lambda c: contrast(rgb(c), band_colour))
        draw = ImageDraw.Draw(img)
        font = ImageFont.truetype(next(f for f in FONTS if os.path.exists(f)), round((bottom - top) * 0.78))
        draw.text((CX, (top + bottom) / 2), text, font=font, fill=rgb(ink), anchor='mm')

    return img.resize((W // SS, H // SS), Image.LANCZOS)


def tinted(colour, field=None):
    """
    The look of an award without a tier: the emblem's base in its colour (bright on top), the
    field dark in the same colour or in a colour of its own
    """
    return dict(art=(shade(colour, 1.45), colour),
                field=(shade(field, 1.0), shade(field, 0.45)) if field else (shade(colour, 0.22), '#0e1013'),
                glow=(colour, 85))


def build(args):
    scale = args.scale * {'classic': 1.0, 'bold': 0.93, 'thin': 1.06}[args.frame]
    emblem = load_emblem(args.emblem, *((0.8 * scale, 0.12 + args.lift) if args.kind == 'season' else (scale, args.lift)))
    out = {}
    style = dict(frame=args.frame, pattern=args.pattern, ribbon=args.ribbon or args.accent)
    free = dict(accent=args.accent, own=args.own_colors, **style)
    if args.kind == 'tier':
        for tier, look in TIER_LOOKS.items():
            out[f'{args.name}-{tier}'] = medal(emblem, tier, accent=args.accent, **style, **look)
    elif args.kind == 'limited' and args.solid:
        # An emblem in colour on black, as drawn and opaque; the frame, the pattern and the field
        # free, so the limited awards of a season differ from one another
        metal = args.metal or 'steel'
        field = (args.field, shade(args.field, 0.45)) if args.field else QUEST_FIELDS['steel']
        out[args.name] = medal(emblem, metal, line='double', own='solid', art=('#ffffff', '#ffffff'),
                               field=field, glow=None, **style)
    elif args.kind == 'limited':
        out[args.name] = medal(emblem, 'steel', line='double', **tinted(args.color, args.field), **free)
    elif args.kind == 'quest' and args.solid:
        # An emblem in colour on black, as drawn and opaque, in the quests' own metal
        metal = args.metal or 'titanium'
        field = (args.field, shade(args.field, 0.45)) if args.field else QUEST_FIELDS[metal]
        out[args.name] = medal(emblem, metal, line='dashed', own='solid', art=('#ffffff', '#ffffff'),
                               field=field, glow=None, **style)
    elif args.kind == 'quest':
        out[args.name] = medal(emblem, args.metal or 'steel', line='dashed',
                               **tinted(args.color or QUEST_COLOR, args.field), **free)
    elif args.kind == 'season' and args.portrait:
        # A portrait standing on the band: the first place in colour, the second and the third in
        # two tones (--mono: white and green; without it the portrait's brightness), the
        # participant all white on steel
        top = CY + R * 0.52
        colour = load_emblem(args.emblem, args.scale, stand=top)
        mono = load_emblem(args.mono, args.scale, stand=top) if args.mono else dict(
            colour, base=colour['colours'].convert('L'), accent=Image.new('L', (W, H), 0),
            shape=colour['colours'].convert('L'))
        band = (args.year, '#16181c')
        out[f'{args.name}-1'] = medal(colour, 'gold', band=band, own='solid', **style, **TIER_LOOKS['gold'])
        # A large bust glows little: the glow of a small emblem becomes a halo around it
        for place, tier in (('2', 'silver'), ('3', 'bronze')):
            look = dict(TIER_LOOKS[tier], glow=PORTRAIT_GLOW if TIER_LOOKS[tier]['glow'] else None)
            out[f'{args.name}-{place}'] = medal(mono, tier, band=band, accent=args.accent, **style, **look)
        white = dict(mono, base=mono['shape'], accent=Image.new('L', (W, H), 0))
        look = dict(tinted(args.color or '#d8dee6', args.field or '#2a3140'), glow=None)
        out[f'{args.name}-participant'] = medal(white, 'steel', band=band, **look)
    elif args.kind == 'season':
        for place, tier in (('1', 'gold'), ('2', 'silver'), ('3', 'bronze')):
            out[f'{args.name}-{place}'] = medal(emblem, tier, band=(args.year, '#16181c'), accent=args.accent,
                                                **style, **TIER_LOOKS[tier])
        colour = args.color or SEASON_COLORS[args.theme]
        out[f'{args.name}-participant'] = medal(emblem, 'steel', band=(args.year, '#16181c'),
                                                **tinted(colour, args.field), **free)
    return out


def preview(images, path):
    """The medals on the light and the dark theme: full size, 60 and 40 px"""
    n = len(images)
    cell = 280
    sheet = Image.new('RGBA', (n * cell + 40 + n * 110, 700))
    for row, bg in enumerate([(255, 255, 255, 255), (24, 26, 30, 255)]):
        sheet.paste(Image.new('RGBA', (sheet.width, 350), bg), (0, row * 350))
        for i, im in enumerate(images):
            for size, x, y in ((300, 20 + i * cell, 25), (60, n * cell + 40 + i * 60, 145),
                               (40, n * cell + 40 + n * 60 + i * 50, 155)):
                s = im.resize((round(size * 0.866), size), Image.LANCZOS)
                sheet.paste(s, (x, y + row * 350), s)
    sheet.save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('kind', choices=['tier', 'limited', 'quest', 'season'])
    p.add_argument('emblem', help='a drawing on black: white base, pure green accent, or its own colours')
    p.add_argument('--name', required=True, help='the file name: the group slug, quest-<slug>, season-<year>-<theme>')
    p.add_argument('--color', help='the emblem colour of a limited award, a quest or a season participant')
    p.add_argument('--accent', help="the colour of the emblem's green parts: the group's colour, the same on every tier")
    p.add_argument('--field', help='the field colour of an award without a tier (by default a dark shade of --color)')
    p.add_argument('--own-colors', action='store_true', help='an award without a tier: the emblem as it was drawn')
    p.add_argument('--frame', choices=['classic', 'bold', 'thin'], default='classic',
                   help='classic: a bevelled rim; bold: a thick coloured ring (--ribbon); thin: one thin rim')
    p.add_argument('--ribbon', help='the colour of the bold ring (by default --accent)')
    p.add_argument('--pattern', choices=['none', 'rays', 'rings', 'hexes', 'honeycomb', 'stripes'], default='none',
                   help='a faint drawing of the field behind the emblem')
    p.add_argument('--scale', type=float, default=1.0, help='the emblem larger or smaller than usual')
    p.add_argument('--lift', type=float, default=0.0,
                   help='the emblem raised (or lowered, negative) by this share of the radius: centred by its box, a\n                        wide bottom looks low')
    p.add_argument('--solid', action='store_true',
                   help='a quest or a limited award: the emblem is a picture in colour on black, kept as drawn and opaque')
    p.add_argument('--metal', choices=sorted(METALS), help='a quest (titanium by default) or a limited award (steel by default): the metal of the rim')
    p.add_argument('--portrait', action='store_true',
                   help='a season: the emblem is a bust in colour standing on the band (the first place in colour)')
    p.add_argument('--mono', help='a season portrait: the same bust in white and green for the places 2, 3 and the participant')
    p.add_argument('--year', default='2027', help='the text on a season band: "2027" or "26/27"')
    p.add_argument('--theme', choices=['cold', 'warm'], default='cold', help='a season: its participant colour')
    p.add_argument('--out', default=os.path.join(HERE, 'out'))
    p.add_argument('--preview', action='store_true')
    args = p.parse_args()
    if args.kind == 'limited' and not args.color and not args.solid:
        p.error('a limited award needs --color')

    os.makedirs(args.out, exist_ok=True)
    images = build(args)
    for name, im in images.items():
        im.save(os.path.join(args.out, name + '.png'), optimize=True)
        print(os.path.join(args.out, name + '.png'))
    if args.preview:
        path = os.path.join(args.out, args.name + '-preview.png')
        preview(list(images.values()), path)
        print(path)


if __name__ == '__main__':
    main()
