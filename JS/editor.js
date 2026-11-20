/* Panel de organizadores: torneos (inscripción, cuadro, resultados), tierlist
   (añadir y ordenar decks con imagen) y publicación en GitHub.
   Todo se guarda como borrador en localStorage hasta que se publica. */
(() => {
    const $ = (id) => document.getElementById(id);
    if (!$('panel-torneos')) return;

    const esc = XYZ.escapar;
    const BASE_KEY = 'xyz-borrador-base';      // huella de los archivos sobre los que se empezó a editar
    const TL = TIERLIST_XYZ;

    let torneos = null;     // { version, nota, torneos: [...] }
    let tier = null;        // { niveles, decks }
    let imagenes = {};      // archivo -> dataURL (pendientes de publicar)
    let ban = null;         // { titulo, cartas: [{ id, status, name }] }
    let publicado = { torneos: '', tierlist: '', banlist: '' };  // texto publicado (para saber si hay cambios)
    let actual = null;
    let resaltado = null;

    /* =========================================================
       UTILIDADES
       ========================================================= */
    const huella = (t) => {
        let h = 0;
        for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
        return `${t.length}:${h}`;
    };
    const jugada = (p) => p[3] === 0 || p[3] === 1;
    const torneo = () => torneos.torneos.find(t => t.id === actual);
    const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';

    function serializarTorneos() {
        const L = ['{', '  "version": 1,', `  "nota": ${JSON.stringify(torneos.nota || '')},`, '  "torneos": ['];
        torneos.torneos.forEach((t, i) => {
            L.push('    {');
            Object.entries(t).filter(([k, v]) => k !== 'partidas' && v !== undefined && v !== null && !(Array.isArray(v) && !v.length && k !== 'inscritos')).forEach(([k, v]) => L.push(`      ${JSON.stringify(k)}: ${JSON.stringify(v)},`));
            L.push('      "partidas": [');
            if (t.partidas.length) L.push(t.partidas.map(p => `        ${JSON.stringify(p)}`).join(',\n'));
            L.push('      ]');
            L.push(`    }${i < torneos.torneos.length - 1 ? ',' : ''}`);
        });
        L.push('  ]', '}', '');
        return L.join('\n');
    }

    // Banlist en formato .lflist.conf (con CRLF, como el archivo del repositorio)
    const BAN_SECCIONES = [[0, 'forbidden'], [1, 'limited'], [2, 'semi-limited']];
    function parsearBan(texto) {
        const titulo = (texto.split(/\r?\n/).find(l => l.trim().startsWith('!')) || '!XYZ Banlist').trim();
        return { titulo, cartas: parseBanlist(texto) };
    }
    function serializarBan(b) {
        const L = [b.titulo.startsWith('!') ? b.titulo : `!${b.titulo}`];
        BAN_SECCIONES.forEach(([n, nombre]) => {
            L.push(`#${nombre}`);
            b.cartas.filter(c => c.status === n).forEach(c => L.push(`${c.id} ${n} --${c.name}`));
        });
        return L.join('\r\n') + '\r\n';
    }

    function cambios() {
        return {
            torneos: serializarTorneos() !== publicado.torneos,
            tierlist: TL.serializar(tier) !== publicado.tierlist,
            banlist: diffBan().length > 0 || ban.titulo !== parsearBan(publicado.banlist).titulo,
            imagenes: Object.keys(imagenes).length,
        };
    }

    function guardar() {
        const c = cambios();
        try {
            if (c.torneos) XYZ.guardar(TORNEOS.BORRADOR_KEY, torneos);
            else localStorage.removeItem(TORNEOS.BORRADOR_KEY);
            if (c.tierlist) XYZ.guardar(TL.BORRADOR_KEY, tier);
            else localStorage.removeItem(TL.BORRADOR_KEY);
            if (c.banlist) XYZ.guardar(BANLIST_BORRADOR_KEY, serializarBan(ban));
            else localStorage.removeItem(BANLIST_BORRADOR_KEY);
            localStorage.setItem(TL.IMAGENES_KEY, JSON.stringify(imagenes));
        } catch {
            mostrarToast('El navegador no deja guardar más: publica los cambios o quita alguna imagen');
        }
        const base = XYZ.leer(BASE_KEY, null);
        if (!base) XYZ.guardar(BASE_KEY, { torneos: huella(publicado.torneos), tierlist: huella(publicado.tierlist), banlist: huella(publicado.banlist) });
        else if (!base.banlist) XYZ.guardar(BASE_KEY, { ...base, banlist: huella(publicado.banlist) });
        if (!c.torneos && !c.tierlist && !c.banlist && !c.imagenes) {
            try { localStorage.removeItem(BASE_KEY); } catch { /* nada */ }
        }
        estado();
    }

    function estado() {
        const c = cambios();
        const n = (c.torneos ? 1 : 0) + (c.tierlist ? 1 : 0) + (c.banlist ? 1 : 0) + c.imagenes;
        const hay = n > 0;
        $('edStatus').innerHTML = hay
            ? `<strong>Tienes cambios sin publicar</strong> guardados en este navegador. Revísalos y pulsa Publicar.`
            : 'Todo publicado. Los cambios que hagas se guardan aquí hasta que los publiques.';
        $('edPendingCount').hidden = !hay;
        $('edPendingCount').textContent = n;
        $('edPreview').disabled = !hay;
        $('edPreview').checked = hay && !!XYZ.leer(TORNEOS.USAR_BORRADOR_KEY, false);
        pintarCambios();
    }

    function descargar(nombre, texto, tipo) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
        a.download = nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /* =========================================================
       CARGA
       ========================================================= */
    const RUTA_BANLIST = `banlist/${BANLIST_FILE}`;

    async function cargarPublicado() {
        if (GH.listo()) {
            try {
                const [t, l, b] = await Promise.all([GH.leerArchivo('datos/torneos.json'), GH.leerArchivo('datos/tierlist.js'), GH.leerArchivo(RUTA_BANLIST)]);
                return { torneos: t.texto, tierlist: l.texto, banlist: b.texto, origen: 'GitHub' };
            } catch (e) {
                mostrarToast(`No se ha podido leer de GitHub: ${e.message} Se usan los datos de la web.`);
            }
        }
        const leer = (ruta) => fetch(`${rutaBase()}${ruta}`, { cache: 'no-cache' }).then(r => {
            if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
            return r.text();
        });
        const [t, l, b] = await Promise.all([
            leer('datos/torneos.json'),
            leer('datos/tierlist.js'),
            leer(RUTA_BANLIST.split('/').map(encodeURIComponent).join('/')),
        ]);
        return { torneos: t, tierlist: l, banlist: b, origen: 'web' };
    }

    async function iniciar() {
        let base;
        try {
            base = await cargarPublicado();
        } catch (e) {
            $('edStatus').textContent = `No se han podido cargar los datos (${e.message}). Recarga la página.`;
            return;
        }
        const tPub = JSON.parse(base.torneos);
        const lPub = TL.parsear(base.tierlist);
        torneos = TORNEOS.borrador() || tPub;
        tier = TL.borrador() || lPub;
        imagenes = TL.imagenesPendientes();
        // El texto "publicado" se normaliza con nuestro propio formato para comparar
        const tmpT = torneos, tmpL = tier;
        torneos = tPub; tier = lPub;
        publicado = { torneos: serializarTorneos(), tierlist: TL.serializar(lPub), banlist: serializarBan(parsearBan(base.banlist)) };
        torneos = tmpT; tier = tmpL;
        const banGuardada = XYZ.leer(BANLIST_BORRADOR_KEY, null);
        ban = parsearBan(typeof banGuardada === 'string' ? banGuardada : base.banlist);

        // Un borrador antiguo no debe ocultar lo publicado después: se añaden los
        // torneos y decks que falten (sin tocar lo que el organizador haya cambiado)
        const añadidos = [];
        if (torneos !== tPub) {
            torneos.nota = tPub.nota;   // la nota no se edita en el panel
            const ids = new Set(torneos.torneos.map(t => t.id));
            tPub.torneos.filter(t => !ids.has(t.id)).forEach(t => {
                torneos.torneos.push(structuredClone(t));
                añadidos.push(t.nombre);
            });
            torneos.torneos.sort((a, b) => a.id - b.id);
        }
        if (tier !== lPub) {
            const imgs = new Set(tier.decks.map(d => d.imagen));
            lPub.decks.filter(d => !imgs.has(d.imagen)).forEach(d => {
                tier.decks.push(structuredClone(d));
                añadidos.push(d.nombre);
            });
        }

        const desdeHash = Number((location.hash.match(/^#torneo-(\d+)$/) || [])[1]);
        actual = torneos.torneos.some(t => t.id === desdeHash) ? desdeHash : (torneos.torneos[torneos.torneos.length - 1]?.id ?? null);

        pintarGH();
        pintarTodo();
        if (torneos !== tPub || tier !== lPub || banGuardada) guardar();   // si el borrador queda igual que lo publicado, se elimina
        if (añadidos.length) {
            mostrarToast(`Añadido a tu borrador lo publicado después: ${añadidos.slice(0, 4).join(', ')}${añadidos.length > 4 ? '…' : ''}`);
        }
        estado();
        if (['#tierlist', '#banlist', '#publicar'].includes(location.hash)) elegirTab(location.hash.slice(1));
    }

    function pintarTodo() {
        sugerencias();
        pintarSelector();
        pintarTorneo();
        pintarNombres();
        pintarTierlist();
        pintarBanlist();
    }

    /* =========================================================
       PESTAÑAS
       ========================================================= */
    const tabs = ['torneos', 'tierlist', 'banlist', 'publicar'];
    function elegirTab(id) {
        tabs.forEach(t => {
            const sel = t === id;
            $(`tab-${t}`).setAttribute('aria-selected', sel);
            $(`tab-${t}`).tabIndex = sel ? 0 : -1;
            $(`panel-${t}`).hidden = !sel;
        });
    }
    tabs.forEach((t, i) => {
        $(`tab-${t}`).addEventListener('click', () => elegirTab(t));
        $(`tab-${t}`).addEventListener('keydown', (e) => {
            const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : null;
            if (j === null) return;
            e.preventDefault();
            elegirTab(tabs[j]);
            $(`tab-${tabs[j]}`).focus();
        });
    });
    $('edGoPublish').addEventListener('click', () => {
        elegirTab('publicar');
        $('panel-publicar').scrollIntoView({ behavior: 'smooth' });
    });
    $('edPreview').addEventListener('change', (e) => {
        XYZ.guardar(TORNEOS.USAR_BORRADOR_KEY, e.target.checked);
        mostrarToast(e.target.checked ? 'Las páginas públicas se ven ahora con tus cambios (solo en este navegador)' : 'Las páginas vuelven a mostrar lo publicado');
    });

    /* =========================================================
       TORNEOS
       ========================================================= */
    function sugerencias() {
        const nombres = new Set(tier.decks.map(d => d.nombre));
        torneos.torneos.forEach(t => t.partidas.forEach(p => { [p[1], p[2]].forEach(n => { if (!TORNEOS.dudoso(n)) nombres.add(n); }); }));
        $('edDecks').innerHTML = [...nombres].sort((a, b) => a.localeCompare(b)).map(n => `<option value="${esc(n)}"></option>`).join('');
    }

    function pintarSelector() {
        const etiquetaEstado = { inscripcion: 'inscripción', 'en-juego': 'en juego', terminado: '' };
        $('edTour').innerHTML = torneos.torneos.slice().reverse().map(t => {
            const e = etiquetaEstado[TORNEOS.estado(t)];
            return `<option value="${t.id}">${esc(t.nombre)}${e ? ` (${e})` : ''}${t.revisar ? ' (por revisar)' : ''}</option>`;
        }).join('');
        if (actual !== null) $('edTour').value = actual;
    }

    // Ganadores de una ronda en el orden del cuadro (incluye pases directos en la primera)
    function ganadores(t, r) {
        const ronda = t.partidas.filter(p => p[0] === r);
        if (r === 1 && t.cuadro) {
            let k = 0;
            return t.cuadro.map(([a, b]) => {
                if (b === null) return a;
                if (a === null) return b;
                const p = ronda[k++];
                return p && jugada(p) ? p[1 + p[3]] : undefined;
            });
        }
        return ronda.map(p => (jugada(p) ? p[1 + p[3]] : undefined));
    }

    // Crea las rondas siguientes cuando la actual está completa
    function avanzar(t) {
        if (!t.cuadro) return;
        const total = TORNEOS.rondasTotales(t);
        for (let r = 1; r <= total; r++) {
            const g = ganadores(t, r);
            if (g.some(x => x === undefined)) { t.estado = 'en-juego'; return; }
            if (g.length === 1) { t.estado = 'terminado'; return; }
            if (!t.partidas.some(p => p[0] === r + 1)) {
                for (let i = 0; i + 1 < g.length; i += 2) t.partidas.push([r + 1, g[i], g[i + 1], null]);
                mostrarToast(`${TORNEOS.nombreRonda(r + 1, total)} lista`);
            }
        }
    }

    function generarCuadro(t, aleatorio) {
        const lista = t.inscritos.map(i => i.mazo.trim()).filter(Boolean);
        if (lista.length < 2) {
            mostrarToast('Hacen falta al menos 2 participantes con mazo');
            return false;
        }
        if (aleatorio) {
            for (let i = lista.length - 1; i > 0; i--) {
                const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
                [lista[i], lista[j]] = [lista[j], lista[i]];
            }
        }
        const tam = 2 ** Math.ceil(Math.log2(lista.length));
        const parejas = tam / 2;
        const pases = tam - lista.length;
        // Los pases directos se reparten por todo el cuadro
        const conPase = new Set(Array.from({ length: pases }, (_, i) => Math.floor(i * parejas / pases)));
        const cuadro = [];
        let k = 0;
        for (let i = 0; i < parejas; i++) cuadro.push(conPase.has(i) ? [lista[k++], null] : [lista[k++], lista[k++]]);
        t.cuadro = cuadro;
        t.partidas = cuadro.filter(([, b]) => b !== null).map(([a, b]) => [1, a, b, null]);
        t.estado = 'en-juego';
        avanzar(t);
        return true;
    }

    function pintarInfo(t) {
        const e = TORNEOS.estado(t);
        const textos = {
            inscripcion: 'Inscripción abierta: apunta a los participantes y genera el cuadro cuando estén todos.',
            'en-juego': 'En juego: marca los ganadores a medida que se juegan las partidas.',
            terminado: 'Terminado.',
        };
        $('edInfo').innerHTML = `
            <div class="adm-card-head">
                <h2>${esc(t.nombre)}</h2>
                <span class="adm-state adm-state-${e}">${{ inscripcion: 'Inscripción', 'en-juego': 'En juego', terminado: 'Terminado' }[e]}</span>
            </div>
            <p class="adm-hint">${textos[e]}</p>
            <div class="adm-grid">
                <label class="adm-field"><span>Nombre</span><input id="edTourName" value="${esc(t.nombre)}" /></label>
                <label class="adm-field"><span>Fecha</span><input id="edTourDate" type="date" value="${esc(t.fecha || '')}" /></label>
            </div>
            ${t.revisar ? `<div class="tour-warning"><strong>Por revisar:</strong> ${esc(t.revisar)} <button type="button" class="ed-link" id="edClearNote">Marcar como revisado</button></div>` : ''}`;
    }

    function pintarInscritos(t) {
        const box = $('edEntrants');
        if (!t.inscritos && t.partidas.length) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        t.inscritos = t.inscritos || [];
        const bloqueado = !!t.cuadro;
        const filas = t.inscritos.map((ins, i) => `
            <div class="adm-entrant" data-i="${i}">
                <span class="adm-entrant-n">${i + 1}</span>
                <input class="adm-player" value="${esc(ins.jugador || '')}" placeholder="Jugador (opcional)" aria-label="Jugador ${i + 1}" ${bloqueado ? 'disabled' : ''} />
                <input class="adm-deck ${TORNEOS.dudoso(ins.mazo || '') ? 'is-pending' : ''}" list="edDecks" value="${esc(ins.mazo || '')}" placeholder="Mazo" aria-label="Mazo ${i + 1}" ${bloqueado ? 'disabled' : ''} />
                ${bloqueado ? '' : `<button type="button" class="ed-del" data-quitar="${i}" aria-label="Quitar participante ${i + 1}">×</button>`}
            </div>`).join('');
        const tam = t.inscritos.length > 1 ? 2 ** Math.ceil(Math.log2(t.inscritos.length)) : 0;
        box.innerHTML = `
            <div class="adm-card-head">
                <h2>Participantes <span class="tier-count">${t.inscritos.length}</span></h2>
                <p class="adm-hint">${bloqueado
                    ? 'El cuadro ya está generado. Para cambiar participantes hay que rehacerlo (se borran los resultados).'
                    : tam ? `Cuadro de ${tam}${tam > t.inscritos.length ? `: ${tam - t.inscritos.length} ${tam - t.inscritos.length === 1 ? 'pase directo' : 'pases directos'} a la segunda ronda` : ''}.` : 'Añade al menos dos participantes.'}</p>
            </div>
            <div class="adm-entrants">${filas || '<p class="adm-hint">Todavía no hay nadie apuntado.</p>'}</div>
            ${bloqueado ? `
                <div class="ed-row-actions"><button type="button" class="button button-secondary" id="edRebuild">Rehacer el cuadro</button></div>` : `
                <div class="ed-row-actions">
                    <button type="button" class="button button-secondary" id="edAddEntrant">Añadir participante</button>
                    <button type="button" class="button button-secondary" id="edPasteToggle">Pegar una lista</button>
                </div>
                <div class="adm-paste" id="edPasteBox" hidden>
                    <label class="adm-field"><span>Una línea por participante: <code>Jugador - Mazo</code> o solo el mazo</span>
                    <textarea id="edPasteText" rows="6" placeholder="Alex - Snake-Eye&#10;Marta - Yubel&#10;Kaiba"></textarea></label>
                    <button type="button" class="button button-secondary" id="edPasteAdd">Añadir a la lista</button>
                </div>
                <div class="adm-generate">
                    <fieldset>
                        <legend>Orden del cuadro</legend>
                        <label class="stats-check"><input type="radio" name="edOrder" value="aleatorio" checked /><span>Sorteo aleatorio</span></label>
                        <label class="stats-check"><input type="radio" name="edOrder" value="lista" /><span>En el orden de la lista</span></label>
                    </fieldset>
                    <button type="button" class="button button-primary" id="edGenerate" ${t.inscritos.length < 2 ? 'disabled' : ''}>Cerrar inscripción y generar cuadro</button>
                </div>`}`;
    }

    function pintarTorneo() {
        const t = torneo();
        if (!t) {
            $('edInfo').innerHTML = '<p class="empty-state">No hay torneos. Crea uno nuevo.</p>';
            $('edEntrants').hidden = true;
            $('edRounds').innerHTML = '';
            $('edImageBox').hidden = true;
            return;
        }
        pintarInfo(t);
        pintarInscritos(t);

        $('edImageBox').hidden = !t.imagen;
        $('edWorkspace').classList.toggle('has-image', !!t.imagen);
        if (t.imagen) {
            $('edImage').src = `${rutaBase()}torneos/${t.imagen}`;
            $('edImage').alt = `Bracket original del ${t.nombre}`;
        }

        const total = TORNEOS.rondasTotales(t);
        const hechas = Math.max(0, ...t.partidas.map(p => p[0]));
        const jugadorDe = new Map((t.inscritos || []).filter(i => i.jugador).map(i => [i.mazo, i.jugador]));
        let html = '';
        if (!t.partidas.length) {
            html = `<p class="adm-hint">${t.cuadro ? '' : 'Las partidas aparecerán aquí al generar el cuadro.'}</p>`;
        }
        for (let r = 1; r <= hechas; r++) {
            const filas = t.partidas.map((p, i) => ({ p, i })).filter(x => x.p[0] === r);
            const pases = r === 1 && t.cuadro ? t.cuadro.filter(([, b]) => b === null).map(([a]) => a) : [];
            html += `<section class="ed-round"><h3>${TORNEOS.nombreRonda(r, total)} <span class="tier-count">${filas.filter(x => jugada(x.p)).length}/${filas.length}</span></h3>
                ${filas.map(({ p, i }) => `
                    <div class="ed-match ${resaltado && (p[1] === resaltado || p[2] === resaltado) ? 'is-hl' : ''} ${jugada(p) ? '' : 'is-open'}" data-i="${i}">
                        <span class="ed-side">
                            <input class="ed-deck ${TORNEOS.dudoso(p[1]) ? 'is-pending' : ''}" data-lado="1" list="edDecks" value="${esc(p[1])}" aria-label="Mazo A" />
                            ${jugadorDe.get(p[1]) ? `<small>${esc(jugadorDe.get(p[1]))}</small>` : ''}
                        </span>
                        <button type="button" class="ed-win ${p[3] === 0 ? 'on' : ''}" data-g="0" aria-pressed="${p[3] === 0}" title="Gana ${esc(TORNEOS.visible(p[1]))}">V</button>
                        <button type="button" class="ed-win ${p[3] === 1 ? 'on' : ''}" data-g="1" aria-pressed="${p[3] === 1}" title="Gana ${esc(TORNEOS.visible(p[2]))}">V</button>
                        <span class="ed-side">
                            <input class="ed-deck ${TORNEOS.dudoso(p[2]) ? 'is-pending' : ''}" data-lado="2" list="edDecks" value="${esc(p[2])}" aria-label="Mazo B" />
                            ${jugadorDe.get(p[2]) ? `<small>${esc(jugadorDe.get(p[2]))}</small>` : ''}
                        </span>
                        ${t.cuadro ? '<span></span>' : '<button type="button" class="ed-del" aria-label="Borrar partida">×</button>'}
                    </div>`).join('')}
                ${pases.length ? `<p class="adm-hint">Pase directo: ${pases.map(n => esc(TORNEOS.visible(n))).join(', ')}</p>` : ''}
                ${t.cuadro ? '' : `<button type="button" class="ed-link" data-add="${r}">Añadir partida</button>`}
            </section>`;
        }
        if (!t.cuadro && t.partidas.length) {
            const ultima = t.partidas.filter(p => p[0] === hechas);
            if (ultima.length > 1 && ultima.every(jugada)) {
                html += `<button type="button" class="button button-secondary" id="edNextRound">Crear la siguiente ronda con los ganadores</button>`;
            }
        }
        const t2 = TORNEOS.estado(t);
        if (t2 === 'terminado' && t.partidas.length) {
            const final = t.partidas.find(p => p[0] === total && jugada(p));
            if (final) html += `<p class="adm-champion">Campeón: <strong>${esc(TORNEOS.visible(final[1 + final[3]]))}</strong></p>`;
        }
        $('edRounds').innerHTML = html;
        problemas(t);
    }

    function problemas(t) {
        const lista = [];
        const total = TORNEOS.rondasTotales(t);
        const hechas = Math.max(0, ...t.partidas.map(p => p[0]));
        for (let r = 2; r <= hechas; r++) {
            const g = ganadores(t, r - 1).filter(Boolean);
            const enRonda = t.partidas.filter(p => p[0] === r).flatMap(p => [p[1], p[2]]);
            enRonda.forEach(n => {
                const k = g.indexOf(n);
                if (k >= 0) g.splice(k, 1);
                else lista.push(`${TORNEOS.visible(n)} juega en ${TORNEOS.nombreRonda(r, total)} pero no ganó en la ronda anterior.`);
            });
        }
        t.partidas.forEach(p => { if (!String(p[1]).trim() || !String(p[2]).trim()) lista.push('Hay una partida sin mazo.'); });
        $('edProblems').innerHTML = lista.map(x => `<li>${esc(x)}</li>`).join('');
    }

    // Cambiar un ganador cuando ya hay rondas posteriores obliga a rehacerlas
    function borrarDesde(t, r) {
        t.partidas = t.partidas.filter(p => p[0] <= r);
    }

    function renombrar(viejo, nuevo, soloTorneo = null) {
        let n = 0;
        torneos.torneos.forEach(t => {
            if (soloTorneo && t.id !== soloTorneo) return;
            t.partidas.forEach(p => {
                if (p[1] === viejo) { p[1] = nuevo; n++; }
                if (p[2] === viejo) { p[2] = nuevo; n++; }
            });
            (t.cuadro || []).forEach(par => par.forEach((x, k) => { if (x === viejo) { par[k] = nuevo; n++; } }));
            (t.inscritos || []).forEach(i => { if (i.mazo === viejo) { i.mazo = nuevo; n++; } });
        });
        return n;
    }

    // ---- Eventos de torneos ----
    $('edTour').addEventListener('change', () => {
        actual = Number($('edTour').value);
        resaltado = null;
        pintarTorneo();
        history.replaceState(null, '', `#torneo-${actual}`);
    });

    $('edNew').addEventListener('click', () => {
        const id = Math.max(0, ...torneos.torneos.map(t => t.id)) + 1;
        $('edNewName').value = `Torneo ${id}`;
        $('edNewDate').value = new Date().toISOString().slice(0, 10);
        $('edNewForm').hidden = false;
        $('edNewName').focus();
    });
    $('edCancel').addEventListener('click', () => { $('edNewForm').hidden = true; });
    $('edNewForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = Math.max(0, ...torneos.torneos.map(t => t.id)) + 1;
        torneos.torneos.push({
            id, nombre: $('edNewName').value.trim() || `Torneo ${id}`,
            fecha: $('edNewDate').value || undefined, estado: 'inscripcion', inscritos: [], partidas: [],
        });
        actual = id;
        $('edNewForm').hidden = true;
        guardar();
        pintarSelector();
        pintarTorneo();
        mostrarToast(`${torneo().nombre} creado: apunta a los participantes`);
        $('edEntrants').scrollIntoView({ behavior: 'smooth' });
    });

    $('edDelete').addEventListener('click', () => {
        const t = torneo();
        if (!t || !confirm(`¿Borrar el ${t.nombre}? Si ya estaba publicado, desaparecerá de la web al publicar.`)) return;
        torneos.torneos = torneos.torneos.filter(x => x.id !== t.id);
        actual = torneos.torneos[torneos.torneos.length - 1]?.id ?? null;
        guardar();
        pintarTodo();
    });

    $('edInfo').addEventListener('change', (e) => {
        const t = torneo();
        if (e.target.id === 'edTourName') {
            t.nombre = e.target.value.trim() || `Torneo ${t.id}`;
            pintarSelector();
        }
        if (e.target.id === 'edTourDate') {
            if (e.target.value) t.fecha = e.target.value;
            else delete t.fecha;
        }
        guardar();
    });
    $('edInfo').addEventListener('click', (e) => {
        if (e.target.id !== 'edClearNote') return;
        delete torneo().revisar;
        guardar();
        pintarSelector();
        pintarTorneo();
    });

    $('edEntrants').addEventListener('input', (e) => {
        const fila = e.target.closest('.adm-entrant');
        if (!fila) return;
        const ins = torneo().inscritos[Number(fila.dataset.i)];
        if (e.target.classList.contains('adm-player')) ins.jugador = e.target.value.trim() || undefined;
        if (e.target.classList.contains('adm-deck')) ins.mazo = e.target.value.trim();
        guardar();
    });
    $('edEntrants').addEventListener('change', (e) => {
        // Sin volver a pintar la lista: así no se pierde el campo al que pasa el foco
        if (e.target.classList.contains('adm-deck')) {
            e.target.classList.toggle('is-pending', TORNEOS.dudoso(e.target.value.trim()));
            sugerencias();
        }
    });
    $('edEntrants').addEventListener('click', (e) => {
        const t = torneo();
        if (e.target.id === 'edAddEntrant') {
            t.inscritos.push({ mazo: '' });
            guardar();
            pintarInscritos(t);
            const inputs = $('edEntrants').querySelectorAll('.adm-player');
            inputs[inputs.length - 1]?.focus();
        } else if (e.target.dataset.quitar !== undefined) {
            t.inscritos.splice(Number(e.target.dataset.quitar), 1);
            guardar();
            pintarInscritos(t);
        } else if (e.target.id === 'edPasteToggle') {
            $('edPasteBox').hidden = !$('edPasteBox').hidden;
            if (!$('edPasteBox').hidden) $('edPasteText').focus();
        } else if (e.target.id === 'edPasteAdd') {
            const nuevos = $('edPasteText').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
                const m = l.split(/\s+[-–—:]\s+/);
                return m.length > 1 ? { jugador: m[0].trim(), mazo: m.slice(1).join(' - ').trim() } : { mazo: l };
            });
            t.inscritos.push(...nuevos);
            guardar();
            pintarInscritos(t);
            mostrarToast(`${nuevos.length} participantes añadidos`);
        } else if (e.target.id === 'edGenerate') {
            const vacios = t.inscritos.filter(i => !i.mazo?.trim()).length;
            if (vacios && !confirm(`${vacios} participantes no tienen mazo y se quedarán fuera. ¿Seguir?`)) return;
            t.inscritos = t.inscritos.filter(i => i.mazo?.trim());
            const aleatorio = document.querySelector('input[name="edOrder"]:checked')?.value !== 'lista';
            if (generarCuadro(t, aleatorio)) {
                guardar();
                pintarSelector();
                pintarTorneo();
                mostrarToast('Cuadro generado: marca los ganadores');
            }
        } else if (e.target.id === 'edRebuild') {
            if (t.partidas.some(jugada) && !confirm('Se borrarán el cuadro y todos los resultados de este torneo. ¿Seguir?')) return;
            delete t.cuadro;
            t.partidas = [];
            t.estado = 'inscripcion';
            guardar();
            pintarSelector();
            pintarTorneo();
        }
    });

    $('edRounds').addEventListener('click', (e) => {
        const t = torneo();
        const fila = e.target.closest('.ed-match');
        const win = e.target.closest('.ed-win');
        if (win && fila) {
            const p = t.partidas[Number(fila.dataset.i)];
            const g = Number(win.dataset.g);
            const nuevo = p[3] === g ? null : g;       // pulsar otra vez la misma V la quita
            const posteriores = t.partidas.some(q => q[0] > p[0]);
            if (t.cuadro && posteriores && p[3] !== null) {
                if (!confirm('Cambiar este resultado borra las rondas siguientes para rehacerlas. ¿Seguir?')) return;
                borrarDesde(t, p[0]);
            }
            p[3] = nuevo;
            avanzar(t);
            guardar();
            pintarSelector();
            pintarTorneo();
        } else if (e.target.closest('.ed-del') && fila) {
            if (!confirm('¿Borrar esta partida?')) return;
            t.partidas.splice(Number(fila.dataset.i), 1);
            guardar();
            pintarTorneo();
            pintarNombres();
        } else if (e.target.dataset.add) {
            t.partidas.push([Number(e.target.dataset.add), '?Nuevo mazo A', '?Nuevo mazo B', null]);
            t.partidas.sort((a, b) => a[0] - b[0]);
            guardar();
            pintarTorneo();
        } else if (e.target.id === 'edNextRound') {
            const hechas = Math.max(...t.partidas.map(p => p[0]));
            const g = ganadores(t, hechas);
            for (let i = 0; i + 1 < g.length; i += 2) t.partidas.push([hechas + 1, g[i], g[i + 1], null]);
            guardar();
            pintarTorneo();
        }
    });

    $('edRounds').addEventListener('change', (e) => {
        const t = torneo();
        const fila = e.target.closest('.ed-match');
        if (!fila || !e.target.classList.contains('ed-deck')) return;
        const p = t.partidas[Number(fila.dataset.i)];
        const lado = Number(e.target.dataset.lado);
        const viejo = p[lado];
        const nuevo = e.target.value.trim();
        if (!nuevo || nuevo === viejo) return;
        const enOtras = t.partidas.some((q, j) => j !== Number(fila.dataset.i) && (q[1] === viejo || q[2] === viejo));
        if (enOtras && confirm(`¿Cambiar ${TORNEOS.visible(viejo)} por ${nuevo} en todo este torneo?`)) renombrar(viejo, nuevo, t.id);
        else p[lado] = nuevo;
        guardar();
        sugerencias();
        pintarNombres();
        pintarTorneo();
    });

    $('edZoom').addEventListener('input', () => { $('edImage').style.width = `${$('edZoom').value}%`; });

    /* ---------- Nombres (en todos los torneos) ---------- */
    function pintarNombres() {
        const usos = new Map();
        torneos.torneos.forEach(t => t.partidas.forEach(([, a, b]) => [a, b].forEach(n => {
            const u = usos.get(n) || new Set();
            u.add(t.id);
            usos.set(n, u);
        })));
        const todos = $('edShowAll').checked;
        const pendientes = [...usos.keys()].filter(TORNEOS.dudoso).length;
        $('edNamesCount').textContent = pendientes ? `${pendientes} por confirmar` : usos.size;
        const lista = [...usos.entries()].filter(([n]) => todos || TORNEOS.dudoso(n)).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
        $('edNames').innerHTML = lista.length ? lista.map(([n, ts]) => `
            <form class="ed-name ${TORNEOS.dudoso(n) ? 'is-pending' : ''}" data-nombre="${esc(n)}">
                <div class="ed-name-info">
                    ${TORNEOS.avatar(n, 'ed-name-img')}
                    <span class="ed-name-text">${TORNEOS.etiqueta(n)}</span>
                    <span class="ed-name-uses">${[...ts].sort((a, b) => a - b).map(id => `<button type="button" class="ed-chip" data-ver="${id}" data-nombre="${esc(n)}">T${id}</button>`).join('')}</span>
                </div>
                <label class="ed-name-input">
                    <span class="visually-hidden">Nuevo nombre para ${esc(TORNEOS.visible(n))}</span>
                    <input list="edDecks" placeholder="${TORNEOS.dudoso(n) ? 'Mazo correcto…' : 'Renombrar…'}" autocomplete="off" />
                </label>
                <button type="submit" class="button button-secondary">Aplicar</button>
            </form>`).join('') : '<p class="adm-hint">No queda ningún nombre por confirmar.</p>';
    }
    $('edShowAll').addEventListener('change', pintarNombres);
    $('edNames').addEventListener('submit', (e) => {
        e.preventDefault();
        const viejo = e.target.dataset.nombre;
        const nuevo = e.target.querySelector('input').value.trim();
        if (!nuevo) { mostrarToast('Escribe el nombre nuevo'); return; }
        const n = renombrar(viejo, nuevo);
        guardar();
        sugerencias();
        pintarNombres();
        pintarTorneo();
        mostrarToast(`${TORNEOS.visible(viejo)} → ${nuevo} (${n} ${n === 1 ? 'cambio' : 'cambios'})`);
    });
    $('edNames').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-ver]');
        if (!chip) return;
        actual = Number(chip.dataset.ver);
        resaltado = chip.dataset.nombre;
        $('edTour').value = actual;
        pintarTorneo();
        $('edRounds').scrollIntoView({ behavior: 'smooth' });
    });

    /* =========================================================
       TIERLIST
       ========================================================= */
    const srcDeck = (d) => imagenes[d.imagen] || `${rutaBase()}tierlist/${d.imagen}`;

    function pintarTierlist() {
        $('tlLevel').innerHTML = tier.niveles.map(n => `<option value="${esc(n.id)}">${esc(n.nombre)}</option>`).join('');
        const opciones = (sel) => tier.niveles.map(n => `<option value="${esc(n.id)}" ${n.id === sel ? 'selected' : ''}>${esc(n.nombre)}</option>`).join('');
        $('tlLevels').innerHTML = tier.niveles.map(n => {
            const decks = tier.decks.map((d, i) => ({ d, i })).filter(x => x.d.nivel === n.id);
            return `<section class="tl-level">
                <h3>${esc(n.nombre)} <span class="tier-count">${decks.length}</span></h3>
                ${decks.length ? decks.map(({ d, i }, k) => `
                    <div class="tl-row" data-i="${i}">
                        <img src="${esc(srcDeck(d))}" alt="" loading="lazy" />
                        <input class="tl-name" value="${esc(d.nombre)}" aria-label="Nombre del deck" />
                        <select class="tl-level-select" aria-label="Nivel de ${esc(d.nombre)}">${opciones(d.nivel)}</select>
                        <span class="tl-move">
                            <button type="button" data-mover="-1" aria-label="Subir ${esc(d.nombre)}" ${k === 0 ? 'disabled' : ''}>↑</button>
                            <button type="button" data-mover="1" aria-label="Bajar ${esc(d.nombre)}" ${k === decks.length - 1 ? 'disabled' : ''}>↓</button>
                        </span>
                        <button type="button" class="ed-del" data-borrar aria-label="Quitar ${esc(d.nombre)} de la tierlist">×</button>
                        ${imagenes[d.imagen] ? '<span class="tl-new">Nuevo</span>' : ''}
                    </div>`).join('') : '<p class="adm-hint">Sin decks en este nivel.</p>'}
            </section>`;
        }).join('');
    }

    async function convertirImagen(file) {
        const bmp = await createImageBitmap(file);
        const escala = Math.min(1, 1024 / bmp.width, 1500 / bmp.height);
        const w = Math.round(bmp.width * escala);
        const h = Math.round(bmp.height * escala);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(bmp, 0, 0, w, h);
        let url = c.toDataURL('image/webp', 0.84);
        let ext = 'webp';
        if (!url.startsWith('data:image/webp')) {     // navegadores sin WebP
            url = c.toDataURL('image/jpeg', 0.86);
            ext = 'jpg';
        }
        return { url, ext, w, h };
    }

    let imagenNueva = null;
    $('tlImage').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        imagenNueva = null;
        if (!f) return;
        try {
            imagenNueva = await convertirImagen(f);
            const kb = Math.round(imagenNueva.url.length * 0.75 / 1024);
            $('tlPreview').innerHTML = `<img src="${imagenNueva.url}" alt="" /><span>${imagenNueva.w}×${imagenNueva.h}, ${kb} KB</span>`;
        } catch {
            $('tlPreview').innerHTML = '<span>No se ha podido leer la imagen. Prueba con PNG, JPG o WebP.</span>';
        }
    });

    $('tlAddForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = $('tlName').value.trim();
        if (!nombre || !imagenNueva) { mostrarToast('Pon un nombre y elige una imagen'); return; }
        if (tier.decks.some(d => d.nombre.toLowerCase() === nombre.toLowerCase())) { mostrarToast(`${nombre} ya está en la tierlist`); return; }
        let archivo = `${slug(nombre)}.${imagenNueva.ext}`;
        for (let k = 2; tier.decks.some(d => d.imagen === archivo) || imagenes[archivo]; k++) archivo = `${slug(nombre)}-${k}.${imagenNueva.ext}`;
        imagenes[archivo] = imagenNueva.url;
        tier.decks.push({ nombre, imagen: archivo, nivel: $('tlLevel').value, ancho: imagenNueva.w, alto: imagenNueva.h });
        guardar();
        sugerencias();
        pintarTierlist();
        $('tlAddForm').reset();
        $('tlPreview').innerHTML = '<span>Sin imagen</span>';
        imagenNueva = null;
        mostrarToast(`${nombre} añadido a la tierlist`);
    });

    $('tlLevels').addEventListener('change', (e) => {
        const fila = e.target.closest('.tl-row');
        if (!fila) return;
        const d = tier.decks[Number(fila.dataset.i)];
        if (e.target.classList.contains('tl-level-select')) {
            // Al cambiar de nivel, el deck pasa al final de su nuevo nivel
            tier.decks.splice(Number(fila.dataset.i), 1);
            d.nivel = e.target.value;
            tier.decks.push(d);
        }
        if (e.target.classList.contains('tl-name')) {
            const nuevo = e.target.value.trim();
            if (!nuevo || nuevo === d.nombre) { e.target.value = d.nombre; return; }
            const enTorneos = torneos.torneos.some(t => t.partidas.some(p => p[1] === d.nombre || p[2] === d.nombre));
            if (enTorneos && confirm(`¿Cambiar también ${d.nombre} por ${nuevo} en los torneos? Así conserva su récord.`)) renombrar(d.nombre, nuevo);
            d.nombre = nuevo;
            pintarNombres();
        }
        guardar();
        sugerencias();
        pintarTierlist();
    });

    $('tlLevels').addEventListener('click', (e) => {
        const fila = e.target.closest('.tl-row');
        if (!fila) return;
        const i = Number(fila.dataset.i);
        const d = tier.decks[i];
        if (e.target.dataset.mover) {
            const mismos = tier.decks.map((x, j) => ({ x, j })).filter(o => o.x.nivel === d.nivel).map(o => o.j);
            const pos = mismos.indexOf(i);
            const otro = mismos[pos + Number(e.target.dataset.mover)];
            if (otro === undefined) return;
            [tier.decks[i], tier.decks[otro]] = [tier.decks[otro], tier.decks[i]];
        } else if (e.target.hasAttribute('data-borrar')) {
            if (!confirm(`¿Quitar ${d.nombre} de la tierlist? Su récord en torneos se mantiene.`)) return;
            tier.decks.splice(i, 1);
            if (imagenes[d.imagen]) delete imagenes[d.imagen];
        } else {
            return;
        }
        guardar();
        pintarTierlist();
    });

    /* =========================================================
       PUBLICAR
       ========================================================= */
    /* =========================================================
       BANLIST
       ========================================================= */
    const API_CARTAS = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const BAN_NOMBRES = { 0: 'Prohibida', 1: 'Limitada', 2: 'Semi-limitada', 3: 'Sin límite' };
    const mapaBan = (cartas) => new Map(cartas.map(c => [c.id, c]));
    const banPub = () => mapaBan(parsearBan(publicado.banlist).cartas);
    let banImportada = null;    // banlist subida, pendiente de confirmar
    let resultados = [];        // última búsqueda en YGOPRODeck

    // Diferencias entre dos banlists: [{ id, name, antes, despues }] (3 = sin límite)
    function diffBan(cartas = ban.cartas, antes = banPub()) {
        const ahora = mapaBan(cartas);
        const out = [];
        ahora.forEach((c, id) => {
            const a = antes.get(id)?.status ?? 3;
            if (a !== c.status) out.push({ id, name: c.name, antes: a, despues: c.status });
        });
        antes.forEach((c, id) => { if (!ahora.has(id)) out.push({ id, name: c.name, antes: c.status, despues: 3 }); });
        return out.sort((x, y) => x.name.localeCompare(y.name));
    }

    function ponerEstado(id, status, name) {
        id = String(id);
        const i = ban.cartas.findIndex(c => c.id === id);
        if (status === 3) {
            if (i >= 0) ban.cartas.splice(i, 1);
        } else if (i >= 0) {
            ban.cartas[i].status = status;
        } else {
            ban.cartas.push({ id, status, name: name || `ID ${id}` });
        }
        guardar();
        pintarBanlist();
        pintarResultados();
    }

    const opcionesEstado = (actual) => [0, 1, 2, 3]
        .map(n => `<option value="${n}"${n === actual ? ' selected' : ''}>${BAN_NOMBRES[n]}</option>`).join('');

    function pintarBanlist() {
        if (!ban) return;
        if (document.activeElement !== $('banTitle')) $('banTitle').value = ban.titulo.replace(/^!/, '');
        $('banTotal').textContent = ban.cartas.length;
        const pub = banPub();
        const q = normalizar($('banFilterList').value.trim());
        $('banList').innerHTML = BAN_SECCIONES.map(([n]) => {
            const lista = ban.cartas
                .filter(c => c.status === n && (!q || normalizar(c.name).includes(q) || c.id.includes(q)))
                .sort((a, b) => a.name.localeCompare(b.name));
            const filas = lista.map(c => {
                const cambiada = (pub.get(c.id)?.status ?? 3) !== c.status;
                return `<li class="ban-row${cambiada ? ' is-changed' : ''}">
                    <a href="https://ygoprodeck.com/card/?search=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${esc(c.name)}</a>
                    <select data-estado="${esc(c.id)}" aria-label="Copias de ${esc(c.name)}">${opcionesEstado(c.status)}</select>
                    <button type="button" class="ban-x" data-quitar="${esc(c.id)}" aria-label="Quitar ${esc(c.name)} de la banlist" title="Quitar (vuelve a 3 copias)">×</button>
                </li>`;
            }).join('');
            return `<section class="ban-col ban-col-${n}">
                <h3>${BAN_STATUS[n].titulo} <span class="tier-count">${lista.length}</span></h3>
                <ul>${filas || '<li class="adm-hint">Ninguna</li>'}</ul>
            </section>`;
        }).join('');

        const d = diffBan(ban.cartas, pub);
        $('banDiffCard').hidden = !d.length;
        $('banDiff').innerHTML = d.map(x => `<li>
            <strong>${esc(x.name)}</strong>
            <span class="ban-from">${BAN_NOMBRES[x.antes]}</span> → <span class="ban-to ban-s${x.despues}">${BAN_NOMBRES[x.despues]}</span>
            <button type="button" class="ban-undo" data-deshacer="${esc(x.id)}">Deshacer</button>
        </li>`).join('');
    }

    $('banList').addEventListener('change', (e) => {
        const id = e.target.dataset.estado;
        if (id) ponerEstado(id, Number(e.target.value));
    });
    $('banList').addEventListener('click', (e) => {
        const id = e.target.closest('[data-quitar]')?.dataset.quitar;
        if (!id) return;
        const c = ban.cartas.find(x => x.id === id);
        ponerEstado(id, 3);
        mostrarToast(`${c?.name || id} sale de la banlist (3 copias)`);
    });
    $('banDiff').addEventListener('click', (e) => {
        const id = e.target.closest('[data-deshacer]')?.dataset.deshacer;
        if (!id) return;
        const p = banPub().get(id);
        ponerEstado(id, p ? p.status : 3, p?.name);
    });
    $('banUndoAll').addEventListener('click', () => {
        if (!confirm('¿Deshacer todos los cambios de la banlist y volver a la publicada?')) return;
        ban = parsearBan(publicado.banlist);
        guardar();
        pintarBanlist();
        pintarResultados();
    });
    $('banFilterList').addEventListener('input', pintarBanlist);
    $('banTitle').addEventListener('input', () => {
        ban.titulo = `!${$('banTitle').value.trim() || 'XYZ Banlist'}`;
        guardar();
    });
    $('banDownload').addEventListener('click', () => descargar(BANLIST_FILE, serializarBan(ban), 'text/plain'));

    /* ----- Buscar una carta y elegir sus copias ----- */
    let esperaBusqueda = null;
    let busqueda = 0;
    $('banFind').addEventListener('input', () => {
        clearTimeout(esperaBusqueda);
        esperaBusqueda = setTimeout(buscarCarta, 350);
    });
    $('banFind').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(esperaBusqueda); buscarCarta(); }
    });

    async function buscarCarta() {
        const q = $('banFind').value.trim();
        const yo = ++busqueda;
        const esId = /^\d+$/.test(q);
        if (!esId && q.length < 3) {
            resultados = [];
            $('banResults').innerHTML = q ? '<li class="adm-hint">Escribe al menos 3 letras.</li>' : '';
            return;
        }
        $('banResults').innerHTML = '<li class="adm-hint">Buscando…</li>';
        let mensaje = '';
        let cartas = [];
        try {
            const r = await fetch(`${API_CARTAS}?${esId ? 'id' : 'fname'}=${encodeURIComponent(q)}`);
            if (r.ok) cartas = (await r.json()).data || [];
            else if (r.status !== 400) mensaje = `YGOPRODeck ha respondido con un error (${r.status}).`;
        } catch {
            mensaje = 'No se ha podido conectar con YGOPRODeck. Comprueba la conexión.';
        }
        if (yo !== busqueda) return;   // ya hay una búsqueda más reciente
        const nq = normalizar(q);
        const orden = (c) => (normalizar(c.name) === nq ? 0 : normalizar(c.name).startsWith(nq) ? 1 : 2);
        resultados = cartas
            .sort((a, b) => orden(a) - orden(b) || a.name.localeCompare(b.name))
            .slice(0, 12)
            .map(c => ({ id: String(c.id), name: c.name, tipo: c.type, img: c.card_images?.[0]?.image_url_small || '' }));
        if (!resultados.length) {
            $('banResults').innerHTML = `<li class="adm-hint">${mensaje || 'No se ha encontrado ninguna carta con ese nombre. Prueba con el nombre en inglés o con su ID.'}</li>`;
            return;
        }
        pintarResultados();
    }

    function pintarResultados() {
        if (!resultados.length) return;
        const actual = mapaBan(ban.cartas);
        $('banResults').innerHTML = resultados.map(c => {
            const st = actual.get(c.id)?.status ?? 3;
            return `<li class="ban-result">
                ${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" width="42" height="61" />` : '<span class="ban-noimg"></span>'}
                <div class="ban-result-info"><strong>${esc(c.name)}</strong><span>${esc(c.tipo || '')} · ID ${esc(c.id)}</span></div>
                <div class="ban-choice" role="group" aria-label="Copias de ${esc(c.name)}">
                    ${[0, 1, 2, 3].map(n => `<button type="button" class="ban-s${n}" data-poner="${esc(c.id)}" data-n="${n}" aria-pressed="${n === st}">${n === 3 ? '3 (sin límite)' : BAN_NOMBRES[n]}</button>`).join('')}
                </div>
            </li>`;
        }).join('');
    }

    $('banResults').addEventListener('click', (e) => {
        const b = e.target.closest('[data-poner]');
        if (!b) return;
        const c = resultados.find(x => x.id === b.dataset.poner);
        const n = Number(b.dataset.n);
        const antes = mapaBan(ban.cartas).get(c.id)?.status ?? 3;
        if (antes === n) return;
        ponerEstado(c.id, n, c.name);
        mostrarToast(`${c.name}: ${BAN_NOMBRES[antes]} → ${BAN_NOMBRES[n]}`);
    });

    /* ----- Subir o pegar una banlist completa ----- */
    // Las líneas sin nombre ("12345 1") se completan con la API
    async function completarNombres(cartas) {
        const sin = cartas.filter(c => /^ID \d+$/.test(c.name));
        for (let i = 0; i < sin.length; i += 40) {
            const lote = sin.slice(i, i + 40);
            try {
                const r = await fetch(`${API_CARTAS}?id=${lote.map(c => c.id).join(',')}`);
                if (!r.ok) continue;
                const nombres = new Map();
                ((await r.json()).data || []).forEach(d => (d.card_images || [{ id: d.id }]).forEach(img => nombres.set(String(img.id), d.name)));
                lote.forEach(c => { if (nombres.has(c.id)) c.name = nombres.get(c.id); });
            } catch { /* se quedan como "ID ..." */ }
        }
    }

    async function prepararImportacion(texto) {
        const caja = $('banImport');
        caja.hidden = false;
        const nueva = parsearBan(texto);
        if (!nueva.cartas.length) {
            banImportada = null;
            caja.innerHTML = '<p class="adm-hint">No se ha encontrado ninguna carta. Cada línea debe tener la forma <code>27204311 0 --Nibiru, the Primal Being</code>.</p>';
            return;
        }
        caja.innerHTML = '<p class="adm-hint">Leyendo la banlist…</p>';
        await completarNombres(nueva.cartas);
        banImportada = nueva;
        const d = diffBan(nueva.cartas, mapaBan(ban.cartas));
        const cuenta = (n) => nueva.cartas.filter(c => c.status === n).length;
        const mostrar = d.slice(0, 60);
        caja.innerHTML = `
            <p><strong>${esc(nueva.titulo.replace(/^!/, ''))}</strong>: ${cuenta(0)} prohibidas, ${cuenta(1)} limitadas y ${cuenta(2)} semi-limitadas.
            ${d.length ? `Respecto a tu banlist actual cambian <strong>${d.length}</strong> ${d.length === 1 ? 'carta' : 'cartas'}:` : 'Es igual que tu banlist actual.'}</p>
            ${d.length ? `<ul class="ban-diff">${mostrar.map(x => `<li><strong>${esc(x.name)}</strong> <span class="ban-from">${BAN_NOMBRES[x.antes]}</span> → <span class="ban-to ban-s${x.despues}">${BAN_NOMBRES[x.despues]}</span></li>`).join('')}${d.length > mostrar.length ? `<li class="adm-hint">… y ${d.length - mostrar.length} más</li>` : ''}</ul>` : ''}
            <div class="ed-row-actions">
                <button type="button" class="button button-primary" id="banImportApply"${d.length || nueva.titulo !== ban.titulo ? '' : ' disabled'}>Sustituir la banlist por esta</button>
                <button type="button" class="button button-secondary" id="banImportCancel">Cancelar</button>
            </div>`;
    }

    $('banFile').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 1024 * 1024) { mostrarToast('El archivo es demasiado grande para ser una banlist'); return; }
        await prepararImportacion(await f.text());
        e.target.value = '';
    });
    $('banPasteApply').addEventListener('click', () => {
        const t = $('banPaste').value;
        if (!t.trim()) { $('banPaste').focus(); return; }
        prepararImportacion(t);
    });
    $('banImport').addEventListener('click', (e) => {
        if (e.target.id === 'banImportCancel') {
            banImportada = null;
            $('banImport').hidden = true;
        }
        if (e.target.id === 'banImportApply' && banImportada) {
            ban = banImportada;
            banImportada = null;
            $('banImport').hidden = true;
            $('banPaste').value = '';
            guardar();
            pintarBanlist();
            pintarResultados();
            mostrarToast('Banlist sustituida en tu borrador. Revisa los cambios y publícala.');
        }
    });

    function pintarCambios() {
        if (!torneos || !tier || !ban) return;
        const c = cambios();
        const items = [];
        if (c.torneos) items.push('Torneos y resultados (<code>datos/torneos.json</code>)');
        if (c.tierlist) items.push('Tierlist (<code>datos/tierlist.js</code>)');
        if (c.banlist) {
            const n = diffBan().length;
            items.push(`Banlist: ${n} ${n === 1 ? 'carta cambia' : 'cartas cambian'} (<code>${esc(RUTA_BANLIST)}</code>)`);
        }
        Object.keys(imagenes).forEach(f => items.push(`Imagen nueva <code>tierlist/${esc(f)}</code>`));
        $('pubChanges').innerHTML = items.length ? items.map(x => `<li>${x}</li>`).join('') : '<li class="adm-hint">No hay nada pendiente.</li>';
        $('pubPublish').disabled = !items.length;
        $('pubDiscard').disabled = !items.length;
    }

    function pintarGH() {
        const c = GH.config();
        $('ghOwner').value = c.owner;
        $('ghRepo').value = c.repo;
        $('ghBranch').value = c.branch;
        $('ghToken').value = '';
        $('ghToken').placeholder = c.token ? 'Token guardado (escribe otro para cambiarlo)' : 'github_pat_…';
        $('ghStatus').textContent = c.token ? `Conectado a ${c.owner}/${c.repo} (${c.branch}).` : 'Sin conectar: añade un token para publicar desde aquí.';
    }

    $('ghForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = { owner: $('ghOwner').value.trim(), repo: $('ghRepo').value.trim(), branch: $('ghBranch').value.trim() };
        if ($('ghToken').value.trim()) datos.token = $('ghToken').value.trim();
        GH.guardar(datos);
        pintarGH();
        if (!GH.listo()) { $('ghStatus').textContent = 'Datos guardados. Falta el token para poder publicar.'; return; }
        $('ghStatus').textContent = 'Comprobando…';
        try {
            await GH.probar();
            $('ghStatus').textContent = `Conectado a ${datos.owner}/${datos.repo} (${datos.branch}) con permiso para publicar.`;
            mostrarToast('Conexión con GitHub correcta');
        } catch (err) {
            $('ghStatus').textContent = err.message;
        }
    });
    $('ghForget').addEventListener('click', () => {
        GH.olvidarToken();
        pintarGH();
        mostrarToast('Token borrado de este navegador');
    });

    $('pubPublish').addEventListener('click', async () => {
        if (!GH.listo()) {
            $('pubResult').textContent = 'Primero conecta GitHub con tu token (abajo), o descarga los archivos y súbelos a mano.';
            $('ghToken').focus();
            return;
        }
        const btn = $('pubPublish');
        btn.disabled = true;
        $('pubResult').textContent = 'Publicando…';
        try {
            const c = cambios();
            // ¿Alguien ha publicado después de que empezaras a editar?
            const base = XYZ.leer(BASE_KEY, null);
            const remoto = await Promise.all([GH.leerArchivo('datos/torneos.json'), GH.leerArchivo('datos/tierlist.js'), GH.leerArchivo(RUTA_BANLIST)]);
            const remT = JSON.parse(remoto[0].texto);
            const remL = TL.parsear(remoto[1].texto);
            const tmpT = torneos, tmpL = tier;
            torneos = remT; tier = remL;
            const remotoNorm = { torneos: serializarTorneos(), tierlist: TL.serializar(remL), banlist: serializarBan(parsearBan(remoto[2].texto)) };
            torneos = tmpT; tier = tmpL;
            const ajenos = base && ((c.torneos && huella(remotoNorm.torneos) !== base.torneos)
                || (c.tierlist && huella(remotoNorm.tierlist) !== base.tierlist)
                || (c.banlist && base.banlist && huella(remotoNorm.banlist) !== base.banlist));
            if (ajenos && !confirm('Alguien ha publicado cambios después de que empezaras a editar. Si sigues, los tuyos los sustituyen. ¿Publicar igualmente?')) {
                $('pubResult').textContent = 'Publicación cancelada. Descarta tus cambios para cargar la versión nueva, o publica igualmente.';
                return;
            }
            const archivos = [];
            if (c.torneos) archivos.push({ ruta: 'datos/torneos.json', texto: serializarTorneos() });
            if (c.tierlist) archivos.push({ ruta: 'datos/tierlist.js', texto: TL.serializar(tier) });
            if (c.banlist) archivos.push({ ruta: RUTA_BANLIST, texto: serializarBan(ban) });
            Object.entries(imagenes).forEach(([f, url]) => {
                if (tier.decks.some(d => d.imagen === f)) archivos.push({ ruta: `tierlist/${f}`, base64: url.split(',')[1] });
            });
            const partes = [c.torneos && 'torneos', c.tierlist && 'tierlist', c.banlist && 'banlist'].filter(Boolean);
            const mensaje = $('pubMessage').value.trim() || `Actualizar ${partes.join(', ').replace(/, ([^,]*)$/, ' y $1') || 'imágenes'} desde el panel`;
            const res = await GH.publicar(archivos, mensaje);
            publicado = { torneos: serializarTorneos(), tierlist: TL.serializar(tier), banlist: serializarBan(ban) };
            imagenes = {};
            try {
                [TORNEOS.BORRADOR_KEY, TL.BORRADOR_KEY, TL.IMAGENES_KEY, BANLIST_BORRADOR_KEY, BASE_KEY, TORNEOS.USAR_BORRADOR_KEY].forEach(k => localStorage.removeItem(k));
            } catch { /* nada */ }
            $('pubMessage').value = '';
            $('pubResult').innerHTML = `Publicado. La web se actualiza en uno o dos minutos. <a href="${esc(res.url)}" target="_blank" rel="noopener">Ver el cambio en GitHub</a>`;
            pintarTierlist();
            pintarBanlist();
            estado();
            mostrarToast('Publicado en GitHub');
        } catch (err) {
            $('pubResult').textContent = `No se ha publicado: ${err.message}`;
        } finally {
            pintarCambios();
        }
    });

    $('pubDiscard').addEventListener('click', async () => {
        if (!confirm('¿Descartar todos tus cambios sin publicar (torneos, tierlist, banlist e imágenes nuevas)?')) return;
        try {
            [TORNEOS.BORRADOR_KEY, TL.BORRADOR_KEY, TL.IMAGENES_KEY, BANLIST_BORRADOR_KEY, BASE_KEY, TORNEOS.USAR_BORRADOR_KEY].forEach(k => localStorage.removeItem(k));
        } catch { /* nada */ }
        $('pubResult').textContent = '';
        await iniciar();
        mostrarToast('Cambios descartados');
    });

    $('dlTorneos').addEventListener('click', () => descargar('torneos.json', serializarTorneos(), 'application/json'));
    $('dlTierlist').addEventListener('click', () => {
        descargar('tierlist.js', TL.serializar(tier), 'text/javascript');
        if (Object.keys(imagenes).length) mostrarToast('Las imágenes nuevas solo se publican con GitHub conectado');
    });
    $('dlBanlist').addEventListener('click', () => descargar(BANLIST_FILE, serializarBan(ban), 'text/plain'));

    window.addEventListener('hashchange', () => {
        const n = Number((location.hash.match(/^#torneo-(\d+)$/) || [])[1]);
        if (torneos && torneos.torneos.some(t => t.id === n)) {
            actual = n;
            elegirTab('torneos');
            pintarSelector();
            pintarTorneo();
        } else if (['#tierlist', '#banlist', '#publicar'].includes(location.hash)) {
            elegirTab(location.hash.slice(1));
        }
    });

    iniciar();
})();
