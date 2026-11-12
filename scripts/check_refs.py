# -*- coding: utf-8 -*-
"""Comprueba que todas las referencias de assets de los HTML existen."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = True

for dirpath, _, files in os.walk(ROOT):
    if ".git" in dirpath:
        continue
    for fname in files:
        if not fname.endswith(".html"):
            continue
        path = os.path.join(dirpath, fname)
        html = open(path, encoding="utf-8").read()
        refs = re.findall(r'(?:src|href)="([^"]+)"', html)
        for ref in refs:
            if ref.startswith("http") or ref.startswith("#") or ref.startswith("data:") or ref.startswith("mailto:"):
                continue
            target = os.path.normpath(os.path.join(dirpath, ref.split("#")[0].split("?")[0]))
            if not os.path.exists(target):
                print(f"  FALTA: {os.path.relpath(path, ROOT)} -> {ref}")
                ok = False
        # .png sobrantes
        leftover = re.findall(r'\.\./(torneos|tierlist)/[^\s"]+\.png', html)
        if leftover:
            print(f"  PNG sin convertir en {os.path.relpath(path, ROOT)}: {leftover}")
            ok = False

# imágenes de la página de herramientas/video
for f in ["img/video-1.jpg", "img/video-2.jpg", "img/video-3.jpg",
          "img/hero.svg", "img/og-image.png", "img/icon-192.png",
          "img/icon-512.png", "img/icon-maskable-512.png",
          "img/apple-touch-icon.png", "manifest.webmanifest",
          "sw.js", "sitemap.xml", "robots.txt"]:
    if not os.path.exists(os.path.join(ROOT, f)):
        print(f"  FALTA: {f}")
        ok = False

print("OK" if ok else "ERRORES")
