const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
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

function descargarBanlist() {
    const basePath = window.location.pathname.includes('/porfolio/')
        ? '../banlist/'
        : './banlist/';

    const url = `${basePath}Untitled Banlist.lflist.conf`;
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = '!XYZ-banlist.lflist.conf';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    mostrarToast('¡Archivo de banlist descargado correctamente!');
}

function highlightActiveMenu() {
    const links = document.querySelectorAll('.menu a');
    const path = window.location.pathname.split('/').pop() || 'index.html';

    links.forEach(link => {
        const href = link.getAttribute('href');
        const normalized = href.replace(/^\.\/?/, '');

        if (path === normalized || (path === 'index.html' && normalized === 'index.html')) {
            link.classList.add('active');
        }
    });
}

function setupLazyMedia() {
    document.querySelectorAll('img').forEach(img => {
        img.loading = 'lazy';
    });
    document.querySelectorAll('iframe').forEach(iframe => {
        iframe.loading = 'lazy';
    });
}

function setupScrollReveal() {
    const elements = document.querySelectorAll('.animate-up');
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.18 });

    elements.forEach(el => observer.observe(el));
}

function createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => modal.classList.remove('active'));

    const image = document.createElement('img');
    content.appendChild(image);
    content.appendChild(closeButton);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.remove('active');
        }
    });

    return { modal, image };
}

function setupImageModal() {
    const galleryItems = document.querySelectorAll('.image-grid img, .tierlist-grid img');
    if (!galleryItems.length) return;

    const { modal, image } = createModal();

    galleryItems.forEach(item => {
        item.style.cursor = 'zoom-in';
        item.addEventListener('click', () => {
            image.src = item.src;
            image.alt = item.alt || 'Imagen ampliada';
            modal.classList.add('active');
        });
    });
}

function setupTierlistFilters() {
    const buttons = document.querySelectorAll('.tierlist-filter button');
    const categories = document.querySelectorAll('.tierlist-category[data-tier]');
    if (!buttons.length || !categories.length) return;

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const selected = button.dataset.tier;

            categories.forEach(category => {
                const visible = selected === 'all' || category.dataset.tier === selected;
                category.style.display = visible ? 'block' : 'none';
            });
        });
    });
}

function initPage() {
    highlightActiveMenu();
    setupScrollReveal();
    setupLazyMedia();
    setupImageModal();
    setupTierlistFilters();
}

document.addEventListener('DOMContentLoaded', initPage);
