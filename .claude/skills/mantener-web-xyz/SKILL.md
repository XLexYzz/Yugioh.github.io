---
name: mantener-web-xyz
description: Mantener y ampliar la web de Yu-Gi-Oh! XYZ (GitHub Pages, HTML/CSS/JS sin build). Úsala para añadir un torneo o sus resultados, confirmar nombres de mazos, añadir un deck a la tierlist, actualizar la banlist, crear una página o herramienta nueva, tocar el diseño o el service worker, o probar la web antes de publicar.
---

# Mantener la web de Yu-Gi-Oh! XYZ

Web estática en español, sin framework ni paso de build. Todo lo que se sube a la rama
principal se publica en GitHub Pages.

## Mapa del proyecto

| Ruta | Qué es |
| --- | --- |
| `index.html`, `porfolio/*.html` | Páginas. Todas comparten cabecera, menú y pie |
| `estilos/styles.css` | Sistema base "Arena de torneo": tokens en `:root`, cabecera, secciones, tierlist, banlist, visor |
| `estilos/interactivo.css` | Componentes interactivos (paleta, mazos, LP, fases, campo, test, tiermaker) |
| `estilos/arena.css` | Portada, estadísticas, cuadros de torneo y editor |
| `datos/torneos.json` | Torneos: `estado` (inscripcion / en-juego / terminado), `inscritos` [{mazo, jugador}], `cuadro` (primera ronda, `null` = pase directo) y `partidas` `[ronda, mazoA, mazoB, ganador 0/1/null]` |
| `datos/tierlist.js` | Tierlist (`window.TIERLIST_DATOS`: niveles y decks con imagen, nivel, ancho y alto). La página la pinta `JS/tierlist-render.js` |
| `JS/script.js` | Base de todas las páginas: menú activo, visor, filtros, banlist, temporizador, SW |
| `JS/interactivo.js` | Global: objeto `XYZ` (banlist, `escapar`, `guardar`/`leer` en localStorage), paleta Ctrl+K, zoom del visor, vista previa de cartas, `?q=` |
| `JS/mazos.js` | Validador de mazos (YDK / ydke://) con la API de YGOPRODeck |
| `JS/herramientas.js` | Puntos de vida, moneda y dado, probabilidad hipergeométrica |
| `JS/reglas.js` | Fases del turno, mapa del campo, test (preguntas en `PREGUNTAS`) |
| `JS/tiermaker.js` | Crea tu tierlist (lee los decks de la propia tierlist) |
| `JS/torneos-datos.js` | Objeto `TORNEOS`: carga `datos/torneos.json` (o el borrador del editor) y calcula estadísticas por mazo; mapa nombre → imagen de la tierlist |
| `JS/torneos.js`, `JS/estadisticas.js`, `JS/inicio.js` | Cuadros interactivos, ranking/ficha de mazo y portada con datos reales |
| `JS/editor.js` + `estilos/panel.css` | `porfolio/editor.html`, panel de organizadores: torneos (inscripción, cuadro con pases directos, resultados), tierlist (añadir decks con imagen convertida a WebP, ordenar, cambiar nivel) y publicación |
| `JS/github.js` | Publica en el repositorio con la API de GitHub (un commit con todos los archivos) usando un token fine-grained guardado solo en el navegador del organizador |
| `JS/tierlist-datos.js` | Objeto `TIERLIST_XYZ`: tierlist publicada o borrador del panel, imágenes pendientes |
| `banlist/Untitled Banlist.lflist.conf` | Banlist XYZ; la leen la página de banlist, la paleta y el validador |
| `sw.js` | Service worker (offline) |
| `scripts/` | `check_refs.py` (enlaces rotos), `e2e.py` (pruebas Playwright), `build_assets.py` (PNG → WebP) |

Orden de scripts en cada página: `script.js` → `interactivo.js` → script propio de la página,
todos con `defer`. Los scripts de página usan funciones globales de los anteriores
(`rutaBase`, `normalizar`, `parseBanlist`, `mostrarToast`, `XYZ`).

## Tareas habituales

**Nuevo torneo (sin capturas).** Todo desde el panel `porfolio/editor.html`: Nuevo torneo →
apuntar participantes (jugador + mazo, o pegar una lista) → "Cerrar inscripción y generar cuadro"
(sorteo o en orden; si no son potencia de 2 hay pases directos) → marcar ganadores (la ronda
siguiente se crea sola) → Publicar. Publicar hace un commit en GitHub con el token del organizador;
sin token, se descargan los archivos y se suben a mano. La portada, la página de torneos y las
estadísticas muestran solas la inscripción, el cuadro en juego y el campeón.

**Nuevo deck en la tierlist.** Panel → pestaña Tierlist → nombre, nivel e imagen (se reduce a
1024 px y se convierte a WebP en el navegador) → Publicar sube la imagen a `tierlist/` y actualiza
`datos/tierlist.js`. Usa el mismo nombre que en los torneos para que salga su récord.

**Nombres por confirmar.** Los mazos que empiezan por `?` describen la ilustración del bracket. Se
corrigen en el editor (sección "Nombres por confirmar"), que cambia el nombre en todos los torneos.
Usa el mismo nombre que en la tierlist para que salga su imagen y su récord.

Si se añade un nivel nuevo a `datos/tierlist.js`, añádelo también a `PRESET` en `JS/tiermaker.js`.

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
- Diseño "Arena de torneo": fondo `--ink`, paneles `--stage`/`--stage-2`/`--stage-3`, líneas `--rule`.
  Oro `--gold` = victoria/acción principal, `--red` = derrota/prohibida, `--cyan` = interacción y foco.
  Colores de nivel `--tier-*`. Títulos y cifras en `var(--display)` (Big Shoulders Display, mayúsculas);
  texto en Barlow. Los títulos de sección llevan la línea de bracket (`.section-head h2::after`).
- Las imágenes de los decks se muestran enteras (alto fijo y ancho natural, u `object-fit: contain`).
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
