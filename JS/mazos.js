/* Validador de mazos: lee YDK o ydke://, consulta los datos de cada carta en
   la API pública de YGOPRODeck y comprueba el mazo con la banlist XYZ. */
(() => {
    const API = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
    const CACHE_KEY = 'xyz-cartas-v1';
    const DECK_KEY = 'xyz-ultimo-mazo';
    const EXTRA_FRAMES = ['fusion', 'synchro', 'xyz', 'link', 'fusion_pendulum', 'synchro_pendulum', 'xyz_pendulum'];

    const $ = (id) => document.getElementById(id);
    const text = $('deckText');
    if (!text) return;

    /* ---------- Lectura de formatos ---------- */
    function parseYdke(cadena) {
        const cuerpo = cadena.trim().replace(/^ydke:\/\//i, '');
        const partes = cuerpo.split('!');
        if (partes.length < 3) throw new Error('El enlace ydke:// está incompleto.');
        const leer = (b64) => {
            if (!b64) return [];
            const bin = atob(b64);
            const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
            const view = new DataView(bytes.buffer);
            const ids = [];
            for (let i = 0; i + 4 <= bytes.length; i += 4) ids.push(view.getUint32(i, true));
            return ids;
        };
        return { main: leer(partes[0]), extra: leer(partes[1]), side: leer(partes[2]) };
    }

    function parseYdk(cadena) {
        const deck = { main: [], extra: [], side: [] };
        let zona = 'main';
        cadena.split(/\r?\n/).forEach(linea => {
            const l = linea.trim().toLowerCase();
            if (l.startsWith('#main')) zona = 'main';
            else if (l.startsWith('#extra')) zona = 'extra';
            else if (l.startsWith('!side')) zona = 'side';
            else if (/^\d+$/.test(l)) deck[zona].push(Number(l));
        });
        return deck;
    }

    function parseDeck(cadena) {
        const ydke = cadena.match(/ydke:\/\/[A-Za-z0-9+/=!]+/i);
        if (ydke) return parseYdke(ydke[0]);
        const deck = parseYdk(cadena);
        if (!deck.main.length && !deck.extra.length && !deck.side.length) {
            throw new Error('No se ha encontrado ninguna carta. Pega un mazo en formato YDK (una ID por línea) o un enlace ydke://.');
        }
        return deck;
    }

    function toYdke(deck) {
        const enc = (ids) => {
            const buf = new DataView(new ArrayBuffer(ids.length * 4));
            ids.forEach((id, i) => buf.setUint32(i * 4, id, true));
            let bin = '';
            new Uint8Array(buf.buffer).forEach(b => { bin += String.fromCharCode(b); });
            return btoa(bin);
        };
        return `ydke://${enc(deck.main)}!${enc(deck.extra)}!${enc(deck.side)}!`;
    }

    function toYdk(deck) {
        return ['#created by Yu-Gi-Oh! XYZ', '#main', ...deck.main, '#extra', ...deck.extra, '!side', ...deck.side].join('\n') + '\n';
    }

    /* ---------- Datos de cartas (con caché local) ---------- */
    const cache = XYZ.leer(CACHE_KEY, {});

    function resumir(card, imagen) {
        return {
            id: card.id,
            name: card.name,
            type: card.type,
            frame: card.frameType,
            desc: card.desc,
            atk: card.atk,
            def: card.def,
            level: card.level,
            link: card.linkval,
            race: card.race,
            attribute: card.attribute,
            small: imagen.image_url_small,
            big: imagen.image_url,
        };
    }

    function guardarCache() {
        const claves = Object.keys(cache);
        if (claves.length > 600) claves.slice(0, claves.length - 600).forEach(k => delete cache[k]);
        XYZ.guardar(CACHE_KEY, cache);
    }

    async function pedir(ids) {
        const r = await fetch(`${API}?id=${ids.join(',')}`);
        if (!r.ok) throw new Error(r.status);
        const json = await r.json();
        (json.data || []).forEach(card => {
            (card.card_images || []).forEach(img => {
                if (ids.includes(img.id) || img.id === card.id) cache[img.id] = resumir(card, img);
            });
            if (!cache[card.id]) cache[card.id] = resumir(card, card.card_images?.[0] || {});
        });
    }

    async function cargarCartas(ids) {
        const faltan = [...new Set(ids)].filter(id => !cache[id]);
        for (let i = 0; i < faltan.length; i += 40) {
            const lote = faltan.slice(i, i + 40);
            try {
                await pedir(lote);
            } catch {
                // Si una ID no existe la API rechaza el lote entero: se piden de una en una
                for (const id of lote) {
                    if (cache[id]) continue;
                    try { await pedir([id]); } catch { /* carta desconocida */ }
                    await new Promise(res => setTimeout(res, 60));
                }
            }
        }
        guardarCache();
    }

    /* ---------- Probabilidad ---------- */
    function comb(n, k) {
        if (k < 0 || k > n) return 0;
        let r = 1;
        for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
        return r;
    }
    const exacta = (N, K, n, k) => comb(K, k) * comb(N - K, n - k) / comb(N, n);
    const almenos1 = (N, K, n) => 1 - exacta(N, K, n, 0);

    /* ---------- Validación ---------- */
    let ultimo = null;

    async function comprobar(cadena, { silencioso = false } = {}) {
        let deck;
        try {
            deck = parseDeck(cadena);
        } catch (e) {
            if (!silencioso) mostrarError(e.message);
            return;
        }
        $('deckResult').hidden = false;
        $('deckVerdict').className = 'deck-verdict';
        $('deckVerdict').textContent = 'Consultando las cartas…';
        $('deckSections').innerHTML = '';
        $('deckIssues').innerHTML = '';
        $('deckMeters').innerHTML = '';

        const [ban] = await Promise.all([XYZ.banlist(), cargarCartas([...deck.main, ...deck.extra, ...deck.side])]);
        const banMap = new Map(ban.map(c => [c.id, c.status]));
        const limite = (id) => {
            const info = cache[id];
            const claves = [String(id), info && String(info.id)];
            for (const k of claves) if (k && banMap.has(k)) return banMap.get(k);
            return 3;
        };

        const problemas = [];
        const avisos = [];
        const n = { main: deck.main.length, extra: deck.extra.length, side: deck.side.length };
        if (n.main < 40) problemas.push(`El Deck Principal tiene ${n.main} cartas; necesita al menos 40.`);
        if (n.main > 60) problemas.push(`El Deck Principal tiene ${n.main} cartas; el máximo es 60.`);
        if (n.extra > 15) problemas.push(`El Extra Deck tiene ${n.extra} cartas; el máximo es 15.`);
        if (n.side > 15) problemas.push(`El Side Deck tiene ${n.side} cartas; el máximo es 15.`);

        // Copias totales por carta (las ilustraciones alternativas cuentan como la misma)
        const totales = new Map();
        [...deck.main, ...deck.extra, ...deck.side].forEach(id => {
            const base = cache[id]?.id || id;
            totales.set(base, (totales.get(base) || 0) + 1);
        });
        const excedidas = new Set();
        totales.forEach((cuantas, base) => {
            const max = limite(base);
            if (cuantas > max) {
                excedidas.add(base);
                const nombre = cache[base]?.name || `ID ${base}`;
                problemas.push(max === 0
                    ? `${nombre} está prohibida en XYZ (llevas ${cuantas}).`
                    : `${nombre}: llevas ${cuantas} copias y el máximo es ${max}.`);
            }
        });

        const malColocadas = new Set();
        deck.main.forEach(id => {
            const c = cache[id];
            if (c && EXTRA_FRAMES.includes(c.frame)) { malColocadas.add(id); }
        });
        deck.extra.forEach(id => {
            const c = cache[id];
            if (c && !EXTRA_FRAMES.includes(c.frame)) { malColocadas.add(id); }
        });
        malColocadas.forEach(id => problemas.push(`${cache[id].name} no puede ir en ${deck.main.includes(id) ? 'el Deck Principal' : 'el Extra Deck'}.`));

        const desconocidas = [...new Set([...deck.main, ...deck.extra, ...deck.side])].filter(id => !cache[id]);
        if (desconocidas.length) avisos.push(`No se han encontrado ${desconocidas.length === 1 ? 'la carta' : 'las cartas'} con ID ${desconocidas.join(', ')}. Puede que sean cartas nuevas o una ID mal copiada.`);
        [...new Set([...deck.main, ...deck.extra, ...deck.side])].forEach(id => {
            const c = cache[id];
            if (c && ['token', 'skill'].includes(c.frame)) problemas.push(`${c.name} es un ${c.frame === 'token' ? 'token' : 'skill'} y no puede ir en un mazo.`);
        });

        ultimo = { deck, limite, excedidas, malColocadas };

        // Veredicto
        const verdict = $('deckVerdict');
        if (problemas.length) {
            verdict.className = 'deck-verdict is-bad';
            verdict.innerHTML = `<strong>Mazo no válido</strong><span>${problemas.length === 1 ? 'Hay 1 problema' : `Hay ${problemas.length} problemas`} que corregir antes de jugar.</span>`;
        } else {
            verdict.className = 'deck-verdict is-good';
            verdict.innerHTML = `<strong>Mazo legal en XYZ</strong><span>Cumple la banlist y los límites de cada deck.</span>`;
        }

        $('deckIssues').innerHTML = [
            ...problemas.map(p => `<li class="issue-bad">${XYZ.escapar(p)}</li>`),
            ...avisos.map(p => `<li class="issue-warn">${XYZ.escapar(p)}</li>`),
        ].join('');

        pintarMedidores(deck);
        pintarSecciones();

        const cad = toYdke(deck);
        XYZ.guardar(DECK_KEY, cad);
        history.replaceState(null, '', `#${cad.replace('ydke://', 'ydke=')}`);
    }

    function medidor(etiqueta, valor, min, max) {
        const ok = valor >= min && valor <= max;
        const pct = Math.min(100, (valor / max) * 100);
        const rango = min ? `${min}–${max}` : `máx. ${max}`;
        return `<div class="meter ${ok ? '' : 'is-bad'}">
            <div class="meter-top"><span>${etiqueta}</span><strong>${valor}</strong></div>
            <div class="meter-bar"><span style="width:${pct}%"></span>${min ? `<i style="left:${(min / max) * 100}%"></i>` : ''}</div>
            <small>${rango}</small></div>`;
    }

    function pintarMedidores(deck) {
        const tipos = { Monstruos: 0, Mágicas: 0, Trampas: 0 };
        deck.main.forEach(id => {
            const f = cache[id]?.frame;
            if (f === 'spell') tipos['Mágicas']++;
            else if (f === 'trap') tipos.Trampas++;
            else if (f) tipos.Monstruos++;
        });
        const total = Object.values(tipos).reduce((a, b) => a + b, 0) || 1;
        $('deckMeters').innerHTML = `
            ${medidor('Deck Principal', deck.main.length, 40, 60)}
            ${medidor('Extra Deck', deck.extra.length, 0, 15)}
            ${medidor('Side Deck', deck.side.length, 0, 15)}
            <div class="meter meter-types">
                <div class="meter-top"><span>Reparto del Deck Principal</span></div>
                <div class="type-bar">${Object.entries(tipos).map(([k, v]) => v ? `<span class="t-${k === 'Monstruos' ? 'monster' : k === 'Mágicas' ? 'spell' : 'trap'}" style="flex:${v}" title="${k}: ${v}"></span>` : '').join('')}</div>
                <small>${Object.entries(tipos).map(([k, v]) => `<span class="type-key t-${k === 'Monstruos' ? 'monster' : k === 'Mágicas' ? 'spell' : 'trap'}">${k} ${v} (${Math.round(v / total * 100)}%)</span>`).join('')}</small>
            </div>`;
    }

    function orden(id) {
        const f = cache[id]?.frame;
        if (!f) return 9;
        if (f === 'spell') return 5;
        if (f === 'trap') return 6;
        return EXTRA_FRAMES.indexOf(f) >= 0 ? 1 + EXTRA_FRAMES.indexOf(f) / 10 : 0;
    }

    function pintarSecciones() {
        const { deck, limite, excedidas, malColocadas } = ultimo;
        const segundo = $('deckSecond').checked;
        const mano = segundo ? 6 : 5;
        const nombres = { main: 'Deck Principal', extra: 'Extra Deck', side: 'Side Deck' };

        $('deckSections').innerHTML = Object.entries(nombres).map(([zona, titulo]) => {
            const ids = deck[zona];
            if (!ids.length) return '';
            const cuenta = new Map();
            ids.forEach(id => cuenta.set(id, (cuenta.get(id) || 0) + 1));
            const unicos = [...cuenta.keys()].sort((a, b) => orden(a) - orden(b) || (cache[a]?.name || '').localeCompare(cache[b]?.name || ''));
            const tiles = unicos.map(id => {
                const c = cache[id];
                const base = c?.id || id;
                const max = limite(base);
                const estado = max < 3 ? XYZ.estados[max] : null;
                const mal = excedidas.has(base) || malColocadas.has(id) || !c;
                const prob = zona === 'main' ? Math.round(almenos1(ids.length, cuenta.get(id), Math.min(mano, ids.length)) * 100) : null;
                const img = c ? `<img src="${c.small}" alt="" width="168" height="246" loading="lazy" decoding="async" />` : `<span class="tile-missing">?</span>`;
                return `<li><button type="button" class="deck-tile ${mal ? 'is-bad' : ''}" data-id="${id}" data-zona="${zona}"
                        aria-label="${XYZ.escapar(c?.name || `Carta desconocida ${id}`)}, ${cuenta.get(id)} ${cuenta.get(id) === 1 ? 'copia' : 'copias'}${estado ? `, ${estado.nombre}` : ''}">
                    ${img}
                    <span class="tile-count">×${cuenta.get(id)}</span>
                    ${estado ? `<span class="tile-ban ban-${estado.clase}">${max}</span>` : ''}
                    ${prob !== null ? `<span class="tile-odds">${prob}%</span>` : ''}
                    <span class="tile-name">${XYZ.escapar(c?.name || `ID ${id}`)}</span>
                </button></li>`;
            }).join('');
            const nota = zona === 'main' ? `<p class="deck-section-note">El % es la probabilidad de tener al menos una copia en la mano inicial de ${mano} cartas.</p>` : '';
            return `<section class="deck-section"><h3>${titulo} <span class="tier-count">${ids.length}</span></h3>${nota}<ul class="deck-grid">${tiles}</ul></section>`;
        }).join('');
    }

    function mostrarError(msg) {
        $('deckResult').hidden = false;
        $('deckVerdict').className = 'deck-verdict is-bad';
        $('deckVerdict').innerHTML = `<strong>No se ha podido leer el mazo</strong><span>${XYZ.escapar(msg)}</span>`;
        $('deckMeters').innerHTML = '';
        $('deckIssues').innerHTML = '';
        $('deckSections').innerHTML = '';
        ultimo = null;
    }

    /* ---------- Ficha de carta ---------- */
    const detalle = $('cardDetail');
    $('deckSections').addEventListener('click', (e) => {
        const tile = e.target.closest('.deck-tile');
        if (!tile || !ultimo) return;
        const id = Number(tile.dataset.id);
        const c = cache[id];
        if (!c) return;
        const { deck, limite } = ultimo;
        const max = limite(c.id);
        const stats = [c.type, c.attribute, c.race,
            c.level ? `${c.frame?.startsWith('xyz') ? 'Rango' : 'Nivel'} ${c.level}` : '', c.link ? `Link ${c.link}` : '',
            c.atk !== undefined ? `ATK ${c.atk}` : '', c.def !== undefined && c.def !== null ? `DEF ${c.def}` : '']
            .filter(Boolean).join(' · ');
        $('cardDetailImg').src = c.big || c.small;
        $('cardDetailImg').alt = c.name;
        $('cardDetailName').textContent = c.name;
        $('cardDetailMeta').textContent = stats;
        $('cardDetailBan').textContent = max < 3 ? `${XYZ.estados[max].nombre} en XYZ: máximo ${max}.` : 'Permitida a 3 en XYZ.';
        $('cardDetailBan').className = `card-detail-ban ${max < 3 ? `ban-${XYZ.estados[max].clase}` : ''}`;
        $('cardDetailDesc').textContent = c.desc;
        if (tile.dataset.zona === 'main') {
            const N = deck.main.length, K = deck.main.filter(x => x === id).length;
            const f = (n) => Math.round(almenos1(N, K, Math.min(n, N)) * 1000) / 10;
            $('cardDetailOdds').textContent = `Con ${K} ${K === 1 ? 'copia' : 'copias'} en ${N} cartas: ${f(5)} % de abrirla yendo primero, ${f(6)} % yendo segundo.`;
        } else {
            $('cardDetailOdds').textContent = '';
        }
        $('cardDetailLink').href = `https://ygoprodeck.com/card/?search=${c.id}`;
        detalle.showModal();
    });
    $('cardDetailClose').addEventListener('click', () => detalle.close());
    detalle.addEventListener('click', (e) => { if (e.target === detalle) detalle.close(); });

    /* ---------- Controles ---------- */
    $('deckCheck').addEventListener('click', () => comprobar(text.value));
    text.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) comprobar(text.value);
    });
    // Al pegar, se comprueba directamente
    text.addEventListener('paste', () => setTimeout(() => comprobar(text.value), 0));
    $('deckClear').addEventListener('click', () => {
        text.value = '';
        $('deckResult').hidden = true;
        history.replaceState(null, '', location.pathname);
        XYZ.guardar(DECK_KEY, null);
        text.focus();
    });
    $('deckSecond').addEventListener('change', () => { if (ultimo) pintarSecciones(); });

    async function leerArchivo(file) {
        if (!file) return;
        text.value = await file.text();
        comprobar(text.value);
    }
    $('deckFile').addEventListener('change', (e) => leerArchivo(e.target.files[0]));
    const drop = $('deckDrop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drop'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('is-drop')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); leerArchivo(e.dataTransfer.files[0]); });

    async function copiar(texto, ok) {
        try {
            await navigator.clipboard.writeText(texto);
            mostrarToast(ok);
        } catch {
            prompt('Copia el texto:', texto);
        }
    }
    $('deckShare').addEventListener('click', () => {
        if (!ultimo) return;
        copiar(`${location.origin}${location.pathname}#${toYdke(ultimo.deck).replace('ydke://', 'ydke=')}`, 'Enlace al mazo copiado');
    });
    $('deckCopyYdke').addEventListener('click', () => { if (ultimo) copiar(toYdke(ultimo.deck), 'ydke:// copiado. Pégalo en YGO Omega.'); });
    $('deckDownload').addEventListener('click', () => {
        if (!ultimo) return;
        const blob = new Blob([toYdk(ultimo.deck)], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mazo-xyz.ydk';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        mostrarToast('Mazo descargado como mazo-xyz.ydk');
    });

    // Mazo compartido en la URL o el último que se comprobó
    const desdeHash = location.hash.startsWith('#ydke=') ? `ydke://${decodeURIComponent(location.hash.slice(6))}` : null;
    const inicial = desdeHash || XYZ.leer(DECK_KEY, null);
    if (inicial) {
        text.value = inicial;
        comprobar(inicial, { silencioso: true });
    }
})();
