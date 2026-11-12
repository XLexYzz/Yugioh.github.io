# Yu-Gi-Oh! XYZ

Portal de la comunidad Yu-Gi-Oh! XYZ, publicado con GitHub Pages: torneos, banlist, reglas, tierlist y herramientas. Los duelos se juegan en [YGO Omega](https://omega.duelistsunite.org/).

Sitio público: <https://xlexyzz.github.io/Yugioh.github.io/>

## Secciones

| Página | Qué contiene |
| --- | --- |
| `index.html` | Portada con accesos rápidos y vídeos (se cargan al hacer clic) |
| `porfolio/torneos.html` | Brackets de cada torneo (se pueden ampliar y pasar con las flechas) |
| `porfolio/banlist.html` | Descarga de la banlist y listado con buscador de las cartas restringidas |
| `porfolio/reglas.html` | Reglas básicas del duelo |
| `porfolio/tierlist.html` | Tierlist con filtro por nivel y buscador |
| `porfolio/herramientas.html` | Temporizador de duelo (10/15/20/30 min, aviso a 1 min) |

Los filtros se pueden compartir con un enlace: por ejemplo `porfolio/tierlist.html#grade1` o `porfolio/banlist.html#limitadas`.

## Cómo actualizar el contenido

- **Banlist:** sustituye `banlist/Untitled Banlist.lflist.conf` por la nueva exportación. La página la lee automáticamente, no hace falta tocar el HTML.
- **Nuevo torneo:** sube la imagen a `torneos/` como `torneoN.webp` (o conviértela, ver abajo) y añade un bloque `<figure>` en `porfolio/torneos.html` con `width`/`height` reales y `loading="lazy"` (la primera puede ser `loading="eager" fetchpriority="high"`).
- **Nuevo deck en la tierlist:** sube la imagen a `tierlist/` y añade
  `<figure><img src="../tierlist/archivo.webp" alt="Deck Nombre" width="W" height="H" loading="lazy" decoding="async" /><figcaption>Nombre</figcaption></figure>`
  dentro del nivel que corresponda en `porfolio/tierlist.html`.

### Imágenes: PNG → WebP

Todas las imágenes del sitio son **WebP** (≈ 90 % menos que los PNG originales). Para convertir una imagen nueva:

```bash
py -3 scripts/build_assets.py   # convierte torneos/*.png y tierlist/*.png a .webp
```

El script también descarga el fondo del hero (si falta), las miniaturas de los vídeos,
los iconos PWA y la imagen OG. Se puede repetir sin efectos secundarios: solo toca lo
que no sea `.webp`/`.jpg`.

## PWA y SEO

- `manifest.webmanifest` + iconos en `img/`: instalable como app y usable offline.
- `sw.js`: precachea la cáscara del sitio y revalida el resto en segundo plano.
  Al cambiar páginas/css/js, aumenta `SHELL_VERSION` para que se refresque la caché.
- `sitemap.xml` y `robots.txt` apuntan a `https://xlexyzz.github.io/Yugioh.github.io/`.
- Cada página tiene `canonical`, Open Graph y `og:image` (`img/og-image.png`).

## Probarlo en local

El listado de la banlist se carga con `fetch` y el service worker necesita servidor,
así que no funciona abriendo los archivos con doble clic. Sirve la carpeta con
cualquier servidor estático, por ejemplo:

```bash
py -3 -m http.server 8000
```

y abre http://localhost:8000.
