/* Crea tu tierlist: arrastrar y soltar con ratón, tocar y colocar en móvil,
   teclado (1-5, 0, flechas), guardado local y exportación a PNG. */
(() => {
    const root = document.getElementById('tiermaker');
    if (!root) return;

    const KEY = 'xyz-tiermaker-v1';
    const NIVELES = [
        { nombre: 'S', color: '#ff4d6d' },
        { nombre: 'A', color: '#ff9f43' },
        { nombre: 'B', color: '#f5b800' },
        { nombre: 'C', color: '#4cd790' },
        { nombre: 'D', color: '#7b65ff' },
    ];
    // Del ranking oficial a las 5 filas
    const PRESET = { nah: 0, special: 0, grade1: 1, grade2: 2, semigrade2: 2, ok: 3, meh: 4 };

    const decks = [...document.querySelectorAll('.tierlist-category figure')].map(fig => {
        const img = fig.querySelector('img');
        return {
            id: img.getAttribute('src').split('/').pop(),
            src: img.getAttribute('src'),
            nombre: fig.querySelector('figcaption')?.textContent.trim() || img.alt,
            tier: fig.closest('.tierlist-category')?.dataset.tier,
        };
    });
    const porId = new Map(decks.map(d => [d.id, d]));

    let estado = XYZ.leer(KEY, null);
    if (!estado || !Array.isArray(estado.filas) || estado.filas.length !== NIVELES.length) {
        estado = { etiquetas: NIVELES.map(n => n.nombre), filas: NIVELES.map(() => []) };
    }
    // Quita decks que ya no existan
    estado.filas = estado.filas.map(f => f.filter(id => porId.has(id)));

    /* ---------- Estructura ---------- */
    root.innerHTML = `
        ${NIVELES.map((n, i) => `
            <div class="tm-row" style="--tier:${n.color}">
                <label class="tm-label">
                    <span class="visually-hidden">Nombre del nivel ${i + 1}</span>
                    <input value="${XYZ.escapar(estado.etiquetas[i] || n.nombre)}" maxlength="14" data-label="${i}" />
                </label>
                <div class="tm-drop" data-row="${i}" aria-label="Nivel ${i + 1}"></div>
            </div>`).join('')}
        <div class="tm-pool-wrap">
            <p class="tm-pool-title">Sin clasificar <span class="tier-count" id="tmPoolCount"></span></p>
            <div class="tm-drop tm-pool" data-row="pool" aria-label="Decks sin clasificar"></div>
        </div>`;

    const drops = [...root.querySelectorAll('.tm-drop')];
    const pool = root.querySelector('.tm-pool');
    const hint = document.getElementById('tmHint');
    const hintBase = hint.textContent;

    function chip(d) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tm-chip';
        b.dataset.id = d.id;
        b.title = d.nombre;
        b.innerHTML = `<img src="${d.src}" alt="" loading="lazy" decoding="async" draggable="false" /><span>${XYZ.escapar(d.nombre)}</span>`;
        return b;
    }

    const chips = new Map(decks.map(d => [d.id, chip(d)]));

    function colocarSegunEstado() {
        const usados = new Set(estado.filas.flat());
        estado.filas.forEach((f, i) => f.forEach(id => drops[i].appendChild(chips.get(id))));
        decks.forEach(d => { if (!usados.has(d.id)) pool.appendChild(chips.get(d.id)); });
        actualizar();
    }

    function actualizar() {
        estado.filas = drops.slice(0, NIVELES.length).map(dz => [...dz.children].map(c => c.dataset.id));
        document.getElementById('tmPoolCount').textContent = pool.children.length;
        XYZ.guardar(KEY, estado);
    }

    root.addEventListener('input', (e) => {
        const i = e.target.dataset.label;
        if (i === undefined) return;
        estado.etiquetas[i] = e.target.value;
        XYZ.guardar(KEY, estado);
    });

    /* ---------- Mover ---------- */
    let seleccionado = null;

    function seleccionar(c) {
        seleccionado?.classList.remove('is-selected');
        seleccionado = c;
        if (c) {
            c.classList.add('is-selected');
            hint.textContent = `Toca un nivel para mover ${porId.get(c.dataset.id).nombre}, o tócalo otra vez para soltarlo.`;
        } else {
            hint.textContent = hintBase;
        }
        root.classList.toggle('has-selection', !!c);
    }

    function mover(c, destino, antesDe = null) {
        if (antesDe === c) return;
        const primero = c.getBoundingClientRect();
        destino.insertBefore(c, antesDe);
        // FLIP: el deck se desliza desde donde estaba
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const ultimo = c.getBoundingClientRect();
            c.animate([
                { transform: `translate(${primero.left - ultimo.left}px, ${primero.top - ultimo.top}px)` },
                { transform: 'none' },
            ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
        actualizar();
    }

    // Tocar o hacer clic: seleccionar y colocar
    root.addEventListener('click', (e) => {
        if (arrastrando) return;
        const c = e.target.closest('.tm-chip');
        const dz = e.target.closest('.tm-drop');
        if (c) {
            if (!seleccionado) return seleccionar(c);
            if (seleccionado === c) return seleccionar(null);
            mover(seleccionado, c.parentElement, c);
            return seleccionar(null);
        }
        if (dz && seleccionado) {
            mover(seleccionado, dz);
            seleccionar(null);
        }
    });

    // Teclado
    root.addEventListener('keydown', (e) => {
        const c = e.target.closest('.tm-chip');
        if (!c) return;
        let hecho = true;
        if (/^[1-5]$/.test(e.key)) mover(c, drops[Number(e.key) - 1]);
        else if (e.key === '0') mover(c, pool);
        else if (e.key === 'ArrowLeft' && c.previousElementSibling) mover(c, c.parentElement, c.previousElementSibling);
        else if (e.key === 'ArrowRight' && c.nextElementSibling) mover(c, c.parentElement, c.nextElementSibling.nextElementSibling);
        else if (e.key === 'Escape') seleccionar(null);
        else hecho = false;
        if (hecho) {
            e.preventDefault();
            c.focus();
            if (/^[0-5]$/.test(e.key)) {
                const fila = e.key === '0' ? 'Sin clasificar' : (estado.etiquetas[Number(e.key) - 1] || NIVELES[Number(e.key) - 1].nombre);
                hint.textContent = `${porId.get(c.dataset.id).nombre} → ${fila}`;
            }
        }
    });

    // Arrastrar con ratón o lápiz (en táctil se usa tocar y colocar para no bloquear el scroll)
    let arrastrando = false;
    let inicio = null;
    let fantasma = null;
    let actual = null;
    let marcador = null;

    function destinoEn(x, y) {
        const el = document.elementFromPoint(x, y);
        const dz = el?.closest('.tm-drop');
        if (!dz) return null;
        const hermanos = [...dz.children].filter(n => n !== actual && n.classList.contains('tm-chip'));
        const antes = hermanos.find(n => {
            const r = n.getBoundingClientRect();
            if (y < r.top) return true; // está en una línea más abajo
            if (y <= r.bottom) return x < r.left + r.width / 2; // misma línea
            return false;
        }) || null;
        return { dz, antes };
    }

    root.addEventListener('pointerdown', (e) => {
        const c = e.target.closest('.tm-chip');
        if (!c || e.pointerType === 'touch' || e.button !== 0) return;
        inicio = { x: e.clientX, y: e.clientY, c };
    });

    window.addEventListener('pointermove', (e) => {
        if (!inicio) return;
        if (!arrastrando) {
            if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 6) return;
            arrastrando = true;
            actual = inicio.c;
            seleccionar(null);
            const r = actual.getBoundingClientRect();
            fantasma = actual.cloneNode(true);
            fantasma.className = 'tm-chip tm-ghost';
            fantasma.style.width = `${r.width}px`;
            document.body.appendChild(fantasma);
            inicio.dx = e.clientX - r.left;
            inicio.dy = e.clientY - r.top;
            actual.classList.add('is-dragging');
            marcador = document.createElement('span');
            marcador.className = 'tm-marker';
            document.body.classList.add('tm-grabbing');
        }
        fantasma.style.transform = `translate(${e.clientX - inicio.dx}px, ${e.clientY - inicio.dy}px) rotate(-3deg)`;
        // Desplaza la página si se arrastra cerca del borde (la cabecera fija tapa la parte de arriba)
        const cabecera = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
        if (e.clientY < cabecera + 40) window.scrollBy(0, -14);
        else if (e.clientY > innerHeight - 40) window.scrollBy(0, 14);
        const d = destinoEn(e.clientX, e.clientY);
        drops.forEach(z => z.classList.toggle('is-over', z === d?.dz));
        if (d) d.dz.insertBefore(marcador, d.antes);
        else marcador.remove();
    });

    window.addEventListener('pointerup', (e) => {
        if (!inicio) return;
        if (arrastrando) {
            const d = destinoEn(e.clientX, e.clientY);
            marcador.remove();
            fantasma.remove();
            actual.classList.remove('is-dragging');
            drops.forEach(z => z.classList.remove('is-over'));
            document.body.classList.remove('tm-grabbing');
            if (d) mover(actual, d.dz, d.antes);
            // Evita que el clic que sigue al arrastre seleccione el deck
            setTimeout(() => { arrastrando = false; }, 0);
        }
        inicio = null;
        actual = null;
    });

    /* ---------- Botones ---------- */
    document.getElementById('tmClear').addEventListener('click', () => {
        decks.forEach(d => pool.appendChild(chips.get(d.id)));
        actualizar();
        mostrarToast('Niveles vaciados');
    });

    document.getElementById('tmPreset').addEventListener('click', () => {
        decks.forEach(d => {
            const fila = PRESET[d.tier];
            (fila === undefined ? pool : drops[fila]).appendChild(chips.get(d.id));
        });
        actualizar();
        mostrarToast('Tierlist rellenada con el ranking XYZ');
    });

    /* ---------- Exportar a PNG ---------- */
    function cargar(src) {
        return new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = src;
        });
    }

    document.getElementById('tmExport').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Generando…';
        try {
            await document.fonts?.ready;
            const W = 1400, LABEL = 150, TW = 150, TH = 96, GAP = 8, PAD = 24, CAB = 90;
            const porFila = Math.floor((W - LABEL - PAD * 2 - GAP) / (TW + GAP));
            const alturas = estado.filas.map(f => Math.max(1, Math.ceil(f.length / porFila)) * (TH + GAP) + GAP);
            const H = CAB + alturas.reduce((a, b) => a + b + 6, 0) + PAD;
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#070912';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#f5b800';
            ctx.font = '700 40px "Cinzel Decorative", serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('Mi tierlist', PAD, CAB / 2);
            ctx.fillStyle = '#bfc1d1';
            ctx.font = '500 22px Barlow, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('Yu-Gi-Oh! XYZ', W - PAD, CAB / 2);
            ctx.textAlign = 'left';

            const imgs = new Map(await Promise.all(decks.map(async d => [d.id, await cargar(d.src)])));
            let y = CAB;
            for (let i = 0; i < NIVELES.length; i++) {
                const h = alturas[i];
                ctx.fillStyle = '#121633';
                ctx.fillRect(PAD, y, W - PAD * 2, h);
                ctx.fillStyle = NIVELES[i].color;
                ctx.fillRect(PAD, y, LABEL, h);
                ctx.fillStyle = '#0a0a12';
                ctx.textAlign = 'center';
                const etiqueta = estado.etiquetas[i] || NIVELES[i].nombre;
                ctx.font = `700 ${etiqueta.length > 3 ? 26 : 54}px "Barlow Condensed", sans-serif`;
                ctx.fillText(etiqueta, PAD + LABEL / 2, y + h / 2, LABEL - 16);
                ctx.textAlign = 'left';
                estado.filas[i].forEach((id, k) => {
                    const x = PAD + LABEL + GAP + (k % porFila) * (TW + GAP);
                    const ty = y + GAP + Math.floor(k / porFila) * (TH + GAP);
                    const img = imgs.get(id);
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(x, ty, TW, TH, 8) : ctx.rect(x, ty, TW, TH);
                    ctx.clip();
                    if (img) {
                        const s = Math.max(TW / img.width, TH / img.height);
                        ctx.drawImage(img, x + (TW - img.width * s) / 2, ty + (TH - img.height * s) / 2, img.width * s, img.height * s);
                    }
                    const grad = ctx.createLinearGradient(0, ty + TH - 34, 0, ty + TH);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(0,0,0,.85)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(x, ty + TH - 34, TW, 34);
                    ctx.fillStyle = '#fff';
                    ctx.font = '700 17px Barlow, sans-serif';
                    ctx.fillText(porId.get(id).nombre, x + 8, ty + TH - 13, TW - 16);
                    ctx.restore();
                });
                y += h + 6;
            }

            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'mi-tierlist-xyz.png';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            mostrarToast('Imagen descargada: mi-tierlist-xyz.png');
        } catch {
            mostrarToast('No se ha podido generar la imagen en este navegador');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Descargar imagen';
        }
    });

    colocarSegunEstado();
})();
