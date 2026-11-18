/* Datos de torneos y estadísticas por mazo (compartido por portada, torneos,
   estadísticas, tierlist y editor). Necesita script.js e interactivo.js antes.

   Formato de datos/torneos.json:
     { torneos: [{ id, nombre, imagen, partidas: [[ronda, mazoA, mazoB, ganador 0|1], ...] }] }
   Los nombres que empiezan por "?" describen la ilustración y están por confirmar.
*/
const TORNEOS = (() => {
    const BORRADOR_KEY = 'xyz-torneos-borrador';
    const USAR_BORRADOR_KEY = 'xyz-usar-borrador';

    // Nombre del deck en la tierlist -> [imagen, nivel, ancho, alto]
    const TIERLIST = {"Yubel":["yubel.webp","nah",1024,1457],"Nash":["Nash.webp","special",1024,536],"Yusei":["yusei.webp","special",1024,601],"Kaiba":["kaiba.webp","special",735,531],"Snake-Eye":["snake_eyes.webp","special",1024,576],"Jack":["jack.webp","special",1024,576],"Shun":["shun.webp","grade1",1024,576],"Yuma":["yuma.webp","grade1",600,380],"Playmaker":["playmaker.webp","grade1",736,460],"Soulburner":["soulburner.webp","grade1",600,424],"Mirrorjade":["mirrorjade.webp","grade1",1024,576],"Quatro":["quatro.webp","grade1",1005,702],"Mizael":["mizael.webp","grade1",1024,576],"Dino":["dino.webp","grade1",1024,330],"Revolver":["revolver.webp","grade1",736,414],"Six":["six.webp","grade1",1024,601],"Mimighoul":["mimighoul.webp","grade2",1024,576],"Fiendsmith":["fiendsmith.webp","grade2",1024,512],"Rescue-ACE":["rescue-ace.webp","grade2",1024,576],"Zarc":["zarc.webp","grade2",985,568],"Kaito":["kaito.webp","grade2",1024,597],"Voiceless Voice":["voiless.webp","grade2",1024,576],"Centurion":["centurion.webp","grade2",1024,576],"Unchained":["unchained.webp","grade2",1024,597],"Crow":["crow.webp","grade2",735,392],"Yugi":["yugi.webp","grade2",1006,567],"Ghost":["ghost.webp","grade2",985,554],"Typhoon":["typhoon.webp","semigrade2",1024,661],"Akaba":["akaba.webp","semigrade2",1024,576],"Magistus":["magistus.webp","semigrade2",1024,675],"Dracotail":["dracotail.webp","semigrade2",1024,572],"K9":["k9.webp","semigrade2",1024,576],"Orcust":["orcust.webp","semigrade2",500,291],"Flame Swordsman":["flame_swordman.webp","semigrade2",600,567],"Hermanos Paradoja":["hermanosparadoja.webp","ok",686,386],"Zane":["zane.webp","ok",1024,596],"Sergey":["sergey.webp","ok",1024,576],"Ai":["ai.webp","ok",686,386],"Mako Tsunami":["makotsunami.webp","ok",1024,576],"Yuto":["yuto.webp","ok",728,410],"Alito":["alito.webp","ok",1024,576],"Floowandereeze":["flowwandareeze.webp","ok",900,562],"Purrely":["purrely.webp","ok",800,473],"Crawler":["crawler.webp","meh",1024,629],"Skull":["skull.webp","meh",928,862],"Ghoti":["ghoti.webp","meh",1024,575],"Tenpai":["tenpai.webp","meh",1024,576],"Swordsoul":["swordsoul.webp","meh",825,365],"Thunder Dragon":["thunderdragon.webp","meh",800,400],"Labyrinth":["labyrinth.webp","meh",736,414],"Akiza":["akiza.webp","meh",1024,682],"ABC":["abc.webp","meh",800,473],"Drytron":["drytron.webp","meh",1024,569],"Infernoid":["infernoid.webp","meh",800,473],"Train":["train.webp","meh",1024,611],"Yummy":["yummy.webp","meh",720,410],"Mannadium":["mannadium.webp","meh",720,405],"Artmage":["artmage.webp","meh",1024,576],"Roboppy":["roboppy.webp","meh",1024,576],"PSY-Framegear":["psy.webp","meh",750,350],"Darklords":["darklords.webp","meh",1024,646],"Elfnote":["elfennotes.webp","meh",929,540],"Atem":["atem.webp","meh",1024,576],"White Forest":["whiteforest.webp","meh",960,540],"Memento":["memento.webp","meh",1000,730],"Bakura":["bakura.webp","meh",1024,582],"Jaden":["jaden.webp","meh",800,467],"Maxi":["maxi.webp","meh",1024,597],"Yuri":["yuri.webp","meh",736,429],"Marincess":["marincess.webp","meh",1024,512],"Odion":["odion.webp","meh",1000,523],"Marik":["marik.webp","meh",1024,444],"Yugo":["yugo.webp","meh",1024,576],"Battlewasp":["battlewasp.webp","meh",686,386],"Gem":["gem.webp","meh",600,450],"Ryzeal":["ryzeal.webp","meh",686,386],"Sueldo":["sueldo.webp","meh",1024,576]};

    const NIVELES = {
        nah: 'NAH I’D WIN', special: 'Special Grade', grade1: 'Grade 1', grade2: 'Grade 2',
        semigrade2: 'Semi Grade 2', ok: 'Ok', meh: 'MEH I’D LOSE',
    };

    const dudoso = (n) => n.startsWith('?');
    const visible = (n) => (dudoso(n) ? n.slice(1) : n);

    function infoMazo(n) {
        const t = TIERLIST[n];
        if (!t) return null;
        return { img: `${rutaBase()}tierlist/${t[0]}`, nivel: t[1], nivelNombre: NIVELES[t[1]], ancho: t[2], alto: t[3] };
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
                    titulos: 0, finales: 0, semis: 0, mejor: { valor: -1, texto: '' },
                    historial: [], rivales: new Map(),
                });
            }
            return mazos.get(n);
        };

        datos.torneos.forEach(t => {
            const total = Math.max(...t.partidas.map(p => p[0]));
            const final = t.partidas.find(p => p[0] === total);
            const campeon = final ? final[1 + final[3]] : null;
            const finalista = final ? final[2 - final[3]] : null;
            const porMazo = new Map();

            t.partidas.forEach(([ronda, a, b, g]) => {
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
                if (h.rondaMax === total) m.finales++;
                if (h.rondaMax >= total - 1) m.semis++;
                const valor = esCampeon ? 100 : h.rondaMax;
                const texto = resultadoTexto(h.rondaMax, total, esCampeon);
                // El "mejor" compara por profundidad relativa al tamaño del torneo
                const relativo = esCampeon ? 100 : 10 * (h.rondaMax - total);
                if (relativo > m.mejor.valor) m.mejor = { valor: relativo, texto };
                m.historial.push({ torneo: t.id, nombre: t.nombre, texto, campeon: esCampeon, v: h.v, d: h.d, eliminadoPor: esCampeon ? null : h.eliminadoPor, valor });
            });

            torneos.push({
                ...t, total, campeon, finalista,
                jugadores: t.partidas.filter(p => p[0] === 1).length * 2,
                rondas: Array.from({ length: total }, (_, i) => ({
                    numero: i + 1, nombre: nombreRonda(i + 1, total),
                    partidas: t.partidas.filter(p => p[0] === i + 1),
                })),
            });
        });

        mazos.forEach(m => {
            m.porcentaje = m.partidas ? m.victorias / m.partidas : 0;
        });

        const totales = {
            torneos: torneos.length,
            partidas: torneos.reduce((s, t) => s + t.partidas.length, 0),
            mazos: mazos.size,
            dudosos: [...mazos.values()].filter(m => m.dudoso).length,
        };

        return { torneos, mazos, totales, borrador: usandoBorrador(), datos };
    }

    /* ---------- Presentación ---------- */
    // Imagen del mazo si está en la tierlist; si no, iniciales
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
        cargar, calcular, infoMazo, avatar, etiqueta, enlaceMazo, pct, visible, dudoso, nombreRonda,
        TIERLIST, NIVELES, BORRADOR_KEY, USAR_BORRADOR_KEY,
        borrador, usandoBorrador,
        olvidarCache() { cache = null; },
    };
})();
