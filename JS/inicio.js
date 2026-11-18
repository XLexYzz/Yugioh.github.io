/* Portada: último campeón, ranking por victorias y últimos torneos con datos reales. */
(() => {
    const champ = document.getElementById('heroChamp');
    if (!champ) return;
    const esc = XYZ.escapar;
    const p = `${rutaBase()}porfolio/`;

    TORNEOS.cargar().then(datos => {
        const ultimo = datos.torneos[datos.torneos.length - 1];
        const m = datos.mazos.get(ultimo.campeon);
        const info = m.info;
        champ.href = `${p}torneos.html#torneo-${ultimo.id}`;
        champ.innerHTML = `
            ${info ? `<img class="champ-img" src="${info.img}" alt="" width="${info.ancho}" height="${info.alto}" />` : TORNEOS.avatar(m.nombre, 'champ-img champ-img-empty')}
            <span class="champ-body">
                <span class="champ-label">Campeón del ${esc(ultimo.nombre)}</span>
                <span class="champ-name">${TORNEOS.etiqueta(m.nombre)}</span>
                <span class="champ-sub">Ganó la final a ${TORNEOS.etiqueta(ultimo.finalista)}. Lleva ${m.victorias}–${m.derrotas} en ${m.torneos} ${m.torneos === 1 ? 'torneo' : 'torneos'}.</span>
            </span>`;

        const top = [...datos.mazos.values()].sort((a, b) => b.victorias - a.victorias || b.porcentaje - a.porcentaje).slice(0, 5);
        document.getElementById('heroRanking').innerHTML = top.map(x => `
            <li>
                <a href="${TORNEOS.enlaceMazo(x.nombre)}">
                    ${TORNEOS.avatar(x.nombre, 'mini-img')}
                    <span class="mini-name">${TORNEOS.etiqueta(x.nombre)}</span>
                    <span class="mini-record"><b>${x.victorias}</b>–${x.derrotas}</span>
                    ${x.titulos ? `<span class="mini-titles" title="${x.titulos} ${x.titulos === 1 ? 'título' : 'títulos'}">${x.titulos}</span>` : '<span></span>'}
                </a>
            </li>`).join('');

        document.getElementById('recentTours').innerHTML = datos.torneos.slice(-3).reverse().map(t => `
            <a class="recent-tour" href="${p}torneos.html#torneo-${t.id}">
                ${TORNEOS.avatar(t.campeon, 'recent-img')}
                <span class="recent-body">
                    <span class="recent-name">${esc(t.nombre)}</span>
                    <span class="recent-champ">${TORNEOS.etiqueta(t.campeon)}</span>
                    <span class="recent-sub">Final contra ${TORNEOS.etiqueta(t.finalista)}, ${t.jugadores} mazos</span>
                </span>
            </a>`).join('');
    }).catch(() => {
        champ.innerHTML = '<span class="champ-body"><span class="champ-label">Torneos</span><span class="champ-name">Ver todos los resultados</span></span>';
    });
})();
