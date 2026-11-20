# Yu-Gi-Oh! XYZ

Portal de la comunidad Yu-Gi-Oh! XYZ, publicado con GitHub Pages: torneos, banlist, reglas, tierlist y herramientas. Los duelos se juegan en [YGO Omega](https://omega.duelistsunite.org/).

Sitio público: <https://xlexyzz.github.io/Yugioh.github.io/>

## Secciones

| Página | Qué contiene |
| --- | --- |
| `index.html` | Portada con accesos rápidos y vídeos (se cargan al hacer clic) |
| `porfolio/torneos.html` | Cuadro interactivo de cada torneo (sigue el camino de un mazo al pasar el ratón) e imágenes originales |
| `porfolio/estadisticas.html` | Ranking de mazos (victorias, derrotas, % y títulos) y ficha con historial y rivales |
| `porfolio/editor.html` | Panel de organizadores: crear torneos, inscribir participantes, generar el cuadro, marcar resultados, añadir decks a la tierlist y publicar en GitHub |
| `porfolio/banlist.html` | Descarga de la banlist y listado con buscador de las cartas restringidas |
| `porfolio/reglas.html` | Reglas básicas, fases del turno paso a paso, mapa clicable del campo y test autocorregible |
| `porfolio/tierlist.html` | Tierlist con filtro y buscador, y **Crea tu tierlist** (arrastrar y soltar, se guarda y se descarga como PNG) |
| `porfolio/mazos.html` | **Validador de mazos**: pega un YDK o un enlace `ydke://` y comprueba la banlist XYZ, los límites de cada deck y la probabilidad de robo de cada carta |
| `porfolio/herramientas.html` | Contador de puntos de vida, temporizador, moneda y dado, y calculadora de probabilidad |

En todas las páginas, **Ctrl+K** (o `/`) abre un buscador de páginas, herramientas, decks y cartas de la banlist.

Los filtros se pueden compartir con un enlace: por ejemplo `porfolio/tierlist.html#grade1`, `porfolio/banlist.html#limitadas` o `porfolio/banlist.html?q=Nibiru`. Un mazo validado se comparte con el enlace `porfolio/mazos.html#ydke=…` que genera el botón "Copiar enlace al mazo".

## Cómo actualizar el contenido

Torneos, tierlist y banlist se gestionan desde **`porfolio/editor.html`** (Panel de organizadores, enlazado en el pie):

1. **Conectar GitHub (una vez):** crea un token *fine-grained* en GitHub con acceso solo a este
   repositorio y el permiso *Contents: Read and write*, y pégalo en la pestaña Publicar. Se guarda
   únicamente en ese navegador.
2. **Torneo nuevo:** Nuevo torneo → apunta a los participantes (jugador y mazo, o pega una lista) →
   genera el cuadro (sorteo u orden de la lista; pases directos si hace falta) → marca los ganadores
   según se juegan. La siguiente ronda se crea sola.
3. **Tierlist:** añade decks con su imagen (se convierte a WebP), cambia el nivel o el orden.
4. **Banlist:** sube el `.lflist.conf` nuevo (o pega su texto) y revisa qué cartas cambian antes de
   aplicarlo, o busca una carta por nombre o ID y elige Prohibida, Limitada, Semi-limitada o sin límite.
   La lista de "Cambios respecto a la publicada" permite deshacer carta a carta.
5. **Publicar:** sube todo en un único commit; la web se actualiza en uno o dos minutos.

Mientras no publiques, los cambios se guardan como borrador en el navegador y puedes ver la web con
ellos activando "Ver la web con mis cambios". Sin token, el panel descarga `datos/torneos.json`,
`datos/tierlist.js` y la banlist para subirlos a mano.

- **Banlist a mano:** sustituye `banlist/Untitled Banlist.lflist.conf` por la nueva exportación. La página y el botón de descarga leen siempre la última versión publicada (el service worker la pide a la red primero).
- **Bracket original de un torneo antiguo (opcional):** sube la imagen a `torneos/torneoN.webp`, añade un `<figure>` en "Imágenes originales" de `porfolio/torneos.html` y pon `"imagen": "torneoN.webp"` en ese torneo de `datos/torneos.json`.

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
