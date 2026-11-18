# Yu-Gi-Oh! XYZ

Portal de la comunidad Yu-Gi-Oh! XYZ, publicado con GitHub Pages: torneos, banlist, reglas, tierlist y herramientas. Los duelos se juegan en [YGO Omega](https://omega.duelistsunite.org/).

Sitio público: <https://xlexyzz.github.io/Yugioh.github.io/>

## Secciones

| Página | Qué contiene |
| --- | --- |
| `index.html` | Portada con accesos rápidos y vídeos (se cargan al hacer clic) |
| `porfolio/torneos.html` | Brackets de cada torneo (se pueden ampliar y pasar con las flechas) |
| `porfolio/banlist.html` | Descarga de la banlist y listado con buscador de las cartas restringidas |
| `porfolio/reglas.html` | Reglas básicas, fases del turno paso a paso, mapa clicable del campo y test autocorregible |
| `porfolio/tierlist.html` | Tierlist con filtro y buscador, y **Crea tu tierlist** (arrastrar y soltar, se guarda y se descarga como PNG) |
| `porfolio/mazos.html` | **Validador de mazos**: pega un YDK o un enlace `ydke://` y comprueba la banlist XYZ, los límites de cada deck y la probabilidad de robo de cada carta |
| `porfolio/herramientas.html` | Contador de puntos de vida, temporizador, moneda y dado, y calculadora de probabilidad |

En todas las páginas, **Ctrl+K** (o `/`) abre un buscador de páginas, herramientas, decks y cartas de la banlist.

Los filtros se pueden compartir con un enlace: por ejemplo `porfolio/tierlist.html#grade1`, `porfolio/banlist.html#limitadas` o `porfolio/banlist.html?q=Nibiru`. Un mazo validado se comparte con el enlace `porfolio/mazos.html#ydke=…` que genera el botón "Copiar enlace al mazo".

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

## Datos de cartas

El validador de mazos y las vistas previas de la banlist usan la API pública de
[YGOPRODeck](https://ygoprodeck.com/api-guide/). Los datos se guardan en el navegador y las
imágenes en la caché del service worker, para no repetir peticiones.

## Probarlo en local

El listado de la banlist se carga con `fetch` y el service worker necesita servidor,
así que no funciona abriendo los archivos con doble clic. Sirve la carpeta con
cualquier servidor estático, por ejemplo:

```bash
py -3 -m http.server 8000
```

y abre http://localhost:8000.

### Pruebas automáticas

Con el servidor en marcha en el puerto 8765:

```bash
py -3 scripts/check_refs.py
py -3 scripts/e2e.py
```

`e2e.py` (Playwright) recorre la web en escritorio y móvil y prueba cada herramienta.
Las instrucciones para mantener la web están en `.claude/skills/mantener-web-xyz/SKILL.md`.
