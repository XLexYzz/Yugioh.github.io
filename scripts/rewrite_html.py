# -*- coding: utf-8 -*-
"""Reescribe torneos.html y tierlist.html:
- src .png -> .webp
- añade width/height reales (evita CLS)
- loading="lazy" en todas las imgs excepto la primera (eager + fetchpriority)
Uso: py -3 scripts/rewrite_html.py
"""
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

IMG_RE = re.compile(
    r'<img src="\.\./(?P<dir>torneos|tierlist)/(?P<name>[^"]+)\.png" '
    r'alt="(?P<alt>[^"]*)"\s*/>'
)


def process(page):
    path = os.path.join(ROOT, "porfolio", page)
    with open(path, encoding="utf-8") as f:
        html = f.read()

    state = {"first": True}
    count = 0

    def repl(m):
        nonlocal count
        webp = os.path.join(ROOT, m.group("dir"), m.group("name") + ".webp")
        w, h = Image.open(webp).size
        alt = m.group("alt")
        # Los torneos son brackets: el alt debe decirlo para lectores de pantalla
        if m.group("dir") == "torneos" and m.group("name").startswith("torneo"):
            alt = f"Bracket del {alt}"
        elif m.group("dir") == "tierlist":
            alt = f"Deck {alt}"
        loading = (
            'loading="eager" fetchpriority="high"'
            if state["first"]
            else "loading=\"lazy\""
        )
        state["first"] = False
        count += 1
        return (
            f'<img src="../{m.group("dir")}/{m.group("name")}.webp" '
            f'alt="{alt}" width="{w}" height="{h}" '
            f'decoding="async" {loading} />'
        )

    html = IMG_RE.sub(repl, html)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  ok {page} ({count} imgs)")


print("== reescritura ==")
process("torneos.html")
process("tierlist.html")
print("OK")
