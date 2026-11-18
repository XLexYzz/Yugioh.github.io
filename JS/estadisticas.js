/* Página de estadísticas: ranking de mazos y ficha con historial y rivales. */
(() => {
    const $ = (id) => document.getElementById(id);
    const body = $('statsBody');
    if (!body) return;

    const esc = XYZ.escapar;
    let datos = null;
    let seleccionado = null;

    function filas() {
        const q = normalizar($('statsSearch').value.trim());
        const min = Number($('statsMin').value);
        const conDudosos = $('statsPending').checked;
        const orden = $('statsSort').value;
        const lista = [...datos.mazos.values()]
            .filter(m => m.partidas >= min)
            .filter(m => conDudosos || !m.dudoso)
            .filter(m => !q || normalizar(m.visible).includes(q));
        const cmp = {
            victorias: (a, b) => b.victorias - a.victorias || b.porcentaje - a.porcentaje,
            porcentaje: (a, b) => b.porcentaje - a.porcentaje || b.partidas - a.partidas,
            titulos: (a, b) => b.titulos - a.titulos || b.finales - a.finales || b.victorias - a.victorias,
            partidas: (a, b) => b.partidas - a.partidas || b.victorias - a.victorias,
            torneos: (a, b) => b.torneos - a.torneos || b.victorias - a.victorias,
            nombre: (a, b) => a.visible.localeCompare(b.visible),
        }[orden];
        return lista.sort(cmp);
    }

    function pintarTabla() {
        const lista = filas();
        if (!lista.length) {
            body.innerHTML = '<tr><td colspan="7" class="empty-cell">Ningún mazo cumple los filtros. Prueba a bajar el mínimo de partidas.</td></tr>';
            return;
        }
        body.innerHTML = lista.map((m, i) => `
            <tr data-mazo="${esc(m.nombre)}" class="${m.nombre === seleccionado ? 'is-selected' : ''}" tabindex="0" aria-selected="${m.nombre === seleccionado}">
                <td class="col-pos">${i + 1}</td>
                <td class="col-deck">${TORNEOS.avatar(m.nombre)}<span class="deck-name">${TORNEOS.etiqueta(m.nombre)}</span></td>
                <td class="col-num">${m.torneos}</td>
                <td class="col-num"><b class="w">${m.victorias}</b>–<span class="l">${m.derrotas}</span></td>
                <td class="col-pct"><div class="col-pct-inner"><span class="pct-bar"><i style="width:${(m.porcentaje * 100).toFixed(1)}%"></i></span><span>${TORNEOS.pct(m.porcentaje)}</span></div></td>
                <td class="col-num">${m.titulos ? `<span class="titles">${m.titulos}</span>` : '<span class="zero">0</span>'}</td>
                <td class="col-best">${m.mejor.texto}</td>
            </tr>`).join('');
    }

    function destacados() {
        const todos = [...datos.mazos.values()];
        const confirmados = todos.filter(m => !m.dudoso);
        const top = (lista, cmp) => lista.slice().sort(cmp)[0];
        const masTitulos = top(todos, (a, b) => b.titulos - a.titulos || b.finales - a.finales);
        const mejorPct = top(todos.filter(m => m.partidas >= 8), (a, b) => b.porcentaje - a.porcentaje);
        const masPartidas = top(confirmados, (a, b) => b.partidas - a.partidas);
        const ultimo = datos.ultimo;
        const tarjeta = (titulo, m, dato) => m ? `
            <button type="button" class="highlight" data-mazo="${esc(m.nombre)}">
                ${TORNEOS.avatar(m.nombre, 'highlight-img')}
                <span class="highlight-label">${titulo}</span>
                <span class="highlight-name">${TORNEOS.etiqueta(m.nombre)}</span>
                <span class="highlight-data">${dato}</span>
            </button>` : '';
        $('statsHighlights').innerHTML = [
            ultimo ? tarjeta(`Campeón del ${esc(ultimo.nombre)}`, datos.mazos.get(ultimo.campeon), `Ganó a ${esc(TORNEOS.visible(ultimo.finalista))} en la final`) : '',
            tarjeta('Más títulos', masTitulos, `${masTitulos.titulos} ${masTitulos.titulos === 1 ? 'título' : 'títulos'}, ${masTitulos.finales} finales`),
            tarjeta('Mejor % (8+ partidas)', mejorPct, `${TORNEOS.pct(mejorPct.porcentaje)} en ${mejorPct.partidas} partidas`),
            tarjeta('El más jugado', masPartidas, `${masPartidas.partidas} partidas en ${masPartidas.torneos} torneos`),
        ].join('');
    }

    function ficha(nombre, actualizarHash = true) {
        const m = datos.mazos.get(nombre);
        const panel = $('deckPanel');
        if (!m) {
            panel.innerHTML = '<p class="deck-panel-empty">Elige un mazo del ranking para ver su historial.</p>';
            return;
        }
        seleccionado = nombre;
        body.querySelectorAll('tr[data-mazo]').forEach(tr => {
            const sel = tr.dataset.mazo === nombre;
            tr.classList.toggle('is-selected', sel);
            tr.setAttribute('aria-selected', sel);
        });

        const rivales = [...m.rivales.entries()].map(([n, r]) => ({ n, ...r }));
        const victima = rivales.filter(r => r.v).sort((a, b) => b.v - a.v)[0];
        const verdugo = rivales.filter(r => r.d).sort((a, b) => b.d - a.d)[0];
        const info = m.info;
        const imagen = info
            ? `<img class="deck-panel-img" src="${info.img}" alt="${esc(m.visible)}" width="${info.ancho}" height="${info.alto}" />`
            : `<div class="deck-panel-img deck-panel-noimg">${TORNEOS.avatar(m.nombre, 'deck-avatar-lg')}<span>Sin imagen en la tierlist</span></div>`;

        panel.innerHTML = `
            ${imagen}
            <div class="deck-panel-body">
                <div class="deck-panel-title">
                    <h2>${esc(m.visible)}</h2>
                    ${info ? `<span class="tier-chip tier-${info.nivel}">${esc(info.nivelNombre)}</span>` : ''}
                </div>
                ${m.dudoso ? `<p class="pending-note">Este nombre describe la ilustración del bracket: falta confirmar qué mazo es. <a href="./editor.html">Corregirlo en el editor</a></p>` : ''}
                <div class="scoreline" aria-label="${m.victorias} victorias y ${m.derrotas} derrotas">
                    <span class="score-w">${m.victorias}</span><span class="score-sep">–</span><span class="score-l">${m.derrotas}</span>
                    <span class="score-pct">${TORNEOS.pct(m.porcentaje)} de victorias</span>
                </div>
                <dl class="deck-facts">
                    <div><dt>Torneos</dt><dd>${m.torneos}</dd></div>
                    <div><dt>Títulos</dt><dd>${m.titulos}</dd></div>
                    <div><dt>Finales</dt><dd>${m.finales}</dd></div>
                    <div><dt>Semifinales</dt><dd>${m.semis}</dd></div>
                </dl>
                ${victima || verdugo ? `<div class="rivals">
                    ${victima ? `<p><span>Al que más ha ganado</span><a href="#mazo=${encodeURIComponent(victima.n)}">${TORNEOS.etiqueta(victima.n)}</a> <b>${victima.v}–${victima.d}</b></p>` : ''}
                    ${verdugo ? `<p><span>Su bestia negra</span><a href="#mazo=${encodeURIComponent(verdugo.n)}">${TORNEOS.etiqueta(verdugo.n)}</a> <b>${verdugo.v}–${verdugo.d}</b></p>` : ''}
                </div>` : ''}
                <h3>Historial</h3>
                <ol class="history">
                    ${m.historial.slice().reverse().map(h => `
                        <li class="${h.campeon ? 'is-champ' : ''}">
                            <a href="./torneos.html#torneo-${h.torneo}">${esc(h.nombre)}</a>
                            <span class="history-result">${h.texto}</span>
                            <span class="history-score">${h.v}–${h.d}</span>
                            ${h.eliminadoPor ? `<span class="history-by">Eliminado por ${TORNEOS.etiqueta(h.eliminadoPor)}</span>` : ''}
                        </li>`).join('')}
                </ol>
                <h3>Cara a cara</h3>
                <ul class="h2h">
                    ${rivales.sort((a, b) => (b.v + b.d) - (a.v + a.d) || b.v - a.v).map(r => `
                        <li><a href="#mazo=${encodeURIComponent(r.n)}">${TORNEOS.etiqueta(r.n)}</a><span class="${r.v > r.d ? 'w' : r.v < r.d ? 'l' : ''}">${r.v}–${r.d}</span></li>`).join('')}
                </ul>
            </div>`;
        if (actualizarHash && location.hash !== `#mazo=${encodeURIComponent(nombre)}`) {
            history.replaceState(null, '', `#mazo=${encodeURIComponent(nombre)}`);
        }
    }

    function elegir(nombre, desplazar) {
        ficha(nombre);
        if (desplazar && matchMedia('(max-width: 980px)').matches) {
            $('deckPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function desdeHash() {
        const m = location.hash.match(/^#mazo=(.+)$/);
        if (m) elegir(decodeURIComponent(m[1]), true);
    }

    async function iniciar() {
        try {
            datos = await TORNEOS.cargar();
        } catch (e) {
            body.innerHTML = `<tr><td colspan="7" class="empty-cell">${esc(e.message)}. Comprueba la conexión y recarga la página.</td></tr>`;
            return;
        }
        const aviso = $('statsNotice');
        const partes = [];
        if (datos.borrador) partes.push('Estás viendo el <strong>borrador del editor</strong>, no los datos publicados.');
        if (datos.totales.dudosos) partes.push(`${datos.totales.dudosos} mazos están <strong>por confirmar</strong> (marcados con ?): su nombre describe la ilustración del bracket. <a href="./editor.html">Corregirlos en el editor</a>.`);
        if (partes.length) {
            aviso.innerHTML = partes.join(' ');
            aviso.hidden = false;
        }
        destacados();
        pintarTabla();

        ['statsSearch', 'statsSort', 'statsMin', 'statsPending'].forEach(id => $(id).addEventListener('input', pintarTabla));
        body.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-mazo]');
            if (tr) elegir(tr.dataset.mazo, true);
        });
        body.addEventListener('keydown', (e) => {
            const tr = e.target.closest('tr[data-mazo]');
            if (!tr) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(tr.dataset.mazo, true); }
            if (e.key === 'ArrowDown') { e.preventDefault(); tr.nextElementSibling?.focus(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); tr.previousElementSibling?.focus(); }
        });
        $('statsHighlights').addEventListener('click', (e) => {
            const b = e.target.closest('[data-mazo]');
            if (b) elegir(b.dataset.mazo, true);
        });
        window.addEventListener('hashchange', desdeHash);

        if (location.hash.startsWith('#mazo=')) desdeHash();
        else {
            const primero = filas()[0];
            if (primero && matchMedia('(min-width: 981px)').matches) ficha(primero.nombre, false);
        }
    }

    iniciar();
})();
