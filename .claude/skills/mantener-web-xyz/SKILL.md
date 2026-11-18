---
name: mantener-web-xyz
description: Mantener y ampliar la web de Yu-Gi-Oh! XYZ (GitHub Pages, HTML/CSS/JS sin build). Úsala para añadir un torneo, un deck a la tierlist, actualizar la banlist, crear una página o herramienta nueva, tocar el service worker o probar la web antes de publicar.
---

# Mantener la web de Yu-Gi-Oh! XYZ

Web estática en español, sin framework ni paso de build. Todo lo que se sube a la rama
principal se publica en GitHub Pages.

## Mapa del proyecto

| Ruta | Qué es |
| --- | --- |
| `index.html`, `porfolio/*.html` | Páginas. Todas comparten cabecera, menú y pie |
| `estilos/styles.css` | Estilos base (tokens en `:root`, tarjetas, tierlist, banlist, visor) |
| `estilos/interactivo.css` | Componentes interactivos (paleta, mazos, LP, fases, campo, test, tiermaker) |
| `JS/script.js` | Base de todas las páginas: menú activo, visor, filtros, banlist, temporizador, SW |
| `JS/interactivo.js` | Global: objeto `XYZ` (banlist, `escapar`, `guardar`/`leer` en localStorage), paleta Ctrl+K, zoom del visor, vista previa de cartas, `?q=` |
| `JS/mazos.js` | Validador de mazos (YDK / ydke://) con la API de YGOPRODeck |
| `JS/herramientas.js` | Puntos de vida, moneda y dado, probabilidad hipergeométrica |
| `JS/reglas.js` | Fases del turno, mapa del campo, test (preguntas en `PREGUNTAS`) |
| `JS/tiermaker.js` | Crea tu tierlist (lee los decks de la propia tierlist) |
| `banlist/Untitled Banlist.lflist.conf` | Banlist XYZ; la leen la página de banlist, la paleta y el validador |
| `sw.js` | Service worker (offline) |
| `scripts/` | `check_refs.py` (enlaces rotos), `e2e.py` (pruebas Playwright), `build_assets.py` (PNG → WebP) |

Orden de scripts en cada página: `script.js` → `interactivo.js` → script propio de la página,
todos con `defer`. Los scripts de página usan funciones globales de los anteriores
(`rutaBase`, `normalizar`, `parseBanlist`, `mostrarToast`, `XYZ`).

## Tareas habituales

**Nuevo torneo.** Imagen en `torneos/torneoN.webp` (convierte con `py -3 scripts/build_assets.py`)
y un `<figure>` en `porfolio/torneos.html` con `width`/`height` reales y `loading="lazy"`.

**Nuevo deck en la tierlist.** Imagen WebP en `tierlist/` y un `<figure>` dentro del nivel que toque
en `porfolio/tierlist.html`. La paleta de búsqueda y "Crea tu tierlist" lo recogen solos.
Si añades un nivel nuevo, añádelo también a `PRESET` en `JS/tiermaker.js`.

**Banlist.** Sustituye el `.lflist.conf`. No hay que tocar código. Formato de línea:
`<id> <copias> --<nombre>` (0 prohibida, 1 limitada, 2 semi-limitada).

**Página nueva.** Copia la cabecera de una página de `porfolio/` (fuentes, canonical, OG,
manifest, los dos CSS y los scripts). Añade el enlace al menú de **todas** las páginas,
la entrada a `estaticos` en `setupCommandPalette` (`JS/interactivo.js`), la URL a `sitemap.xml`
y el archivo a `SHELL` en `sw.js`.

**Después de cambiar HTML, CSS o JS:** sube `SHELL_VERSION` en `sw.js` (v3 → v4…) para que
los visitantes reciban la versión nueva.

## Convenciones

- Textos en español, en tono directo y con mayúscula solo al principio. Los botones dicen lo que hacen
  ("Descargar imagen", no "Enviar").
- Colores: usa las variables (`--gold`, `--violet`, `--ruby`, `--amber`, `--sky`, `--jade`,
  `--panel`, `--muted`). Números grandes con `var(--num)` (Barlow Condensed).
- Todo debe funcionar en móvil (390 px) sin scroll horizontal, con foco visible y respetando
  `prefers-reduced-motion`.
- Guarda estado del usuario con `XYZ.guardar` / `XYZ.leer` (ya capturan errores de localStorage).
- Escapa siempre con `XYZ.escapar` lo que venga del usuario o de la API antes de meterlo en `innerHTML`.
- Los archivos existentes usan CRLF y algunos BOM: al editarlos por script, conserva ambos.
- API de cartas: `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=…` (máx. 20 peticiones/s;
  `mazos.js` agrupa de 40 en 40 y cachea en localStorage). Las imágenes de
  `images.ygoprodeck.com` las cachea el service worker para no pedirlas de nuevo.

## Antes de publicar

```bash
py -3 scripts/check_refs.py
py -3 -m http.server 8765        # en otra terminal
py -3 scripts/e2e.py
```

`e2e.py` recorre todas las páginas en escritorio y móvil, prueba cada herramienta y falla si
hay errores de consola. Revisa las capturas que deja en la carpeta que imprime.
