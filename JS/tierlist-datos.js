/* Acceso a la tierlist (datos/tierlist.js) para todas las páginas.
   Si el organizador activa "Ver la web con mis cambios" en el panel, se usa su
   borrador y las imágenes nuevas que aún no se han publicado. No depende de
   ningún otro script. */
const TIERLIST_XYZ = (() => {
    const BORRADOR_KEY = 'xyz-tierlist-borrador';
    const IMAGENES_KEY = 'xyz-imagenes-pendientes';
    const USAR_KEY = 'xyz-usar-borrador';
    const base = location.pathname.includes('/porfolio/') ? '../' : './';

    function leer(clave, defecto) {
        try {
            const v = localStorage.getItem(clave);
            return v === null ? defecto : JSON.parse(v);
        } catch {
            return defecto;
        }
    }

    const vacio = { niveles: [], decks: [] };

    function publicados() {
        return window.TIERLIST_DATOS || vacio;
    }

    function borrador() {
        return leer(BORRADOR_KEY, null);
    }

    function usandoBorrador() {
        return !!leer(USAR_KEY, false) && !!borrador();
    }

    function datos() {
        return usandoBorrador() ? borrador() : publicados();
    }

    function imagenesPendientes() {
        return leer(IMAGENES_KEY, {});
    }

    // Ruta de la imagen; las subidas desde el panel que aún no están publicadas van en base64
    function src(deck) {
        const pendientes = usandoBorrador() ? imagenesPendientes() : {};
        return pendientes[deck.imagen] || `${base}tierlist/${deck.imagen}`;
    }

    function porNombre() {
        const d = datos();
        const nombres = new Map(d.niveles.map(n => [n.id, n.nombre]));
        return new Map(d.decks.map(k => [k.nombre, { ...k, nivelNombre: nombres.get(k.nivel) || k.nivel, src: src(k) }]));
    }

    // Convierte el texto de datos/tierlist.js en objeto (para el panel)
    function parsear(texto) {
        const json = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
        return JSON.parse(json);
    }

    function serializar(d) {
        return [
            '/* Tierlist de Yu-Gi-Oh! XYZ. Se edita desde porfolio/editor.html (pestaña Tierlist).',
            '   Cada deck: nombre, imagen (archivo en tierlist/), nivel (id de "niveles"), ancho y alto. */',
            'window.TIERLIST_DATOS = {',
            '  "niveles": [',
            d.niveles.map(n => `    ${JSON.stringify(n)}`).join(',\n'),
            '  ],',
            '  "decks": [',
            d.decks.map(k => `    ${JSON.stringify({ nombre: k.nombre, imagen: k.imagen, nivel: k.nivel, ancho: k.ancho, alto: k.alto })}`).join(',\n'),
            '  ]',
            '};',
            '',
        ].join('\n');
    }

    return {
        datos, publicados, borrador, usandoBorrador, imagenesPendientes, src, porNombre, parsear, serializar,
        BORRADOR_KEY, IMAGENES_KEY, USAR_KEY,
    };
})();
