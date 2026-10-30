# Yu-Gi-Oh! XYZ

Portal de la comunidad Yu-Gi-Oh! XYZ, publicado con GitHub Pages: torneos, banlist, reglas y tierlist. Los duelos se juegan en [YGO Omega](https://omega.duelistsunite.org/).

## Secciones

| Página | Qué contiene |
| --- | --- |
| `index.html` | Portada con accesos rápidos y vídeos tutoriales |
| `porfolio/torneos.html` | Brackets de cada torneo (se pueden ampliar y pasar con las flechas) |
| `porfolio/banlist.html` | Descarga de la banlist y listado con buscador de las cartas restringidas |
| `porfolio/reglas.html` | Reglas básicas del duelo |
| `porfolio/tierlist.html` | Tierlist con filtro por nivel y buscador |

Los filtros se pueden compartir con un enlace: por ejemplo `porfolio/tierlist.html#grade1` o `porfolio/banlist.html#limitadas`.

## Cómo actualizar el contenido

- **Banlist:** sustituye `banlist/Untitled Banlist.lflist.conf` por la nueva exportación. La página la lee automáticamente, no hace falta tocar el HTML.
- **Nuevo torneo:** sube la imagen a `torneos/` y añade un bloque `<figure>` en `porfolio/torneos.html`.
- **Tierlist:** sube la imagen a `tierlist/` y añade
  `<figure><img src="../tierlist/archivo.png" alt="Nombre" /><figcaption>Nombre</figcaption></figure>`
  dentro del nivel que corresponda en `porfolio/tierlist.html`.

## Probarlo en local

El listado de la banlist se carga con `fetch`, así que no funciona abriendo el archivo con doble clic. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python -m http.server 8000
```

y abre http://localhost:8000.
