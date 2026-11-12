# -*- coding: utf-8 -*-
"""Pipeline de assets de Yu-Gi-Oh! XYZ.

- Convierte los PNG de torneos/ y tierlist/ a WebP (mismo nombre, extensión .webp)
  y elimina el PNG original (queda en el historial de git).
- Descarga y optimiza la imagen de fondo del hero y los miniatures de YouTube.
- Genera iconos PWA (192/512/180 + maskable) y la imagen OG (1200x630).

Uso:  py -3 scripts/build_assets.py
"""
import os
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "img")
os.makedirs(IMG_DIR, exist_ok=True)

# ---------------------------------------------------------------- utilidades

def fetch(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=90).read()
    with open(path, "wb") as f:
        f.write(data)
    return data


def save_webp(img, path, quality, max_width=None):
    if max_width and img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
    img = img.convert("RGB")
    img.save(path, "WEBP", quality=quality, method=4)
    print(f"  -> {os.path.basename(path)}  {img.width}x{img.height}  "
          f"{os.path.getsize(path) / 1024:.0f} KB")


# ---------------------------------------------------------------- PNG -> WebP

print("== torneos ==")
for name in sorted(os.listdir(os.path.join(ROOT, "torneos"))):
    if name.lower().endswith(".png"):
        src = os.path.join(ROOT, "torneos", name)
        dst = os.path.splitext(src)[0] + ".webp"
        img = Image.open(src)
        save_webp(img, dst, quality=80, max_width=1920)
        os.remove(src)

print("== tierlist ==")
# Huérfanos: no se referencian desde ningún HTML, se eliminan
orphanes = [
    os.path.join(ROOT, "tierlist", "tierlist.png"),
    os.path.join(ROOT, "tierlist", "zane.png.jpg"),
]
for p in orphanes:
    if os.path.exists(p):
        os.remove(p)
        print(f"  x eliminado huérfano {os.path.basename(p)}")

for name in sorted(os.listdir(os.path.join(ROOT, "tierlist"))):
    if name.lower().endswith(".png"):
        src = os.path.join(ROOT, "tierlist", name)
        dst = os.path.splitext(src)[0] + ".webp"
        img = Image.open(src)
        save_webp(img, dst, quality=78, max_width=1024)
        os.remove(src)

# ---------------------------------------------------------------- hero local

print("== hero ==")
# El fondo del hero es un SVG local (img/hero.svg): sin dependencias externas.
hero_path = os.path.join(IMG_DIR, "hero.svg")
if not os.path.exists(hero_path):
    print("  ! falta img/hero.svg")
else:
    print(f"  ok hero.svg ({os.path.getsize(hero_path) / 1024:.1f} KB)")

# ---------------------------------------------------------------- YT thumbs

print("== miniaturas YouTube ==")
yt_ids = ["NyfbetvDGgA", "q0q90zCd6gE", "-LnD1uxP7EA"]
for i, vid in enumerate(yt_ids, start=1):
    dst = os.path.join(IMG_DIR, f"video-{i}.jpg")
    if not os.path.exists(dst):
        fetch(f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg", dst)
    img = Image.open(dst).convert("RGB")
    if img.width > 960:
        img = img.resize((960, int(img.height * 960 / img.width)), Image.LANCZOS)
    img.save(dst, "JPEG", quality=82, optimize=True)
    print(f"  -> video-{i}.jpg  {img.width}x{img.height}  "
          f"{os.path.getsize(dst) / 1024:.0f} KB")

# ---------------------------------------------------------------- iconos PWA

FONT = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", "arialbd.ttf")

GOLD = (245, 184, 0)
BG = (17, 17, 17)
CIRCLE = (22, 22, 22)


def make_icon(size, path, scale=1.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # fondo redondeado
    r = int(size * 0.215)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    cx, cy = size / 2, size / 2
    radius = size * 0.375 * scale
    # círculo interior + anillo dorado
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=CIRCLE)
    stroke = max(2, int(size * 0.03))
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              outline=GOLD, width=stroke)
    # texto XYZ
    font = ImageFont.truetype(FONT, int(size * 0.26 * scale))
    bbox = d.textbbox((0, 0), "XYZ", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), "XYZ",
           font=font, fill=GOLD)
    img.save(path, "PNG", optimize=True)
    print(f"  -> {os.path.basename(path)}  {size}x{size}")


print("== iconos ==")
make_icon(512, os.path.join(IMG_DIR, "icon-512.png"))
make_icon(192, os.path.join(IMG_DIR, "icon-192.png"))
make_icon(180, os.path.join(IMG_DIR, "apple-touch-icon.png"))
make_icon(512, os.path.join(IMG_DIR, "icon-maskable-512.png"), scale=0.82)

# ---------------------------------------------------------------- imagen OG

print("== imagen OG ==")
og_path = os.path.join(IMG_DIR, "og-image.png")
W, H = 1200, 630
og = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(og)
# brillos de color como en el sitio
for (px, py, color) in [(300, 120, (255, 77, 143)), (900, 520, (123, 101, 255))]:
    rad = 420
    for i in range(rad, 0, -8):
        a = int(26 * (1 - i / rad))
        c = tuple(min(255, BG[k] + int(color[k] * a / 100)) for k in range(3))
        d.ellipse([px - i, py - i, px + i, py + i], fill=c)
# anillo dorado decorativo
d.ellipse([W / 2 - 300, H / 2 - 300, W / 2 + 300, H / 2 + 300],
          outline=GOLD, width=4)
title_font = ImageFont.truetype(FONT, 118)
sub_font = ImageFont.truetype(FONT, 34)
title = "Yu-Gi-Oh! XYZ"
bbox = d.textbbox((0, 0), title, font=title_font)
tw = bbox[2] - bbox[0]
d.text(((W - tw) / 2 - bbox[0], H / 2 - 120), title, font=title_font, fill=GOLD)
sub = "Torneos · Banlist · Reglas · Tierlist"
bbox = d.textbbox((0, 0), sub, font=sub_font)
sw = bbox[2] - bbox[0]
d.text(((W - sw) / 2 - bbox[0], H / 2 + 60), sub, font=sub_font,
       fill=(191, 193, 209))
og.save(og_path, "PNG", optimize=True)
print(f"  -> og-image.png  {W}x{H}  {os.path.getsize(og_path) / 1024:.0f} KB")

print("OK")
