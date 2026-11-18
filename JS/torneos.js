/* Página de torneos: selector de torneo y cuadro interactivo generado con los datos. */
(() => {
    const picker = document.getElementById('tourPicker');
    const view = document.getElementById('tourView');
    if (!picker || !view) return;

    const esc = XYZ.escapar;
    let datos = null;

    // gano: true, false o null (partida sin jugar)
    function slot(nombre, gano, jugador) {
        const clase = gano === null ? 'is-open' : gano ? 'is-win' : 'is-loss';
        return `<a class="slot ${clase}" href="${TORNEOS.enlaceMazo(nombre)}" data-mazo="${esc(nombre)}">
            ${TORNEOS.avatar(nombre, 'slot-img')}
            <span class="slot-name">${TORNEOS.etiqueta(nombre)}${jugador ? `<small>${esc(jugador)}</small>` : ''}</span>
            ${gano ? '<span class="slot-mark" aria-label="ganador">V</span>' : ''}
        </a>`;
    }

    function cabeceraEstado(t) {
        const fecha = t.fecha ? TORNEOS.fechaTexto(t.fecha) : '';
        if (t.estado === 'inscripcion') {
            return `<div class="tour-live"><span class="live-tag is-signup">Inscripción abierta</span><span>${fecha ? `Se juega el ${esc(fecha)}. ` : ''}${t.inscritos.length} ${t.inscritos.length === 1 ? 'participante apuntado' : 'participantes apuntados'}.</span></div>`;
        }
        return `<div class="tour-live"><span class="live-tag">En juego</span><span>${fecha ? `${esc(fecha[0].toUpperCase() + fecha.slice(1))}. ` : ''}${t.pendientes === 1 ? 'Queda 1 partida' : `Quedan ${t.pendientes} partidas`} por jugar en esta ronda.</span></div>`;
    }

    function listaInscritos(t) {
        if (!t.inscritos.length) return '<p class="empty-state">Todavía no hay nadie apuntado.</p>';
        return `<ol class="signup-list">${t.inscritos.map(i => `
            <li>${TORNEOS.avatar(i.mazo, 'slot-img')}<span><strong>${TORNEOS.etiqueta(i.mazo)}</strong>${i.jugador ? `<small>${esc(i.jugador)}</small>` : ''}</span></li>`).join('')}</ol>`;
    }

    function pintar(id) {
        const t = datos.torneos.find(x => x.id === id) || datos.torneos[datos.torneos.length - 1];
        picker.querySelectorAll('[role="tab"]').forEach(b => {
            const sel = Number(b.dataset.id) === t.id;
            b.setAttribute('aria-selected', sel);
            b.tabIndex = sel ? 0 : -1;
        });

        const campeon = t.campeon ? datos.mazos.get(t.campeon) : null;
        const jugadorDe = new Map(t.inscritos.filter(i => i.jugador).map(i => [i.mazo, i.jugador]));
        view.setAttribute('aria-labelledby', `tab-${t.id}`);
        view.innerHTML = `
            <header class="tour-head">
                <div class="tour-title">
                    <h2>${esc(t.nombre)}</h2>
                    <p>${t.jugadores} ${t.jugadores === 1 ? 'mazo' : 'mazos'}${t.partidas.length ? `, ${t.partidas.length} partidas` : ''}</p>
                </div>
                ${t.terminado ? `<a class="tour-champ" href="${TORNEOS.enlaceMazo(t.campeon)}">
                    ${TORNEOS.avatar(t.campeon, 'tour-champ-img')}
                    <span class="tour-champ-label">Campeón</span>
                    <span class="tour-champ-name">${TORNEOS.etiqueta(t.campeon)}</span>
                    <span class="tour-champ-sub">Ganó la final a ${TORNEOS.etiqueta(t.finalista)}${campeon ? `. Lleva ${campeon.titulos} ${campeon.titulos === 1 ? 'título' : 'títulos'}` : ''}</span>
                </a>` : cabeceraEstado(t)}
                <div class="tour-actions">
                    ${t.imagen ? `<button type="button" class="button button-secondary" data-original="${t.id}">Ver imagen original</button>` : ''}
                    <a class="button button-secondary" href="./editor.html#torneo-${t.id}">${t.terminado ? 'Corregir resultados' : 'Gestionar torneo'}</a>
                </div>
            </header>
            ${t.revisar ? `<p class="tour-warning"><strong>Por revisar:</strong> ${esc(t.revisar)}</p>` : ''}
            ${t.estado === 'inscripcion' ? `<div class="signup">${listaInscritos(t)}</div>` : ''}
            ${t.partidas.length ? `<div class="bracket-scroll" tabindex="0" aria-label="Cuadro del ${esc(t.nombre)}">
                <div class="bracket" style="--rounds:${t.rondas.length}">
                    ${t.rondas.map((r, i) => `
                        <section class="round ${r.numero === t.total ? 'is-final' : ''} ${i === t.rondas.length - 1 ? 'is-last' : ''}">
                            <h3>${r.nombre}</h3>
                            <div class="matches">
                                ${r.partidas.map(([, a, b, g]) => {
                                    const jugada = g === 0 || g === 1;
                                    return `<div class="match ${jugada ? '' : 'is-open'}">
                                        ${slot(a, jugada ? g === 0 : null, jugadorDe.get(a))}
                                        ${slot(b, jugada ? g === 1 : null, jugadorDe.get(b))}
                                    </div>`;
                                }).join('')}
                            </div>
                            ${r.numero === 1 && t.cuadro?.some(([, b]) => b === null) ? `<p class="round-note">Pase directo a la siguiente ronda: ${t.cuadro.filter(([, b]) => b === null).map(([a]) => TORNEOS.etiqueta(a)).join(', ')}</p>` : ''}
                        </section>`).join('')}
                </div>
            </div>` : ''}`;
        if (location.hash !== `#torneo-${t.id}`) history.replaceState(null, '', `#torneo-${t.id}`);
    }

    // Seguir el camino de un mazo por el cuadro
    function rastro(nombre) {
        view.querySelectorAll('.slot').forEach(s => s.classList.toggle('is-trace', !!nombre && s.dataset.mazo === nombre));
        view.querySelector('.bracket')?.classList.toggle('tracing', !!nombre);
    }
    view.addEventListener('mouseover', (e) => rastro(e.target.closest('.slot')?.dataset.mazo));
    view.addEventListener('focusin', (e) => rastro(e.target.closest('.slot')?.dataset.mazo));
    view.addEventListener('mouseleave', () => rastro(null));

    view.addEventListener('click', (e) => {
        const b = e.target.closest('[data-original]');
        if (!b) return;
        const figs = document.querySelectorAll('.image-grid figure');
        const fig = [...figs].find(f => f.querySelector('img')?.getAttribute('src').endsWith(`/torneo${b.dataset.original}.webp`));
        fig?.click();
    });

    picker.addEventListener('click', (e) => {
        const b = e.target.closest('[role="tab"]');
        if (b) pintar(Number(b.dataset.id));
    });
    picker.addEventListener('keydown', (e) => {
        const tabs = [...picker.querySelectorAll('[role="tab"]')];
        const i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        let j = null;
        if (e.key === 'ArrowRight') j = Math.min(tabs.length - 1, i + 1);
        if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
        if (j !== null) {
            e.preventDefault();
            tabs[j].focus();
            pintar(Number(tabs[j].dataset.id));
        }
    });

    async function iniciar() {
        try {
            datos = await TORNEOS.cargar();
        } catch (e) {
            view.innerHTML = `<p class="empty-state">${esc(e.message)}. Abajo tienes las imágenes originales.</p>`;
            return;
        }
        if (datos.borrador) {
            const aviso = document.getElementById('tourNotice');
            aviso.innerHTML = 'Estás viendo el <strong>borrador del editor</strong>, no los datos publicados.';
            aviso.hidden = false;
        }
        picker.innerHTML = datos.torneos.slice().reverse().map(t => `
            <button type="button" role="tab" id="tab-${t.id}" data-id="${t.id}" aria-controls="tourView" aria-selected="false" tabindex="-1">
                ${t.terminado ? TORNEOS.avatar(t.campeon, 'picker-img') : `<span class="picker-img picker-live">${t.estado === 'inscripcion' ? 'Inscripción' : 'En juego'}</span>`}
                <span class="picker-name">${esc(t.nombre)}</span>
                <span class="picker-champ">${t.terminado ? TORNEOS.etiqueta(t.campeon) : esc(t.fecha ? TORNEOS.fechaTexto(t.fecha) : 'Próximamente')}</span>
            </button>`).join('');
        const desdeHash = Number((location.hash.match(/^#torneo-(\d+)$/) || [])[1]);
        pintar(desdeHash || datos.torneos[datos.torneos.length - 1].id);
        picker.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
        window.addEventListener('hashchange', () => {
            const n = Number((location.hash.match(/^#torneo-(\d+)$/) || [])[1]);
            if (n) pintar(n);
        });
    }

    iniciar();
})();
