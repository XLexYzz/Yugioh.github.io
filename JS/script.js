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

    buttons.forEach(button => {
        button.setAttribute('aria-pressed', button.classList.contains('active'));
        button.addEventListener('click', () => {
            buttons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            selected = button.dataset.tier;
            apply();
        });
    });

    search?.addEventListener('input', apply);
}

/* ===========================
   BANLIST
   =========================== */
const BAN_STATUS = {
    0: { titulo: 'Prohibidas', clase: 'forbidden', copias: 'Prohibida' },
    1: { titulo: 'Limitadas', clase: 'limited', copias: '1 copia' },
    2: { titulo: 'Semi-limitadas', clase: 'semi', copias: '2 copias' },
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

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selected = button.dataset.status;
            render();
        });
    });
    search?.addEventListener('input', render);

    render();
}

function initPage() {
    highlightActiveMenu();
    setupScrollReveal();
    setupLazyMedia();
    setupTierlistFilters();
    setupImageModal();
    setupBanlistViewer();
}

document.addEventListener('DOMContentLoaded', initPage);
