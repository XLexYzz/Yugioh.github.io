/* Service worker de Yu-Gi-Oh! XYZ:
   - pre-cachea la "cáscara" (páginas, css, js, miniaturas, banlist)
   - navegaciones: red primero, caché de respaldo
   - recursos propios: stale-while-revalidate
   - fuentes de Google: caché sin caducidad
   Aumenta SHELL_VERSION al cambiar el contenido de la cáscara.
*/
const SHELL_VERSION = 'v5';
const CACHE_SHELL = `xyz-shell-${SHELL_VERSION}`;
const CACHE_STATIC = `xyz-static-${SHELL_VERSION}`;
// Imágenes y datos de cartas de YGOPRODeck: se conservan entre versiones
const CACHE_CARDS = 'xyz-cartas';
const MAX_CARD_IMAGES = 400;

const SHELL = [
    './',
    './index.html',
    './porfolio/torneos.html',
    './porfolio/banlist.html',
    './porfolio/reglas.html',
    './porfolio/tierlist.html',
    './porfolio/herramientas.html',
    './porfolio/mazos.html',
    './porfolio/estadisticas.html',
    './porfolio/editor.html',
    './404.html',
    './estilos/styles.css',
    './JS/script.js',
    './JS/interactivo.js',
    './JS/mazos.js',
    './JS/herramientas.js',
    './JS/reglas.js',
    './JS/tiermaker.js',
    './JS/torneos-datos.js',
    './JS/torneos.js',
    './JS/estadisticas.js',
    './JS/editor.js',
    './JS/inicio.js',
    './estilos/arena.css',
    './datos/torneos.json',
    './estilos/interactivo.css',
    './manifest.webmanifest',
    './favicon.svg',
    './img/hero.svg',
    './img/og-image.png',
    './img/apple-touch-icon.png',
    './img/icon-192.png',
    './img/video-1.jpg',
    './img/video-2.jpg',
    './img/video-3.jpg',
    './banlist/Untitled Banlist.lflist.conf'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_SHELL).then((cache) =>
                Promise.allSettled(SHELL.map((url) => cache.add(url)))),
            caches.open(CACHE_STATIC).then((cache) =>
                Promise.allSettled(SHELL.map((url) => cache.add(url))))
        ])
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys
                .filter((key) => key !== CACHE_SHELL && key !== CACHE_STATIC && key !== CACHE_CARDS)
                .map((key) => caches.delete(key)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Fuentes de Google: caché persistente (el cruce de origen lo deja opaco)
    if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(
            caches.open(CACHE_STATIC).then(async (cache) => {
                const hit = await cache.match(request);
                if (hit) return hit;
                const response = await fetch(request);
                if (response.ok || response.type === 'opaque') {
                    cache.put(request, response.clone()).catch(() => {});
                }
                return response;
            })
        );
        return;
    }

    // Imágenes de cartas: caché primero (así no se piden una y otra vez a YGOPRODeck)
    if (url.origin === 'https://images.ygoprodeck.com') {
        event.respondWith(
            caches.open(CACHE_CARDS).then(async (cache) => {
                const hit = await cache.match(request);
                if (hit) return hit;
                const response = await fetch(request);
                if (response.ok || response.type === 'opaque') {
                    await cache.put(request, response.clone()).catch(() => {});
                    const keys = await cache.keys();
                    const images = keys.filter((k) => k.url.startsWith('https://images.ygoprodeck.com'));
                    if (images.length > MAX_CARD_IMAGES) {
                        await Promise.all(images.slice(0, images.length - MAX_CARD_IMAGES).map((k) => cache.delete(k)));
                    }
                }
                return response;
            })
        );
        return;
    }

    // Datos de cartas: red primero; sin conexión, la última respuesta guardada
    if (url.origin === 'https://db.ygoprodeck.com') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_CARDS).then((cache) => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request)) || Response.error())
        );
        return;
    }

    // Otros orígenes (YouTube, etc.): sin tocar
    if (url.origin !== location.origin) return;

    // Datos de torneos: red primero para ver los resultados recién publicados
    if (url.pathname.includes('/datos/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_STATIC).then((cache) => cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(async () => (await caches.match(request, { ignoreSearch: true })) || Response.error())
        );
        return;
    }

    // Navegaciones: red primero; si no hay red, lo que esté en caché
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_SHELL).then((cache) =>
                            cache.put(request, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request, { ignoreSearch: true });
                    const fallback = await caches.match('./index.html');
                    return cached || fallback || Response.error();
                })
        );
        return;
    }

    // Imágenes, css, js, banlist: respuesta desde caché con revalidado en segundo plano
    event.respondWith(
        caches.open(CACHE_STATIC).then(async (cache) => {
            const hit = await cache.match(request);
            const network = fetch(request).then((response) => {
                if (response.ok) {
                    cache.put(request, response.clone()).catch(() => {});
                }
                return response;
            }).catch(() => null);
            const response = hit || (await network);
            if (!response) {
                const fallback = await caches.match('./index.html');
                return fallback || Response.error();
            }
            return response;
        })
    );
});
