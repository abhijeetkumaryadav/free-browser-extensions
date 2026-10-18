"""Generate NetCheck icons: gradient rounded square + white globe glyph."""
from PIL import Image, ImageDraw

SIZES = [16, 48, 128]
ACCENT_TOP = (20, 184, 166)     # #14b8a6
ACCENT_BOTTOM = (13, 105, 95)   # darker teal

def rounded_square(size, radius_ratio=0.24):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(ACCENT_TOP[0] + (ACCENT_BOTTOM[0] - ACCENT_TOP[0]) * t)
        g = int(ACCENT_TOP[1] + (ACCENT_BOTTOM[1] - ACCENT_TOP[1]) * t)
        b = int(ACCENT_TOP[2] + (ACCENT_BOTTOM[2] - ACCENT_TOP[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size, size], radius=int(size * radius_ratio), fill=255)
    img.putalpha(mask)
    return img

def draw_globe(draw, size):
    """Stroke-style globe: circle + equator + meridian, white."""
    s = size / 128.0
    w = max(2, int(9 * s))
    cx, cy, r = size / 2, size / 2, int(40 * s)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                 outline=(255, 255, 255, 255), width=w)
    # equator
    draw.line([cx - r, cy, cx + r, cy], fill=(255, 255, 255, 255), width=w)
    # meridian ellipse
    draw.ellipse([cx - int(18 * s), cy - r, cx + int(18 * s), cy + r],
                 outline=(255, 255, 255, 255), width=w)

for size in SIZES:
    img = rounded_square(size)
    draw = ImageDraw.Draw(img)
    draw_globe(draw, size)
    img.save(f"icons/icon{size}.png")
    print(f"icons/icon{size}.png written ({img.size})")
