/* Datos de torneos y estadísticas por mazo (portada, torneos, estadísticas,
   tierlist y panel). Necesita script.js, interactivo.js y, para las imágenes de
   los mazos, datos/tierlist.js + tierlist-datos.js.

   Formato de datos/torneos.json:
     { torneos: [{
         id, nombre, fecha?, estado?,             // estado: "inscripcion" | "en-juego" | "terminado" (por defecto)
         inscritos?: [{ mazo, jugador? }],        // participantes apuntados
         cuadro?: [[mazoA, mazoB|null], ...],     // primera ronda; null = pase directo
         imagen?,                                 // bracket original (torneos antiguos)
         partidas: [[ronda, mazoA, mazoB, ganador 0|1|null], ...]
     }] }
   Los nombres que empiezan por "?" describen la ilustración y están por confirmar.
*/
const TORNEOS = (() => {
    const BORRADOR_KEY = 'xyz-torneos-borrador';
    const USAR_BORRADOR_KEY = 'xyz-usar-borrador';

    const dudoso = (n) => n.startsWith('?');
    const visible = (n) => (dudoso(n) ? n.slice(1) : n);
    const jugada = (p) => p[3] === 0 || p[3] === 1;

    let mapaTierlist = null;
    function tierlist() {
        if (!mapaTierlist) mapaTierlist = typeof TIERLIST_XYZ !== 'undefined' ? TIERLIST_XYZ.porNombre() : new Map();
        return mapaTierlist;
    }

    function infoMazo(n) {
        const t = tierlist().get(n);
        if (!t) return null;
        return { img: t.src, nivel: t.nivel, nivelNombre: t.nivelNombre, ancho: t.ancho, alto: t.alto };
    }

    function nombreRonda(r, total) {
        const d = total - r;
        return ['Final', 'Semifinales', 'Cuartos', 'Octavos', 'Dieciseisavos', 'Treintaidosavos'][d] || `Ronda ${r}`;
    }

    function resultadoTexto(rondaMax, total, campeon) {
        if (campeon) return 'Campeón';
        const d = total - rondaMax;
        return ['Finalista', 'Semifinales', 'Cuartos', 'Octavos', 'Dieciseisavos', 'Treintaidosavos'][d] || `Ronda ${rondaMax}`;
    }

    // Número de rondas que tendrá el torneo completo
    function rondasTotales(t) {
        if (t.cuadro?.length) return Math.max(1, Math.round(Math.log2(t.cuadro.length * 2)));
        return Math.max(1, ...t.partidas.map(p => p[0]));
    }

    function estado(t) {
        if (t.estado) return t.estado;
        return t.partidas.length ? 'terminado' : 'inscripcion';
    }

    /* ---------- Carga ---------- */
    let cache = null;

    function borrador() {
        return XYZ.leer(BORRADOR_KEY, null);
    }

    function usandoBorrador() {
        return !!XYZ.leer(USAR_BORRADOR_KEY, false) && !!borrador();
    }

    async function cargar() {
        if (cache) return cache;
        let datos = null;
        if (usandoBorrador()) datos = borrador();
        if (!datos) {
            const r = await fetch(`${rutaBase()}datos/torneos.json`);
            if (!r.ok) throw new Error(`No se han podido cargar los torneos (${r.status})`);
            datos = await r.json();
        }
        cache = calcular(datos);
        return cache;
    }

    /* ---------- Cálculo ---------- */
    function calcular(datos) {
        const mazos = new Map();
        const torneos = [];

        const mazo = (n) => {
            if (!mazos.has(n)) {
                mazos.set(n, {
                    nombre: n, visible: visible(n), dudoso: dudoso(n), info: infoMazo(n),
                    torneos: 0, participaciones: 0, partidas: 0, victorias: 0, derrotas: 0,
                    titulos: 0, finales: 0, semis: 0, mejor: { valor: -1000, texto: '' },
                    historial: [], rivales: new Map(),
                });
            }
            return mazos.get(n);
        };

        datos.torneos.forEach(t => {
            const est = estado(t);
            const total = rondasTotales(t);
            const final = t.partidas.find(p => p[0] === total && jugada(p));
            const terminado = est === 'terminado' && !!final;
            const campeon = terminado ? final[1 + final[3]] : null;
            const finalista = terminado ? final[2 - final[3]] : null;
            const porMazo = new Map();

            t.partidas.filter(jugada).forEach(([ronda, a, b, g]) => {
                [[a, b, g === 0], [b, a, g === 1]].forEach(([yo, rival, gano]) => {
                    const m = mazo(yo);
                    m.partidas++;
                    gano ? m.victorias++ : m.derrotas++;
                    const rv = m.rivales.get(rival) || { v: 0, d: 0 };
                    gano ? rv.v++ : rv.d++;
                    m.rivales.set(rival, rv);
                    const h = porMazo.get(yo) || { v: 0, d: 0, rondaMax: 0, eliminadoPor: null, entradas: 0 };
                    gano ? h.v++ : h.d++;
                    h.rondaMax = Math.max(h.rondaMax, ronda);
                    if (ronda === 1) h.entradas++;
                    if (!gano) h.eliminadoPor = rival;
                    porMazo.set(yo, h);
                });
            });

            porMazo.forEach((h, n) => {
                const m = mazo(n);
                const esCampeon = n === campeon;
                m.torneos++;
                m.participaciones += Math.max(1, h.entradas);
                if (esCampeon) m.titulos++;
                if (terminado && h.rondaMax === total) m.finales++;
                if (terminado && h.rondaMax >= total - 1) m.semis++;
                // En un torneo en juego, quien no ha perdido sigue vivo
                const sigue = !terminado && !h.eliminadoPor;
                const texto = sigue ? 'En juego' : resultadoTexto(h.rondaMax, total, esCampeon);
                const relativo = esCampeon ? 100 : 10 * (h.rondaMax - total);
                if (!sigue && relativo > m.mejor.valor) m.mejor = { valor: relativo, texto };
                m.historial.push({ torneo: t.id, nombre: t.nombre, texto, campeon: esCampeon, v: h.v, d: h.d, eliminadoPor: esCampeon || sigue ? null : h.eliminadoPor });
            });

            const inscritos = t.inscritos || [];
            torneos.push({
                ...t, estado: est, terminado, total, campeon, finalista, inscritos,
                jugadores: inscritos.length || t.partidas.filter(p => p[0] === 1).length * 2,
                pendientes: t.partidas.filter(p => !jugada(p)).length,
                rondas: Array.from({ length: Math.max(...t.partidas.map(p => p[0]), 0) }, (_, i) => ({
                    numero: i + 1, nombre: nombreRonda(i + 1, total),
                    partidas: t.partidas.filter(p => p[0] === i + 1),
                })),
            });
        });

        mazos.forEach(m => {
            m.porcentaje = m.partidas ? m.victorias / m.partidas : 0;
        });

        const terminados = torneos.filter(t => t.terminado);
        const totales = {
            torneos: terminados.length,
            partidas: torneos.reduce((s, t) => s + t.partidas.filter(jugada).length, 0),
            mazos: mazos.size,
            dudosos: [...mazos.values()].filter(m => m.dudoso).length,
        };

        return {
            torneos, terminados, mazos, totales, borrador: usandoBorrador(), datos,
            proximo: torneos.filter(t => !t.terminado).slice(-1)[0] || null,
            ultimo: terminados[terminados.length - 1] || null,
        };
    }

    /* ---------- Presentación ---------- */
    function avatar(n, clase = 'deck-avatar') {
        const info = infoMazo(n);
        if (info) return `<img class="${clase}" src="${info.img}" alt="" loading="lazy" decoding="async" />`;
        const ini = visible(n).replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
        return `<span class="${clase} deck-avatar-empty" aria-hidden="true">${XYZ.escapar(ini)}</span>`;
    }

    function etiqueta(n) {
        return `${XYZ.escapar(visible(n))}${dudoso(n) ? ' <span class="pending" title="Por confirmar: el nombre describe la ilustración">?</span>' : ''}`;
    }

    function enlaceMazo(n) {
        return `${rutaBase()}porfolio/estadisticas.html#mazo=${encodeURIComponent(n)}`;
    }

    const pct = (p) => `${Math.round(p * 100)} %`;

    function fechaTexto(f) {
        if (!f) return '';
        const d = new Date(`${f}T12:00:00`);
        return Number.isNaN(d.getTime()) ? f : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    // En la tierlist, cada deck muestra su récord en torneos
    function marcarTierlist() {
        const figs = document.querySelectorAll('.tierlist-grid figure');
        if (!figs.length) return;
        cargar().then(d => {
            figs.forEach(fig => {
                const cap = fig.querySelector('figcaption');
                const m = d.mazos.get(cap?.textContent.trim());
                if (!cap || !m || cap.querySelector('.deck-record')) return;
                const span = document.createElement('span');
                span.className = 'deck-record';
                span.title = `${m.victorias} victorias y ${m.derrotas} derrotas en ${m.torneos} torneos${m.titulos ? `, ${m.titulos} ${m.titulos === 1 ? 'título' : 'títulos'}` : ''}`;
                span.innerHTML = `<b>${m.victorias}</b>–${m.derrotas}${m.titulos ? ` <span class="trophy" aria-hidden="true">★${m.titulos > 1 ? m.titulos : ''}</span>` : ''}`;
                cap.appendChild(span);
            });
        }).catch(() => { /* sin datos: la tierlist se ve igual */ });
    }
    document.addEventListener('DOMContentLoaded', marcarTierlist);

    return {
        cargar, calcular, infoMazo, avatar, etiqueta, enlaceMazo, pct, visible, dudoso, nombreRonda, rondasTotales, estado, jugada, fechaTexto,
        BORRADOR_KEY, USAR_BORRADOR_KEY,
        borrador, usandoBorrador,
        nombresTierlist: () => [...tierlist().keys()],
        olvidarCache() { cache = null; mapaTierlist = null; },
    };
})();
