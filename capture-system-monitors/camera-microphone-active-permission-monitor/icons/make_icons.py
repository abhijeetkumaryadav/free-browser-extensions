"""Generate PrivWatch icons: gradient rounded square + white camera glyph."""
from PIL import Image, ImageDraw

SIZES = [16, 48, 128]
ACCENT_TOP = (239, 68, 68)      # #ef4444
ACCENT_BOTTOM = (153, 27, 27)   # darker red

def rounded_square(size, radius_ratio=0.24):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # vertical gradient
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(ACCENT_TOP[0] + (ACCENT_BOTTOM[0] - ACCENT_TOP[0]) * t)
        g = int(ACCENT_TOP[1] + (ACCENT_BOTTOM[1] - ACCENT_TOP[1]) * t)
        b = int(ACCENT_TOP[2] + (ACCENT_BOTTOM[2] - ACCENT_TOP[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    # rounded mask
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size, size], radius=int(size * radius_ratio), fill=255)
    img.putalpha(mask)
    return img

def draw_camera(draw, size):
    """Simple stroke-style video-camera glyph, white."""
    s = size / 128.0
    w = max(2, int(9 * s))  # stroke width
    # camera body
    x0, y0, x1, y1 = int(22 * s), int(44 * s), int(78 * s), int(88 * s)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=int(10 * s),
                           outline=(255, 255, 255, 255), width=w)
    # lens triangle
    lx = [x1, x1, int(106 * s)]
    ly = [int(52 * s), int(80 * s), int(66 * s)]
    draw.line([lx[0], ly[0], lx[2], ly[2]], fill=(255, 255, 255, 255), width=w)
    draw.line([lx[2], ly[2], lx[1], ly[1]], fill=(255, 255, 255, 255), width=w)

for size in SIZES:
    img = rounded_square(size)
    draw = ImageDraw.Draw(img)
    draw_camera(draw, size)
    img.save(f"icons/icon{size}.png")
    print(f"icons/icon{size}.png written ({img.size})")
