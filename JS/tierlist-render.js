/* Construye la tierlist a partir de datos/tierlist.js. Se carga con defer ANTES
   de script.js y tiermaker.js, que leen las figuras ya creadas. */
(() => {
    const cont = document.querySelector('.tierlist-categories');
    if (!cont) return;
    const d = TIERLIST_XYZ.datos();
    const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const filtro = document.querySelector('.tierlist-filter');
    if (filtro) {
        filtro.innerHTML = '<button class="active" data-tier="all">Todo</button>'
            + d.niveles.map(n => `<button data-tier="${esc(n.id)}">${esc(n.nombre)}</button>`).join('');
    }

    let primera = true;
    cont.innerHTML = d.niveles.map(n => {
        const decks = d.decks.filter(k => k.nivel === n.id);
        return `<section class="tierlist-category" data-tier="${esc(n.id)}">
            <h3>${esc(n.nombre)}</h3>
            <div class="tierlist-grid">
                ${decks.map(k => {
                    const carga = primera ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
                    primera = false;
                    return `<figure data-imagen="${esc(k.imagen)}"><img src="${esc(TIERLIST_XYZ.src(k))}" alt="Deck ${esc(k.nombre)}" width="${k.ancho}" height="${k.alto}" decoding="async" ${carga} /><figcaption>${esc(k.nombre)}</figcaption></figure>`;
                }).join('')}
            </div>
        </section>`;
    }).join('');

    if (!d.decks.length) {
        cont.innerHTML = '<p class="empty-state">No se ha podido cargar la tierlist. Recarga la página.</p>';
    }
})();
