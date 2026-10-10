"""Generate app icons: build/icon.png (1024px) + build/icon.ico (multi-size)."""
from PIL import Image, ImageDraw
import os

S = 1024
OUT = os.path.join(os.path.dirname(__file__), "..", "build")
os.makedirs(OUT, exist_ok=True)

LIGHT = (0, 95, 184)
MID = (47, 161, 227)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
for i in range(S + S):
    t = min(1.0, i / (S + S))
    c = tuple(int(a + (b - a) * t) for a, b in zip(MID, LIGHT)) + (255,)
    gd.line([(i, 0), (i - S, S)], fill=c)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=200, fill=255)
img.paste(grad, (0, 0), mask)

d = ImageDraw.Draw(img)

lx, rx = 0.27 * S, 0.73 * S
ty, by = 0.18 * S, 0.84 * S
teeth = 5
step = (rx - lx) / (2 * teeth)
tooth_h = 0.045 * S
pts = [(lx, ty), (rx, ty), (rx, by)]
x, y = rx, by
for i in range(2 * teeth):
    x -= step
    y = by - tooth_h if i % 2 == 0 else by
    pts.append((x, y))
pts.append((lx, by))
pts.append((lx, ty))

d.polygon(pts, fill=(255, 255, 255, 255))

line_h = 0.035 * S
margin = 0.06 * S
rows = [
    (0.28 * S, lx + margin, rx - 0.18 * S),
    (0.40 * S, lx + margin, rx - margin),
    (0.52 * S, lx + margin, rx - 0.30 * S),
    (0.64 * S, lx + margin, rx - margin),
]
for y, a, b in rows:
    d.rounded_rectangle([a, y, b, y + line_h], radius=line_h / 2, fill=(0, 95, 184, 255))

cx, cy, r = 0.70 * S, 0.72 * S, 0.085 * S
d.ellipse([cx - r - 0.012 * S, cy - r - 0.012 * S, cx + r + 0.012 * S, cy + r + 0.012 * S],
          fill=(255, 255, 255, 255))
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 95, 184, 255))
d.line([(cx - 0.045 * S, cy + 0.005 * S), (cx - 0.012 * S, cy + 0.04 * S)],
       fill=(255, 255, 255, 255), width=int(0.022 * S))
d.line([(cx - 0.012 * S, cy + 0.04 * S), (cx + 0.05 * S, cy - 0.03 * S)],
       fill=(255, 255, 255, 255), width=int(0.022 * S))

img.save(os.path.join(OUT, "icon.png"))
img.save(os.path.join(OUT, "icon.ico"), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("wrote build/icon.png and build/icon.ico")
