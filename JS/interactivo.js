/* Funciones globales que dependen de script.js (se carga antes, con defer):
   - Paleta de búsqueda (Ctrl+K o /) con páginas, herramientas, decks y cartas
   - Zoom y arrastre en el visor de imágenes
   - Vista previa de la carta al pasar el ratón por la banlist
   - ?q=texto rellena el buscador de la banlist o de la tierlist
*/

/* ===========================
   UTILIDADES COMPARTIDAS
   =========================== */
const XYZ = (() => {
    let banlistPromise = null;

    // Map id -> estado (0 prohibida, 1 limitada, 2 semi). Si no está, se permite a 3.
    function banlist() {
        if (!banlistPromise) {
            banlistPromise = fetch(`${rutaBase()}banlist/${encodeURIComponent(BANLIST_FILE)}`)
                .then(r => {
                    if (!r.ok) throw new Error(r.status);
                    return r.text();
                })
                .then(texto => parseBanlist(texto))
                .catch(() => []);
        }
        return banlistPromise;
    }

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function guardar(clave, valor) {
        try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
    }

    function leer(clave, defecto) {
        try {
            const v = localStorage.getItem(clave);
            return v === null ? defecto : JSON.parse(v);
        } catch {
            return defecto;
        }
    }

    const copias = { 0: 0, 1: 1, 2: 2 };
    const estados = {
        0: { nombre: 'Prohibida', clase: 'forbidden' },
        1: { nombre: 'Limitada', clase: 'limited' },
        2: { nombre: 'Semi-limitada', clase: 'semi' },
    };

    return { banlist, escapar, guardar, leer, copias, estados };
})();

/* ===========================
   PALETA DE BÚSQUEDA
   =========================== */
function setupCommandPalette() {
    const base = rutaBase();
    const p = `${base}porfolio/`;

    const estaticos = [
        { grupo: 'Páginas', titulo: 'Inicio', detalle: 'Portada', url: `${base}index.html` },
        { grupo: 'Páginas', titulo: 'Torneos', detalle: 'Brackets de cada torneo', url: `${p}torneos.html` },
        { grupo: 'Páginas', titulo: 'Banlist', detalle: 'Prohibidas, limitadas y semi-limitadas', url: `${p}banlist.html` },
        { grupo: 'Páginas', titulo: 'Reglas', detalle: 'Fases, campo y test', url: `${p}reglas.html` },
        { grupo: 'Páginas', titulo: 'Tierlist', detalle: 'Ranking de decks', url: `${p}tierlist.html` },
        { grupo: 'Páginas', titulo: 'Mazos', detalle: 'Comprueba si tu mazo es legal', url: `${p}mazos.html` },
        { grupo: 'Páginas', titulo: 'Herramientas', detalle: 'Puntos de vida, reloj, azar', url: `${p}herramientas.html` },
        { grupo: 'Herramientas', titulo: 'Contador de puntos de vida', detalle: 'Dos jugadores, historial y deshacer', url: `${p}herramientas.html#vida`, extra: 'lp life points calculadora' },
        { grupo: 'Herramientas', titulo: 'Temporizador de duelo', detalle: '10, 15, 20 o 30 minutos', url: `${p}herramientas.html#temporizador`, extra: 'reloj tiempo' },
        { grupo: 'Herramientas', titulo: 'Lanzar moneda o dado', detalle: 'Para efectos de azar', url: `${p}herramientas.html#azar`, extra: 'coin dice cara cruz' },
        { grupo: 'Herramientas', titulo: 'Probabilidad de robo', detalle: 'Calculadora hipergeométrica', url: `${p}herramientas.html#probabilidad`, extra: 'mano inicial robar' },
        { grupo: 'Herramientas', titulo: 'Validador de mazos', detalle: 'Pega un YDK o un enlace ydke://', url: `${p}mazos.html`, extra: 'deck ydk ydke omega legal' },
        { grupo: 'Herramientas', titulo: 'Crea tu tierlist', detalle: 'Arrastra los decks y descarga la imagen', url: `${p}tierlist.html#crea`, extra: 'tiermaker' },
        { grupo: 'Reglas', titulo: 'Fases del turno', detalle: 'Qué puedes hacer en cada fase', url: `${p}reglas.html#fases`, extra: 'draw standby main battle end' },
        { grupo: 'Reglas', titulo: 'Zonas del campo', detalle: 'Mapa interactivo del tablero', url: `${p}reglas.html#campo`, extra: 'cementerio extra deck zona' },
        { grupo: 'Reglas', titulo: 'Test de reglas', detalle: 'Pon a prueba lo que sabes', url: `${p}reglas.html#test`, extra: 'quiz preguntas' },
    ];

    let indice = null;

    async function construirIndice() {
        if (indice) return indice;
        const items = [...estaticos];
        const [cartas, decks] = await Promise.all([
            XYZ.banlist(),
            fetch(`${p}tierlist.html`).then(r => r.ok ? r.text() : '').catch(() => ''),
        ]);
        if (decks) {
            const doc = new DOMParser().parseFromString(decks, 'text/html');
            doc.querySelectorAll('.tierlist-category').forEach(cat => {
                const nivel = cat.querySelector('h3')?.textContent.trim() || '';
                cat.querySelectorAll('figcaption').forEach(fc => {
                    const nombre = fc.textContent.trim();
                    items.push({ grupo: 'Decks', titulo: nombre, detalle: nivel, url: `${p}tierlist.html?q=${encodeURIComponent(nombre)}` });
                });
            });
        }
        cartas.forEach(c => {
            items.push({ grupo: 'Cartas', titulo: c.name, detalle: XYZ.estados[c.status].nombre, url: `${p}banlist.html?q=${encodeURIComponent(c.name)}`, estado: c.status });
        });
        items.forEach(it => { it.clave = normalizar(`${it.titulo} ${it.detalle} ${it.extra || ''}`); });
        indice = items;
        return items;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'palette';
    dialog.setAttribute('aria-label', 'Buscar en la web');
    dialog.innerHTML = `
        <div class="palette-box">
            <label class="palette-input">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span class="visually-hidden">Buscar</span>
                <input type="text" placeholder="Busca una página, un deck o una carta" autocomplete="off" spellcheck="false"
                       role="combobox" aria-expanded="true" aria-controls="paletteList" aria-autocomplete="list" />
                <button type="button" class="palette-esc" aria-label="Cerrar">Esc</button>
            </label>
            <ul class="palette-list" id="paletteList" role="listbox"></ul>
            <p class="palette-hint"><kbd>↑</kbd><kbd>↓</kbd> para moverte, <kbd>Enter</kbd> para abrir</p>
        </div>`;
    document.body.appendChild(dialog);

    const input = dialog.querySelector('input');
    const list = dialog.querySelector('.palette-list');
    let resultados = [];
    let activo = 0;

    function puntuar(item, q) {
        if (!q) return item.grupo === 'Cartas' || item.grupo === 'Decks' ? -1 : 1;
        const t = normalizar(item.titulo);
        if (t === q) return 100;
        if (t.startsWith(q)) return 80;
        if (t.split(/[\s-]+/).some(w => w.startsWith(q))) return 60;
        if (item.clave.includes(q)) return 40;
        // Coincidencia difusa: todas las letras en orden
        let i = 0;
        for (const ch of t) if (ch === q[i]) i++;
        return i === q.length && q.length > 2 ? 10 : -1;
    }

    function pintar() {
        const q = normalizar(input.value.trim());
        const puntuados = (indice || estaticos.map(it => ({ ...it, clave: normalizar(`${it.titulo} ${it.detalle} ${it.extra || ''}`) })))
            .map(it => ({ it, s: puntuar(it, q) }));
        // Las coincidencias difusas solo aparecen si no hay ninguna directa
        const minimo = puntuados.some(r => r.s >= 40) ? 40 : 0;
        resultados = puntuados
            .filter(r => r.s >= minimo || (!q && r.s >= 0))
            .sort((a, b) => b.s - a.s)
            .slice(0, 40)
            .map(r => r.it);
        activo = 0;
        if (!resultados.length) {
            list.innerHTML = `<li class="palette-empty">Nada coincide con “${XYZ.escapar(input.value)}”. Prueba con el nombre de un deck o de una carta.</li>`;
            return;
        }
        let grupo = '';
        list.innerHTML = resultados.map((it, i) => {
            const cab = it.grupo !== grupo ? `<li class="palette-group" role="presentation">${it.grupo}</li>` : '';
            grupo = it.grupo;
            const marca = it.estado !== undefined ? `<span class="ban-dot ban-dot-${XYZ.estados[it.estado].clase}" aria-hidden="true"></span>` : '';
            return `${cab}<li role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === 0}">
                ${marca}<span class="palette-title">${XYZ.escapar(it.titulo)}</span>
                <span class="palette-detail">${XYZ.escapar(it.detalle)}</span></li>`;
        }).join('');
        marcar();
    }

    function marcar() {
        list.querySelectorAll('[role="option"]').forEach(li => {
            const sel = Number(li.dataset.i) === activo;
            li.setAttribute('aria-selected', sel);
            if (sel) li.scrollIntoView({ block: 'nearest' });
        });
        input.setAttribute('aria-activedescendant', `pal-${activo}`);
    }

    function ir(i) {
        const it = resultados[i];
        if (!it) return;
        dialog.close();
        const destino = new URL(it.url, location.href);
        if (destino.pathname === location.pathname && destino.hash && !destino.search) {
            location.hash = destino.hash;
            document.querySelector(destino.hash)?.scrollIntoView({ behavior: 'smooth' });
        } else {
            location.href = destino.href;
        }
    }

    function abrir() {
        if (dialog.open) return;
        input.value = '';
        pintar();
        dialog.showModal();
        input.focus();
        construirIndice().then(() => { if (dialog.open) pintar(); });
    }

    input.addEventListener('input', pintar);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); activo = Math.min(resultados.length - 1, activo + 1); marcar(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); activo = Math.max(0, activo - 1); marcar(); }
        if (e.key === 'Enter') { e.preventDefault(); ir(activo); }
    });
    list.addEventListener('click', (e) => {
        const li = e.target.closest('[data-i]');
        if (li) ir(Number(li.dataset.i));
    });
    list.addEventListener('mousemove', (e) => {
        const li = e.target.closest('[data-i]');
        if (li && Number(li.dataset.i) !== activo) { activo = Number(li.dataset.i); marcar(); }
    });
    dialog.querySelector('.palette-esc').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

    document.addEventListener('keydown', (e) => {
        const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            abrir();
        } else if (e.key === '/' && !escribiendo && !document.querySelector('.modal.active')) {
            e.preventDefault();
            abrir();
        }
    });

    // Botón en la cabecera
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'palette-trigger';
    trigger.setAttribute('aria-label', 'Buscar en la web (Ctrl+K)');
    trigger.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Buscar</span><kbd>Ctrl K</kbd>`;
    trigger.addEventListener('click', abrir);
    document.querySelector('.header-inner')?.appendChild(trigger);
}

/* ===========================
   ZOOM EN EL VISOR DE IMÁGENES
   =========================== */
function setupModalZoom() {
    const modal = document.querySelector('.modal');
    const img = modal?.querySelector('.modal-content img');
    if (!img) return;

    let escala = 1, x = 0, y = 0;
    const punteros = new Map();
    let pinchInicio = null;
    let gesto = false;

    const aplicar = () => {
        img.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
        img.classList.toggle('zoomed', escala > 1);
    };
    const reset = () => { escala = 1; x = 0; y = 0; aplicar(); };

    function zoomEn(nueva, cx, cy) {
        nueva = Math.min(5, Math.max(1, nueva));
        const r = img.getBoundingClientRect();
        // Mantiene fijo el punto bajo el cursor. El centro sin transformar es
        // el centro actual menos la traslación (la escala va desde el centro).
        const ox = cx - (r.left + r.width / 2 - x);
        const oy = cy - (r.top + r.height / 2 - y);
        const f = nueva / escala;
        x = ox - (ox - x) * f;
        y = oy - (oy - y) * f;
        escala = nueva;
        if (escala === 1) { x = 0; y = 0; }
        aplicar();
    }

    new MutationObserver(reset).observe(img, { attributes: true, attributeFilter: ['src'] });

    img.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomEn(escala * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    }, { passive: false });

    img.addEventListener('dblclick', (e) => {
        if (escala > 1) reset();
        else zoomEn(2.5, e.clientX, e.clientY);
    });

    img.addEventListener('pointerdown', (e) => {
        punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
        img.setPointerCapture(e.pointerId);
        if (punteros.size === 2) {
            const [a, b] = [...punteros.values()];
            pinchInicio = { d: Math.hypot(a.x - b.x, a.y - b.y), escala };
            gesto = true;
        }
    });
    img.addEventListener('pointermove', (e) => {
        const prev = punteros.get(e.pointerId);
        if (!prev) return;
        const actual = { x: e.clientX, y: e.clientY };
        punteros.set(e.pointerId, actual);
        if (punteros.size === 2 && pinchInicio) {
            const [a, b] = [...punteros.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomEn(pinchInicio.escala * d / pinchInicio.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        } else if (escala > 1) {
            x += actual.x - prev.x;
            y += actual.y - prev.y;
            gesto = true;
            aplicar();
        }
    });
    const soltar = (e) => {
        punteros.delete(e.pointerId);
        if (punteros.size < 2) pinchInicio = null;
    };
    img.addEventListener('pointerup', soltar);
    img.addEventListener('pointercancel', soltar);

    // Mientras hay zoom o pellizco, el deslizamiento no cambia de imagen
    img.addEventListener('touchstart', (e) => {
        if (escala > 1 || e.touches.length > 1) e.stopPropagation();
        if (e.touches.length === 1 && escala === 1) gesto = false;
    }, { passive: true });
    img.addEventListener('touchend', (e) => {
        if (gesto || escala > 1) e.stopPropagation();
    });

    // Las flechas solo cambian de imagen; +/- y 0 controlan el zoom
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;
        const r = img.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (e.key === '+' || e.key === '=') zoomEn(escala * 1.25, cx, cy);
        if (e.key === '-') zoomEn(escala / 1.25, cx, cy);
        if (e.key === '0') reset();
    });

    const ayuda = document.createElement('p');
    ayuda.className = 'modal-help';
    ayuda.textContent = matchMedia('(hover: hover)').matches
        ? 'Rueda o doble clic para ampliar, arrastra para moverte'
        : 'Pellizca para ampliar, arrastra para moverte';
    modal.querySelector('.modal-content')?.appendChild(ayuda);
}

/* ===========================
   VISTA PREVIA DE CARTAS (BANLIST)
   =========================== */
function setupCardPreview() {
    const view = document.getElementById('banlistView');
    if (!view || !matchMedia('(hover: hover)').matches) return;

    const tip = document.createElement('div');
    tip.className = 'card-preview';
    tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<img alt="" width="168" height="246" />';
    document.body.appendChild(tip);
    const img = tip.firstElementChild;

    function colocar(e) {
        const w = 180, h = 260;
        let left = e.clientX + 18;
        let top = e.clientY - h / 2;
        if (left + w > innerWidth) left = e.clientX - w - 18;
        top = Math.max(8, Math.min(innerHeight - h - 8, top));
        tip.style.transform = `translate(${left}px, ${top}px)`;
    }

    view.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a[href*="search="]');
        if (!a) return;
        const id = new URL(a.href).searchParams.get('search');
        img.src = `https://images.ygoprodeck.com/images/cards_small/${id}.jpg`;
        tip.classList.add('show');
        colocar(e);
    });
    view.addEventListener('mousemove', (e) => { if (tip.classList.contains('show')) colocar(e); });
    view.addEventListener('mouseout', (e) => {
        if (e.target.closest('a') && !e.relatedTarget?.closest?.('a[href*="search="]')) tip.classList.remove('show');
    });
    img.addEventListener('error', () => tip.classList.remove('show'));
}

/* ===========================
   ?q= RELLENA LOS BUSCADORES
   =========================== */
function setupQueryParam() {
    const q = new URLSearchParams(location.search).get('q');
    if (!q) return;
    const campo = document.getElementById('banSearch') || document.getElementById('tierSearch');
    if (!campo) return;
    campo.value = q;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    (document.getElementById('lista') || campo).scrollIntoView({ block: 'start' });
}

document.addEventListener('DOMContentLoaded', () => {
    setupCommandPalette();
    setupModalZoom();
    setupCardPreview();
    setupQueryParam();
});
