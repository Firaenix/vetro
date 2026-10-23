"""Icons for the dock's system entries (Source, Settings) and the inputs panel.

Samsung's own icons for these live inside the Home component and are not separate files,
so the dock draws them. Two families on purpose, so the shape says what the thing is:

  * apps and inputs  -> a solid rounded-square tile (dark gradient, accent glow, white glyph);
  * Source, Settings -> a round frosted control with a thin line glyph, no colour: a button
    of the TV itself, not a place to go.

Drawn at 4x and reduced, no assets.
"""
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

SIZE = 128            # design grid: every coordinate below is on this grid, drawn at SS x
import layout_consts
OUT = layout_consts.FOCUS_ICON   # final size, read from Layout.cs
SS = 4
CORNER = 29

# slug -> (label, target, fallback app or None, accent)
SYSTEM = {
    "source": ("Source", "panel:inputs", None, (90, 169, 255)),
    "settings": ("Settings", "sys:com.samsung.tv.csfs", None, (196, 204, 220)),
}


def _tile(accent):
    big = SIZE * SS
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=CORNER * SS, fill=255)
    base = Image.new("RGBA", (big, big))
    px = base.load()
    for y in range(big):
        t = y / (big - 1)
        r = int(44 - 24 * t); g = int(54 - 28 * t); b = int(82 - 38 * t)
        for x in range(big):
            px[x, y] = (r, g, b, 255)
    # soft accent glow from the top left, so each tile has a hint of its colour
    glow = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((-big * 0.25, -big * 0.55, big * 0.85, big * 0.45), fill=accent + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(big * 0.12))
    base = Image.alpha_composite(base, glow)
    # rim
    rim = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle((0, 0, big - 1, big - 1), radius=CORNER * SS, outline=(255, 255, 255, 64), width=2 * SS)
    base = Image.alpha_composite(base, rim)
    base.putalpha(ImageChops.multiply(base.getchannel("A"), mask))
    return base


STROKE = 7


def _line(d, pts, c, w=STROKE):
    """Polyline with round caps and joins (Pillow's `width` leaves square ends)."""
    s = SS
    r = w * s / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d.line((x0 * s, y0 * s, x1 * s, y1 * s), fill=c, width=int(w * s))
    for x, y in pts:
        d.ellipse((x * s - r, y * s - r, x * s + r, y * s + r), fill=c)


def _arc(cx, cy, r, a0, a1, n=10):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def _glyph_source(d, c, acc):
    # "input": a frame open on the left with an arrow entering it
    x0, x1, y0, y1, r = 58, 98, 34, 94, 9
    frame = [(x0, y0), (x1 - r, y0)] + _arc(x1 - r, y0 + r, r, -90, 0) + [(x1, y1 - r)] + _arc(x1 - r, y1 - r, r, 0, 90) + [(x0, y1)]
    _line(d, frame, c)
    _line(d, [(24, 64), (76, 64)], c)
    _line(d, [(60, 48), (76, 64), (60, 80)], c)


def _glyph_settings(d, c, acc):
    s = SS
    cx, cy = 64 * s, 64 * s
    d.ellipse((cx - 25 * s, cy - 25 * s, cx + 25 * s, cy + 25 * s), fill=c)
    for i in range(8):                      # eight regular teeth, each a short wide bar
        a = math.pi * 2 * i / 8
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        r0, r1, hw0, hw1 = 21 * s, 37 * s, 8 * s, 6 * s
        d.polygon([(cx + ux * r0 + px * hw0, cy + uy * r0 + py * hw0), (cx + ux * r1 + px * hw1, cy + uy * r1 + py * hw1),
                   (cx + ux * r1 - px * hw1, cy + uy * r1 - py * hw1), (cx + ux * r0 - px * hw0, cy + uy * r0 - py * hw0)], fill=c)
    return ("hole", cx, cy, 12 * s, None)


GLYPH_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "glyphs")


def _phosphor(name, box):
    """White Phosphor glyph (MIT, see glyphs/LICENSE-phosphor.txt) fitted into a box of `box` px (at 128 scale)
    and centred on its drawn extent rather than its 256 grid, so every icon sits optically in the middle."""
    def draw(d, c, acc):
        g = Image.open(os.path.join(GLYPH_DIR, name + ".png")).convert("RGBA")
        g = g.crop(g.getchannel("A").getbbox())
        side = box * SS
        k = min(side / g.width, side / g.height)
        g = g.resize((max(1, round(g.width * k)), max(1, round(g.height * k))), Image.LANCZOS)
        layer = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
        layer.alpha_composite(g, ((SIZE * SS - g.width) // 2, (SIZE * SS - g.height) // 2))
        return ("image", layer)
    return draw


# The line glyphs above stay as a fallback; the shipped look uses Phosphor bold so all three share one hand.
GLYPHS = {"source": _phosphor("sign-in-bold", 58), "settings": _phosphor("gear-six-bold", 62)}


# The inputs panel: slug -> (label, Samsung SourceType, accent). TV is 0, HDMI 1-4 are 13-16.
INPUTS = {
    "in-tv": ("TV", 0, (120, 214, 160)),
    "in-hdmi1": ("HDMI 1", 13, (90, 169, 255)),
    "in-hdmi2": ("HDMI 2", 14, (90, 169, 255)),
    "in-hdmi3": ("HDMI 3", 15, (90, 169, 255)),
    "in-hdmi4": ("HDMI 4", 16, (90, 169, 255)),
}


def _font(size):
    for path in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/SFNS.ttf", "/Library/Fonts/Arial Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default(size)


def _glyph_tv(d, c, acc):
    s = SS
    d.rounded_rectangle((24 * s, 30 * s, 104 * s, 86 * s), radius=9 * s, outline=c, width=7 * s)
    d.line((48 * s, 100 * s, 80 * s, 100 * s), fill=c, width=7 * s)
    d.line((64 * s, 86 * s, 64 * s, 100 * s), fill=c, width=7 * s)
    d.polygon([(55 * s, 47 * s), (55 * s, 69 * s), (75 * s, 58 * s)], fill=acc)


NUMBERS = {1: "number-one-bold", 2: "number-two-bold", 3: "number-three-bold", 4: "number-four-bold"}


def _hdmi_glyph(number):
    """HDMI port in the same round, heavy line as the Phosphor glyphs, with the port number (Phosphor bold) under it."""
    digit = _phosphor(NUMBERS[number], 40)

    def draw(d, c, acc):
        # the port: wide at the top, narrowing to a flat bottom, as on the connector itself
        port = [(28, 22), (100, 22), (100, 40), (89, 52), (39, 52), (28, 40), (28, 22)]
        _line(d, port, c, 7)
        for x in (50, 64, 78):
            _line(d, [(x, 31), (x, 40)], c, 5)
        kind, layer = digit(d, c, acc)
        layer = layer.transform(layer.size, Image.AFFINE, (1, 0, 0, 0, 1, -22 * SS))   # move the centred digit down, under the port
        return ("overlay", layer)
    return draw


def render_input(slug, path):
    accent = INPUTS[slug][2]
    glyph = _phosphor("television-simple-bold", 66) if slug == "in-tv" else _hdmi_glyph(int(slug[-1]))
    _render(accent, glyph, path)


def _control():
    """Round frosted button: translucent white over whatever the dock glass shows, a soft light at the
    top left and a bright thin rim. It deliberately has no hue of its own."""
    big = SIZE * SS
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    px = base.load()
    for y in range(big):
        a = int(46 - 24 * y / (big - 1))
        for x in range(big):
            px[x, y] = (214, 224, 244, a)
    light = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(light).ellipse((-big * 0.1, -big * 0.35, big * 0.75, big * 0.45), fill=(255, 255, 255, 52))
    light = light.filter(ImageFilter.GaussianBlur(big * 0.08))
    base = Image.alpha_composite(base, light)
    rim = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(rim).ellipse((0, 0, big - 1, big - 1), outline=(255, 255, 255, 110), width=2 * SS)
    base = Image.alpha_composite(base, rim)
    base.putalpha(ImageChops.multiply(base.getchannel("A"), mask))
    return base


def render(slug, path):
    _render(None, GLYPHS[slug], path, round_control=True)


def _render(accent, glyph, path, round_control=False):
    tile = _control() if round_control else _tile(accent)
    layer = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    extra = glyph(d, (255, 255, 255, 245), accent + (255,) if accent else None)
    if extra and extra[0] == "image":
        layer = extra[1]
        extra = None
    elif extra and extra[0] == "overlay":
        layer.alpha_composite(extra[1])
        extra = None
    if extra and extra[0] == "hole":      # punch the gear's centre and fill it with the accent
        _, cx, cy, r, acc = extra
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 0, 0, 0))
        hole = Image.new("L", layer.size, 0)
        ImageDraw.Draw(hole).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
        layer.paste((0, 0, 0, 0), mask=hole)
        d = ImageDraw.Draw(layer)
        if acc is not None:
            rr = r - 5 * SS
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=acc)
    # a soft shadow under the glyph lifts it off the tile
    shadow = layer.filter(ImageFilter.GaussianBlur(3 * SS))
    shadow = Image.merge("RGBA", (Image.new("L", tile.size, 0),) * 3 + (shadow.getchannel("A").point(lambda v: int(v * 0.45)),))
    out = Image.alpha_composite(tile, Image.alpha_composite(shadow, layer))
    out = out.resize((OUT, OUT), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path)


# Generic icons for the two live TV entries, used when the TV has no icon file for them
# (the registry's TV Plus icon path can be stale, and live TV has none): the TV glyph again.
LIVE = {"livetv": (120, 214, 160), "tvplus": (255, 170, 90)}


def render_live(slug, path):
    _render(LIVE[slug], _phosphor("television-simple-bold", 66), path)


def render_all(icons_dir):
    for slug in LIVE:
        render_live(slug, os.path.join(icons_dir, slug + ".png"))
    for slug in SYSTEM:
        render(slug, os.path.join(icons_dir, slug + ".png"))
    for slug in INPUTS:
        render_input(slug, os.path.join(icons_dir, slug + ".png"))


def inputs_tsv_rows():
    return ["\t".join([slug, label, "source:%d" % number]) for slug, (label, number, _) in INPUTS.items()]


def tsv_rows():
    rows = []
    for slug, (label, target, fallback, _) in SYSTEM.items():
        rows.append("\t".join([slug, label, target] + ([fallback] if fallback else [])))
    return rows
