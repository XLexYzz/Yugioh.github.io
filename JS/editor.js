/* Editor de resultados: confirma nombres "?", corrige partidas, crea torneos
   y exporta datos/torneos.json. Todo se guarda como borrador en localStorage. */
(() => {
    const $ = (id) => document.getElementById(id);
    if (!$('edRounds')) return;

    const esc = XYZ.escapar;
    let datos = null;      // { version, nota, torneos: [...] }
    let actual = null;     // id del torneo abierto
    let resaltado = null;  // nombre resaltado en el cuadro
    let hayCambios = false;

    /* ---------- Carga y guardado ---------- */
    async function cargarPublicado() {
        const r = await fetch(`${rutaBase()}datos/torneos.json`, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`No se ha podido leer datos/torneos.json (${r.status})`);
        return r.json();
    }

    function guardar() {
        hayCambios = true;
        XYZ.guardar(TORNEOS.BORRADOR_KEY, datos);
        XYZ.guardar('xyz-borrador-descargado', false);
        estado();
    }

    function nombresDudosos() {
        const usos = new Map();
        datos.torneos.forEach(t => t.partidas.forEach(([, a, b]) => {
            [a, b].forEach(n => {
                const u = usos.get(n) || new Set();
                u.add(t.id);
                usos.set(n, u);
            });
        }));
        return usos;
    }

    function estado() {
        const pendientes = [...nombresDudosos().keys()].filter(TORNEOS.dudoso).length;
        const borrador = !!TORNEOS.borrador();
        $('edStatus').innerHTML = borrador
            ? `<strong>Borrador guardado en este navegador.</strong> ${pendientes ? `Quedan ${pendientes} nombres por confirmar.` : 'No queda ningún nombre por confirmar.'} Descarga el archivo para publicarlo.`
            : `Sin cambios: estás viendo los datos publicados. ${pendientes} nombres por confirmar.`;
        $('edPreview').checked = !!XYZ.leer(TORNEOS.USAR_BORRADOR_KEY, false) && borrador;
        $('edPreview').disabled = !borrador;
    }

    /* ---------- Serializar (una partida por línea, fácil de revisar en GitHub) ---------- */
    function serializar() {
        const lineas = ['{', '  "version": 1,', `  "nota": ${JSON.stringify(datos.nota || '')},`, '  "torneos": ['];
        datos.torneos.forEach((t, i) => {
            lineas.push('    {');
            Object.entries(t).filter(([k]) => k !== 'partidas').forEach(([k, v]) => lineas.push(`      ${JSON.stringify(k)}: ${JSON.stringify(v)},`));
            lineas.push('      "partidas": [');
            lineas.push(t.partidas.map(p => `        ${JSON.stringify(p)}`).join(',\n'));
            lineas.push('      ]');
            lineas.push(`    }${i < datos.torneos.length - 1 ? ',' : ''}`);
        });
        lineas.push('  ]', '}', '');
        return lineas.join('\n');
    }

    /* ---------- Nombres por confirmar ---------- */
    function sugerencias() {
        const nombres = new Set(Object.keys(TORNEOS.TIERLIST));
        nombresDudosos().forEach((_, n) => { if (!TORNEOS.dudoso(n)) nombres.add(n); });
        $('edDecks').innerHTML = [...nombres].sort((a, b) => a.localeCompare(b)).map(n => `<option value="${esc(n)}"></option>`).join('');
    }

    function pintarNombres() {
        const todos = $('edShowAll').checked;
        const usos = nombresDudosos();
        const lista = [...usos.entries()]
            .filter(([n]) => todos || TORNEOS.dudoso(n))
            .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
        if (!lista.length) {
            $('edNames').innerHTML = '<p class="empty-state">No queda ningún nombre por confirmar. Descarga torneos.json para publicar los cambios.</p>';
            return;
        }
        $('edNames').innerHTML = lista.map(([n, ts]) => `
            <form class="ed-name ${TORNEOS.dudoso(n) ? 'is-pending' : ''}" data-nombre="${esc(n)}">
                <div class="ed-name-info">
                    ${TORNEOS.avatar(n, 'ed-name-img')}
                    <span class="ed-name-text">${TORNEOS.etiqueta(n)}</span>
                    <span class="ed-name-uses">${[...ts].sort((a, b) => a - b).map(id => `<button type="button" class="ed-chip" data-ver="${id}" data-nombre="${esc(n)}">T${id}</button>`).join('')}</span>
                </div>
                <label class="ed-name-input">
                    <span class="visually-hidden">Nombre correcto para ${esc(TORNEOS.visible(n))}</span>
                    <input list="edDecks" placeholder="${TORNEOS.dudoso(n) ? 'Mazo correcto…' : 'Renombrar…'}" autocomplete="off" />
                </label>
                <button type="submit" class="button button-secondary">Aplicar</button>
            </form>`).join('');
    }

    function renombrar(viejo, nuevo, soloTorneo = null) {
        let cambios = 0;
        datos.torneos.forEach(t => {
            if (soloTorneo && t.id !== soloTorneo) return;
            t.partidas.forEach(p => {
                if (p[1] === viejo) { p[1] = nuevo; cambios++; }
                if (p[2] === viejo) { p[2] = nuevo; cambios++; }
            });
        });
        return cambios;
    }

    $('edNames').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const viejo = form.dataset.nombre;
        const nuevo = form.querySelector('input').value.trim();
        if (!nuevo) {
            form.querySelector('input').focus();
            mostrarToast('Escribe el nombre correcto del mazo');
            return;
        }
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
        $('partidas').scrollIntoView({ behavior: 'smooth' });
    });

    $('edShowAll').addEventListener('change', pintarNombres);

    /* ---------- Torneo ---------- */
    function torneo() {
        return datos.torneos.find(t => t.id === actual);
    }

    function pintarSelector() {
        $('edTour').innerHTML = datos.torneos.map(t => `<option value="${t.id}">${esc(t.nombre)}${t.revisar ? ' (por revisar)' : ''}</option>`).join('');
        $('edTour').value = actual;
    }

    function pintarTorneo() {
        const t = torneo();
        if (!t) {
            $('edRounds').innerHTML = '<p class="empty-state">No hay torneos. Crea uno nuevo.</p>';
            $('edImage').removeAttribute('src');
            return;
        }
        if (t.imagen) {
            $('edImage').src = `${rutaBase()}torneos/${t.imagen}`;
            $('edImage').alt = `Bracket original del ${t.nombre}`;
            $('edImage').parentElement.parentElement.hidden = false;
        } else {
            $('edImage').parentElement.parentElement.hidden = true;
        }
        const total = Math.max(1, ...t.partidas.map(p => p[0]));
        let html = `<label class="ed-tour-name"><span>Nombre del torneo</span><input id="edTourName" value="${esc(t.nombre)}" /></label>`;
        if (t.revisar) {
            html += `<div class="tour-warning"><strong>Por revisar:</strong> ${esc(t.revisar)} <button type="button" class="ed-link" id="edClearNote">Marcar como revisado</button></div>`;
        }
        for (let r = 1; r <= total; r++) {
            const filas = t.partidas.map((p, i) => ({ p, i })).filter(x => x.p[0] === r);
            html += `<section class="ed-round"><h3>${TORNEOS.nombreRonda(r, total)} <span class="tier-count">${filas.length}</span></h3>
                ${filas.map(({ p, i }) => `
                    <div class="ed-match ${resaltado && (p[1] === resaltado || p[2] === resaltado) ? 'is-hl' : ''}" data-i="${i}">
                        <input class="ed-deck ${TORNEOS.dudoso(p[1]) ? 'is-pending' : ''}" data-lado="1" list="edDecks" value="${esc(p[1])}" aria-label="Mazo A" />
                        <button type="button" class="ed-win ${p[3] === 0 ? 'on' : ''}" data-g="0" aria-pressed="${p[3] === 0}" title="Ganó el mazo A">V</button>
                        <button type="button" class="ed-win ${p[3] === 1 ? 'on' : ''}" data-g="1" aria-pressed="${p[3] === 1}" title="Ganó el mazo B">V</button>
                        <input class="ed-deck ${TORNEOS.dudoso(p[2]) ? 'is-pending' : ''}" data-lado="2" list="edDecks" value="${esc(p[2])}" aria-label="Mazo B" />
                        <button type="button" class="ed-del" aria-label="Borrar partida">×</button>
                    </div>`).join('')}
                <button type="button" class="ed-link" data-add="${r}">Añadir partida</button>
            </section>`;
        }
        const ultima = t.partidas.filter(p => p[0] === total);
        if (ultima.length > 1) {
            html += `<button type="button" class="button button-primary" id="edNextRound">Generar ${TORNEOS.nombreRonda(total + 1, total + 1 + Math.log2(ultima.length) - 1).toLowerCase()} con los ganadores</button>`;
        }
        $('edRounds').innerHTML = html;
        problemas();
    }

    function problemas() {
        const t = torneo();
        const lista = [];
        if (t) {
            const total = Math.max(...t.partidas.map(p => p[0]));
            if (t.partidas.filter(p => p[0] === total).length !== 1) lista.push('La última ronda debe tener una sola partida (la final).');
            for (let r = 2; r <= total; r++) {
                const ganadores = t.partidas.filter(p => p[0] === r - 1).map(p => p[1 + p[3]]);
                const enRonda = t.partidas.filter(p => p[0] === r).flatMap(p => [p[1], p[2]]);
                const restantes = [...ganadores];
                enRonda.forEach(n => {
                    const k = restantes.indexOf(n);
                    if (k >= 0) restantes.splice(k, 1);
                    else lista.push(`${TORNEOS.visible(n)} juega en ${TORNEOS.nombreRonda(r, total)} pero no ganó en la ronda anterior.`);
                });
                if (enRonda.length !== ganadores.length) {
                    lista.push(`${TORNEOS.nombreRonda(r, total)} tiene ${enRonda.length} mazos y deberían ser ${ganadores.length}.`);
                }
            }
            t.partidas.forEach(p => { if (!p[1].trim() || !p[2].trim()) lista.push(`Hay una partida de ${TORNEOS.nombreRonda(p[0], total)} sin mazo.`); });
        }
        $('edProblems').innerHTML = lista.map(x => `<li>${esc(x)}</li>`).join('');
    }

    $('edRounds').addEventListener('click', (e) => {
        const t = torneo();
        const fila = e.target.closest('.ed-match');
        if (e.target.closest('.ed-win') && fila) {
            t.partidas[Number(fila.dataset.i)][3] = Number(e.target.closest('.ed-win').dataset.g);
            guardar();
            pintarTorneo();
        } else if (e.target.closest('.ed-del') && fila) {
            if (!confirm('¿Borrar esta partida?')) return;
            t.partidas.splice(Number(fila.dataset.i), 1);
            guardar();
            pintarNombres();
            pintarTorneo();
        } else if (e.target.dataset.add) {
            t.partidas.push([Number(e.target.dataset.add), '?Nuevo mazo A', '?Nuevo mazo B', 0]);
            t.partidas.sort((a, b) => a[0] - b[0]);
            guardar();
            pintarNombres();
            pintarTorneo();
        } else if (e.target.id === 'edNextRound') {
            const total = Math.max(...t.partidas.map(p => p[0]));
            const ganadores = t.partidas.filter(p => p[0] === total).map(p => p[1 + p[3]]);
            for (let i = 0; i + 1 < ganadores.length; i += 2) t.partidas.push([total + 1, ganadores[i], ganadores[i + 1], 0]);
            guardar();
            pintarTorneo();
            mostrarToast('Ronda creada: marca los ganadores');
        } else if (e.target.id === 'edClearNote') {
            delete t.revisar;
            guardar();
            pintarSelector();
            pintarTorneo();
        }
    });

    $('edRounds').addEventListener('change', (e) => {
        const t = torneo();
        if (e.target.id === 'edTourName') {
            t.nombre = e.target.value.trim() || `Torneo ${t.id}`;
            guardar();
            pintarSelector();
            return;
        }
        const fila = e.target.closest('.ed-match');
        if (!fila || !e.target.classList.contains('ed-deck')) return;
        const p = t.partidas[Number(fila.dataset.i)];
        const lado = Number(e.target.dataset.lado);
        const viejo = p[lado];
        const nuevo = e.target.value.trim();
        if (!nuevo || nuevo === viejo) return;
        // Si el mazo sigue en rondas posteriores, se cambia también allí
        const cambiarTodo = t.partidas.some((q, j) => j !== Number(fila.dataset.i) && (q[1] === viejo || q[2] === viejo));
        if (cambiarTodo && confirm(`¿Cambiar ${TORNEOS.visible(viejo)} por ${nuevo} en todo este torneo?`)) renombrar(viejo, nuevo, t.id);
        else p[lado] = nuevo;
        guardar();
        sugerencias();
        pintarNombres();
        pintarTorneo();
    });

    $('edTour').addEventListener('change', () => {
        actual = Number($('edTour').value);
        resaltado = null;
        pintarTorneo();
        history.replaceState(null, '', `#torneo-${actual}`);
    });

    $('edZoom').addEventListener('input', () => {
        $('edImage').style.width = `${$('edZoom').value}%`;
    });

    /* ---------- Nuevo / borrar ---------- */
    $('edNew').addEventListener('click', () => {
        $('edNewForm').hidden = false;
        $('edEntrants').focus();
    });
    $('edCancel').addEventListener('click', () => { $('edNewForm').hidden = true; });
    $('edCreate').addEventListener('click', () => {
        const nombres = $('edEntrants').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (![4, 8, 16, 32, 64].includes(nombres.length)) {
            mostrarToast(`Hay ${nombres.length} participantes: tienen que ser 4, 8, 16 o 32`);
            return;
        }
        const id = Math.max(0, ...datos.torneos.map(t => t.id)) + 1;
        const partidas = [];
        for (let i = 0; i < nombres.length; i += 2) partidas.push([1, nombres[i], nombres[i + 1], 0]);
        datos.torneos.push({ id, nombre: `Torneo ${id}`, partidas });
        actual = id;
        $('edNewForm').hidden = true;
        $('edEntrants').value = '';
        guardar();
        pintarSelector();
        sugerencias();
        pintarNombres();
        pintarTorneo();
        mostrarToast(`Torneo ${id} creado: marca los ganadores de la primera ronda`);
    });
    $('edDelete').addEventListener('click', () => {
        const t = torneo();
        if (!t || !confirm(`¿Borrar el ${t.nombre} del borrador? Puedes recuperarlo con "Descartar borrador".`)) return;
        datos.torneos = datos.torneos.filter(x => x.id !== t.id);
        actual = datos.torneos[datos.torneos.length - 1]?.id ?? null;
        guardar();
        pintarSelector();
        pintarNombres();
        pintarTorneo();
    });

    /* ---------- Barra superior ---------- */
    $('edPreview').addEventListener('change', (e) => {
        XYZ.guardar(TORNEOS.USAR_BORRADOR_KEY, e.target.checked);
        mostrarToast(e.target.checked ? 'Las páginas de torneos y estadísticas usan ahora tu borrador' : 'Las páginas vuelven a usar los datos publicados');
    });

    $('edDownload').addEventListener('click', () => {
        const blob = new Blob([serializar()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'torneos.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        mostrarToast('torneos.json descargado: súbelo a la carpeta datos/ del repositorio');
    });

    $('edCopy').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(serializar());
            mostrarToast('JSON copiado');
        } catch {
            mostrarToast('No se ha podido copiar; usa Descargar torneos.json');
        }
    });

    $('edReset').addEventListener('click', async () => {
        if (!confirm('¿Descartar el borrador y volver a los datos publicados? Se perderán los cambios que no hayas descargado.')) return;
        try { localStorage.removeItem(TORNEOS.BORRADOR_KEY); localStorage.removeItem(TORNEOS.USAR_BORRADOR_KEY); } catch { /* nada */ }
        datos = await cargarPublicado();
        actual = datos.torneos[datos.torneos.length - 1]?.id ?? null;
        pintarSelector();
        sugerencias();
        pintarNombres();
        pintarTorneo();
        estado();
        mostrarToast('Borrador descartado');
    });

    window.addEventListener('beforeunload', (e) => {
        // El borrador ya está guardado; solo se avisa si nunca se ha descargado
        if (hayCambios && !XYZ.leer('xyz-borrador-descargado', false)) e.preventDefault();
    });
    $('edDownload').addEventListener('click', () => XYZ.guardar('xyz-borrador-descargado', true));

    /* ---------- Inicio ---------- */
    async function iniciar() {
        try {
            datos = TORNEOS.borrador() || await cargarPublicado();
        } catch (e) {
            $('edStatus').textContent = `${e.message}. Recarga la página.`;
            return;
        }
        const desdeHash = Number((location.hash.match(/^#torneo-(\d+)$/) || [])[1]);
        actual = datos.torneos.some(t => t.id === desdeHash) ? desdeHash : datos.torneos[datos.torneos.length - 1]?.id ?? null;
        pintarSelector();
        sugerencias();
        pintarNombres();
        pintarTorneo();
        estado();
        if (desdeHash) $('partidas').scrollIntoView();
    }

    iniciar();
})();
