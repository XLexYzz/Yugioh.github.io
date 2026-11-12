const BANLIST_FILE = 'Untitled Banlist.lflist.conf';

const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
toastContainer.setAttribute('role', 'status');
toastContainer.setAttribute('aria-live', 'polite');
document.body.appendChild(toastContainer);

function mostrarToast(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3200);
}

function rutaBase() {
    return window.location.pathname.includes('/porfolio/') ? '../' : './';
}

function descargarBanlist() {
    const enlace = document.createElement('a');
    enlace.href = `${rutaBase()}banlist/${BANLIST_FILE}`;
    enlace.download = '!XYZ-banlist.lflist.conf';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    mostrarToast('¡Descarga de la banlist iniciada!');
}

function highlightActiveMenu() {
    const links = document.querySelectorAll('.menu a');
    const path = window.location.pathname.split('/').pop() || 'index.html';

    links.forEach(link => {
        const file = link.getAttribute('href').split('/').pop();
        if (path === file) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');

            // En móvil el menú se desliza: centra el enlace activo para que se vea
            const menu = link.parentElement;
            if (menu.scrollWidth > menu.clientWidth) {
                const offset = link.getBoundingClientRect().left - menu.getBoundingClientRect().left;
                menu.scrollLeft += offset - (menu.clientWidth - link.offsetWidth) / 2;
            }
        }
    });
}

function setupLazyMedia() {
    document.querySelectorAll('main img').forEach(img => {
        img.loading = 'lazy';
        img.decoding = 'async';
    });
}

function setupScrollReveal() {
    const elements = document.querySelectorAll('.animate-up');
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
        elements.forEach(el => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });

    elements.forEach(el => observer.observe(el));
}

/* ===========================
   VISOR DE IMÁGENES
   =========================== */
function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Imagen ampliada');
    modal.innerHTML = `
        <div class="modal-content">
            <img alt="" />
            <p class="modal-caption"></p>
            <button class="modal-close" type="button" aria-label="Cerrar">×</button>
        </div>
        <button class="modal-nav modal-prev" type="button" aria-label="Imagen anterior">‹</button>
        <button class="modal-nav modal-next" type="button" aria-label="Imagen siguiente">›</button>
    `;
    document.body.appendChild(modal);

    return {
        modal,
        image: modal.querySelector('img'),
        caption: modal.querySelector('.modal-caption'),
        closeButton: modal.querySelector('.modal-close'),
        prev: modal.querySelector('.modal-prev'),
        next: modal.querySelector('.modal-next'),
    };
}

function setupImageModal() {
    const items = [...document.querySelectorAll('.image-grid img, .tierlist-grid img')];
    if (!items.length) return;

    const viewer = createModal();
    let current = -1;
    let lastFocus = null;

    // Solo se navega entre las imágenes que se están viendo (respeta filtros y búsqueda)
    const visibles = () => items.filter(img => img.offsetParent !== null);

    function show(img) {
        const figure = img.closest('figure');
        const text = figure?.querySelector('figcaption')?.textContent || img.alt;
        viewer.image.src = img.src;
        viewer.image.alt = img.alt || 'Imagen ampliada';
        viewer.caption.textContent = text;
        current = visibles().indexOf(img);
        const multiple = visibles().length > 1;
        viewer.prev.hidden = !multiple;
        viewer.next.hidden = !multiple;
    }

    function open(img) {
        lastFocus = document.activeElement;
        show(img);
        viewer.modal.classList.add('active');
        document.body.classList.add('no-scroll');
        // El CSS retira `visibility:hidden` de inmediato al abrir (solo el
        // fundido se transiciona); forzamos la recolocación de estilos para
        // que el botón de cierre sea enfocable antes de darle el foco.
        void viewer.modal.offsetHeight;
        viewer.closeButton.focus();
    }

    function close() {
        viewer.modal.classList.remove('active');
        document.body.classList.remove('no-scroll');
        lastFocus?.focus();
    }

    function step(delta) {
        const list = visibles();
        if (!list.length) return;
        show(list[(current + delta + list.length) % list.length]);
    }

    items.forEach(img => {
        const figure = img.closest('figure') || img;
        figure.tabIndex = 0;
        figure.setAttribute('role', 'button');
        figure.setAttribute('aria-label', `Ampliar ${img.alt}`);
        figure.addEventListener('click', () => open(img));
        figure.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open(img);
            }
        });
    });

    viewer.closeButton.addEventListener('click', close);
    viewer.prev.addEventListener('click', () => step(-1));
    viewer.next.addEventListener('click', () => step(1));
    viewer.modal.addEventListener('click', (event) => {
        if (event.target === viewer.modal) close();
    });

    document.addEventListener('keydown', (event) => {
        if (!viewer.modal.classList.contains('active')) return;
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowLeft') step(-1);
        if (event.key === 'ArrowRight') step(1);

        // Trampa de foco: Tab no sale del visor mientras está abierto
        if (event.key === 'Tab') {
            const focusables = [viewer.closeButton, viewer.prev, viewer.next].filter(el => !el.hidden);
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    // Deslizar en móvil
    let touchX = null;
    viewer.modal.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    viewer.modal.addEventListener('touchend', (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) step(dx > 0 ? -1 : 1);
        touchX = null;
    });
}

/* ===========================
   TIERLIST
   =========================== */
function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function setupTierlistFilters() {
    const buttons = document.querySelectorAll('.tierlist-filter button[data-tier]');
    const categories = document.querySelectorAll('.tierlist-category[data-tier]');
    const search = document.getElementById('tierSearch');
    const empty = document.getElementById('tierEmpty');
    if (!buttons.length || !categories.length) return;

    let selected = 'all';

    // Contador de decks en cada categoría
    categories.forEach(category => {
        const total = category.querySelectorAll('figure').length;
        const title = category.querySelector('h3');
        const badge = document.createElement('span');
        badge.className = 'tier-count';
        badge.textContent = total;
        title.appendChild(badge);
    });

    function apply() {
        const query = normalizar(search?.value.trim() || '');
        let anyVisible = false;

        categories.forEach(category => {
            const tierMatches = selected === 'all' || category.dataset.tier === selected;
            let matches = 0;
            category.querySelectorAll('figure').forEach(figure => {
                const name = normalizar(figure.textContent + ' ' + (figure.querySelector('img')?.alt || ''));
                const visible = !query || name.includes(query);
                figure.hidden = !visible;
                if (visible) matches++;
            });
            const show = tierMatches && matches > 0;
            category.hidden = !show;
            if (show) anyVisible = true;
        });

        if (empty) empty.hidden = anyVisible;
    }

    function select(button) {
        buttons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        selected = button.dataset.tier;
        apply();
    }

    buttons.forEach(button => {
        button.setAttribute('aria-pressed', button.classList.contains('active'));
        button.addEventListener('click', () => {
            select(button);
            setHash(selected === 'all' ? '' : selected);
        });
    });

    search?.addEventListener('input', apply);

    // tierlist.html#grade1 abre directamente ese nivel
    const fromHash = [...buttons].find(btn => btn.dataset.tier === location.hash.slice(1));
    if (fromHash) select(fromHash);
}

// Guarda el filtro en la URL para poder compartir el enlace, sin añadir entradas al historial
function setHash(value) {
    const url = value ? `#${value}` : location.pathname + location.search;
    history.replaceState(null, '', url);
}

/* ===========================
   VOLVER ARRIBA
   =========================== */
function setupBackToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.setAttribute('aria-label', 'Volver arriba');
    button.textContent = '↑';
    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(button);

    const update = () => button.classList.toggle('show', window.scrollY > window.innerHeight);
    window.addEventListener('scroll', update, { passive: true });
    update();
}

/* ===========================
   BANLIST
   =========================== */
const BAN_STATUS = {
    0: { titulo: 'Prohibidas', clase: 'forbidden', copias: 'Prohibida', slug: 'prohibidas' },
    1: { titulo: 'Limitadas', clase: 'limited', copias: '1 copia', slug: 'limitadas' },
    2: { titulo: 'Semi-limitadas', clase: 'semi', copias: '2 copias', slug: 'semilimitadas' },
};

// Formato .lflist.conf: "<id> <copias> --<nombre>"
function parseBanlist(texto) {
    return texto.split(/\r?\n/)
        .map(linea => linea.match(/^(\d+)\s+(\d)\s*--\s*(.+)$/))
        .filter(Boolean)
        .map(([, id, status, name]) => ({ id, status: Number(status), name: name.trim() }));
}

async function setupBanlistViewer() {
    const view = document.getElementById('banlistView');
    if (!view) return;

    const search = document.getElementById('banSearch');
    const buttons = document.querySelectorAll('#banFilter button');
    let cards = [];
    let selected = 'all';

    try {
        const response = await fetch(`${rutaBase()}banlist/${encodeURIComponent(BANLIST_FILE)}`);
        if (!response.ok) throw new Error(response.status);
        cards = parseBanlist(await response.text());
    } catch {
        view.innerHTML = '<p class="empty-state">No se pudo cargar la banlist aquí. Puedes descargarla con el botón de arriba.</p>';
        return;
    }

    buttons.forEach(button => {
        const status = button.dataset.status;
        const count = status === 'all' ? cards.length : cards.filter(c => String(c.status) === status).length;
        button.insertAdjacentHTML('beforeend', ` <span class="tier-count">${count}</span>`);
    });

    function render() {
        const query = normalizar(search?.value.trim() || '');
        view.innerHTML = '';

        Object.entries(BAN_STATUS).forEach(([status, info]) => {
            if (selected !== 'all' && selected !== status) return;
            const list = cards
                .filter(c => String(c.status) === status && (!query || normalizar(c.name).includes(query)))
                .sort((a, b) => a.name.localeCompare(b.name));
            if (!list.length) return;

            const column = document.createElement('section');
            column.className = `ban-column ban-${info.clase}`;
            column.innerHTML = `<h3>${info.titulo} <span class="tier-count">${list.length}</span></h3>`;

            const ul = document.createElement('ul');
            list.forEach(card => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = `https://ygoprodeck.com/card/?search=${card.id}`;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = card.name;
                const tag = document.createElement('span');
                tag.className = 'ban-tag';
                tag.textContent = info.copias;
                li.append(a, tag);
                ul.appendChild(li);
            });
            column.appendChild(ul);
            view.appendChild(column);
        });

        if (!view.children.length) {
            view.innerHTML = '<p class="empty-state">Ninguna carta restringida coincide con la búsqueda. Si no aparece, está permitida a 3.</p>';
        }
    }

    function select(button) {
        buttons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        selected = button.dataset.status;
        render();
    }

    buttons.forEach(button => {
        button.setAttribute('aria-pressed', button.classList.contains('active'));
        button.addEventListener('click', () => {
            select(button);
            setHash(BAN_STATUS[selected]?.slug || '');
        });
    });
    search?.addEventListener('input', render);

    // banlist.html#limitadas abre directamente esa categoría
    const fromHash = Object.entries(BAN_STATUS).find(([, info]) => info.slug === location.hash.slice(1));
    const initial = fromHash && [...buttons].find(btn => btn.dataset.status === fromHash[0]);
    if (initial) {
        select(initial);
        document.getElementById('lista')?.scrollIntoView();
    } else {
        render();
    }
}

/* ===========================
   VÍDEOS: CARGAR AL HACER CLIC
   =========================== */
function setupVideoEmbeds() {
    const embeds = document.querySelectorAll('.video-embed[data-video]');
    if (!embeds.length) return;

    embeds.forEach(embed => {
        const button = embed.querySelector('.video-play');
        if (!button) return;
        button.addEventListener('click', () => {
            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube-nocookie.com/embed/${embed.dataset.video}?autoplay=1&rel=0`;
            frame.title = embed.dataset.title || 'Vídeo de Yu-Gi-Oh!';
            frame.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            frame.allowFullscreen = true;
            embed.replaceChildren(frame);
        });
    });
}

/* ===========================
   TEMPORIZADOR DE DUELO
   =========================== */
function setupDuelTimer() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    const status = document.getElementById('timerStatus');
    const toggle = document.getElementById('timerToggle');
    const reset = document.getElementById('timerReset');
    const presets = document.querySelectorAll('.timer-presets button');

    let total = 20 * 60;
    let remaining = total;
    let running = false;
    let endTime = 0;
    let warned = false;
    let tick = null;

    function render() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function setStatus(text) {
        status.textContent = text;
    }

    function beep(times, freq) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            for (let i = 0; i < times; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = 0.12;
                osc.connect(gain).connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.35);
                osc.stop(ctx.currentTime + i * 0.35 + 0.25);
            }
        } catch {
            /* sin audio: el aviso visual ya está */
        }
    }

    function stop() {
        running = false;
        if (tick) {
            clearInterval(tick);
            tick = null;
        }
    }

    function onTick() {
        remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        if (!warned && remaining === 60) {
            warned = true;
            display.classList.add('warning');
            setStatus('¡Falta 1 minuto!');
            beep(1, 660);
        }
        render();
        if (remaining <= 0) {
            stop();
            display.classList.add('finished');
            setStatus('¡Tiempo agotado!');
            beep(3, 660);
        }
    }

    toggle.addEventListener('click', () => {
        if (running) {
            stop();
            toggle.textContent = 'Reanudar';
            setStatus('En pausa');
            return;
        }
        if (remaining <= 0) {
            setStatus('Tiempo agotado. Reinicia para un nuevo duelo.');
            return;
        }
        running = true;
        endTime = Date.now() + remaining * 1000;
        tick = setInterval(onTick, 250);
        toggle.textContent = 'Pausar';
        display.classList.remove('finished');
        setStatus('Duelo en curso');
    });

    reset.addEventListener('click', () => {
        stop();
        remaining = total;
        warned = false;
        display.className = 'timer-display';
        toggle.textContent = 'Iniciar duelo';
        render();
        setStatus('Listo para el duelo');
    });

    presets.forEach(btn => {
        btn.addEventListener('click', () => {
            if (running) {
                setStatus('El duelo está en curso. Pausa o reinicia antes de cambiar la duración.');
                return;
            }
            presets.forEach(b => b.classList.toggle('active', b === btn));
            total = Number(btn.dataset.mins) * 60;
            remaining = total;
            warned = false;
            display.classList.remove('warning', 'finished');
            toggle.textContent = 'Iniciar duelo';
            render();
            setStatus('Listo para el duelo');
        });
    });

    render();
}

/* ===========================
   SERVICE WORKER (OFFLINE)
   =========================== */
function setupServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const isSecure = location.protocol === 'https:'
        || location.hostname === 'localhost'
        || location.hostname === '127.0.0.1';
    if (!isSecure) return;

    const swPath = window.location.pathname.includes('/porfolio/') ? '../sw.js' : './sw.js';
    navigator.serviceWorker.register(swPath).catch(() => {
        /* offline no disponible en este contexto */
    });
}

function initPage() {
    highlightActiveMenu();
    setupScrollReveal();
    setupLazyMedia();
    setupTierlistFilters();
    setupImageModal();
    setupBanlistViewer();
    setupBackToTop();
    setupVideoEmbeds();
    setupDuelTimer();
    setupServiceWorker();
}

document.addEventListener('DOMContentLoaded', initPage);
