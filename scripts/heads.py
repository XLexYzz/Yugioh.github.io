# -*- coding: utf-8 -*-
"""Inyecta en todas las páginas:
- head: canonical/OG/twitter, manifest, apple-touch-icon
- skip-link + id en <main>
- entrada de menú "Herramientas"
Uso: py -3 scripts/heads.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_URL = "https://xlexyzz.github.io/Yugioh.github.io"

# rel: (raíz de assets, href de herramientas, canonical)
PAGES = {
    "index.html": ("./", "./porfolio/herramientas.html", BASE_URL + "/"),
    "404.html": ("./", "./porfolio/herramientas.html", None),
    "porfolio/torneos.html": ("../", "./herramientas.html", BASE_URL + "/porfolio/torneos.html"),
    "porfolio/banlist.html": ("../", "./herramientas.html", BASE_URL + "/porfolio/banlist.html"),
    "porfolio/reglas.html": ("../", "./herramientas.html", BASE_URL + "/porfolio/reglas.html"),
    "porfolio/tierlist.html": ("../", "./herramientas.html", BASE_URL + "/porfolio/tierlist.html"),
    "porfolio/herramientas.html": ("../", "./herramientas.html", BASE_URL + "/porfolio/herramientas.html"),
}


def head_block(assets_root, canonical):
    if canonical is None:
        return (
            f'    <link rel="manifest" href="{assets_root}manifest.webmanifest" />\n'
            f'    <link rel="apple-touch-icon" href="{assets_root}img/apple-touch-icon.png" />\n'
        )
    return (
        f'    <meta property="og:url" content="{canonical}" />\n'
        f'    <meta property="og:image" content="{BASE_URL}/img/og-image.png" />\n'
        f'    <meta property="og:site_name" content="Yu-Gi-Oh! XYZ" />\n'
        f'    <meta property="og:locale" content="es_ES" />\n'
        f'    <meta name="twitter:card" content="summary" />\n'
        f'    <link rel="canonical" href="{canonical}" />\n'
        f'    <link rel="manifest" href="{assets_root}manifest.webmanifest" />\n'
        f'    <link rel="apple-touch-icon" href="{assets_root}img/apple-touch-icon.png" />\n'
    )


for rel, (assets_root, herr_href, canonical) in PAGES.items():
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        print(f"  x falta {rel}")
        continue
    with open(path, encoding="utf-8") as f:
        html = f.read()

    # 1) head: insertar tras la línea theme-color
    marker = re.search(r'<meta name="theme-color"[^>]*/>\n', html)
    if marker and "manifest" not in html:
        html = html[: marker.end()] + "\n" + head_block(assets_root, canonical) + html[marker.end():]
    # 2) skip link
    if "skip-link" not in html:
        html = html.replace(
            "<body>",
            '<body>\n<a class="skip-link" href="#contenido">Saltar al contenido</a>',
            1,
        )
    # 3) id en main
    if 'id="contenido"' not in html:
        html = html.replace("<main>", '<main id="contenido">', 1)
    # 4) menú: Herramientas tras Tierlist
    if "Herramientas" not in html:
        m = re.search(r'<a href="[^"]*tierlist\.html">Tierlist</a>', html)
        if m:
            html = html[: m.end()] + f'\n            <a href="{herr_href}">Herramientas</a>' + html[m.end():]
        else:
            print(f"  ! sin menú en {rel}")

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  ok {rel}")

print("OK")
