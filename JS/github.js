/* Publicar cambios en el repositorio de GitHub desde el panel.
   Usa un token de acceso personal (fine-grained) con permiso "Contents: Read and
   write" solo sobre este repositorio. El token se guarda únicamente en el
   navegador del organizador (localStorage) y solo se envía a api.github.com. */
const GH = (() => {
    const CONFIG_KEY = 'xyz-github';
    const API = 'https://api.github.com';
    const defecto = { owner: 'XLexYzz', repo: 'Yugioh.github.io', branch: 'main', token: '' };

    function config() {
        return { ...defecto, ...XYZ.leer(CONFIG_KEY, {}) };
    }

    function guardar(c) {
        XYZ.guardar(CONFIG_KEY, { ...config(), ...c });
    }

    function olvidarToken() {
        guardar({ token: '' });
    }

    const listo = () => !!config().token;

    async function api(ruta, opciones = {}) {
        const c = config();
        const r = await fetch(`${API}${ruta}`, {
            ...opciones,
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                Authorization: `Bearer ${c.token}`,
                ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
            },
        });
        if (!r.ok) {
            let detalle = '';
            try { detalle = (await r.json()).message || ''; } catch { /* sin cuerpo */ }
            const motivos = {
                401: 'El token no es válido o ha caducado.',
                403: 'El token no tiene permiso de escritura en este repositorio (Contents: Read and write).',
                404: 'No se encuentra el repositorio, la rama o el archivo. Revisa usuario, repositorio y rama.',
                409: 'La rama ha cambiado mientras publicabas. Vuelve a intentarlo.',
                422: 'GitHub ha rechazado los datos.',
            };
            throw new Error(`${motivos[r.status] || `Error ${r.status} de GitHub.`}${detalle ? ` (${detalle})` : ''}`);
        }
        return r.status === 204 ? null : r.json();
    }

    const repo = () => `/repos/${encodeURIComponent(config().owner)}/${encodeURIComponent(config().repo)}`;

    // Texto UTF-8 a base64
    function base64Texto(texto) {
        const bytes = new TextEncoder().encode(texto);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }

    function textoDeBase64(b64) {
        const bin = atob(b64.replace(/\s/g, ''));
        return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }

    async function probar() {
        const info = await api(repo());
        await api(`${repo()}/branches/${encodeURIComponent(config().branch)}`);
        if (!info.permissions?.push) throw new Error('El token puede leer el repositorio pero no escribir en él.');
        return info;
    }

    // Contenido actual de un archivo de la rama (texto y sha del blob)
    async function leerArchivo(ruta) {
        const r = await api(`${repo()}/contents/${ruta.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config().branch)}`);
        return { texto: textoDeBase64(r.content), sha: r.sha };
    }

    /* archivos: [{ ruta, texto } | { ruta, base64 }] — todo en un único commit */
    async function publicar(archivos, mensaje) {
        const c = config();
        const ref = await api(`${repo()}/git/ref/heads/${encodeURIComponent(c.branch)}`);
        const padre = ref.object.sha;
        const commitPadre = await api(`${repo()}/git/commits/${padre}`);
        const arbol = [];
        for (const a of archivos) {
            const blob = await api(`${repo()}/git/blobs`, {
                method: 'POST',
                body: JSON.stringify({ content: a.base64 ?? base64Texto(a.texto), encoding: 'base64' }),
            });
            arbol.push({ path: a.ruta, mode: '100644', type: 'blob', sha: blob.sha });
        }
        const tree = await api(`${repo()}/git/trees`, {
            method: 'POST',
            body: JSON.stringify({ base_tree: commitPadre.tree.sha, tree: arbol }),
        });
        const commit = await api(`${repo()}/git/commits`, {
            method: 'POST',
            body: JSON.stringify({ message: mensaje, tree: tree.sha, parents: [padre] }),
        });
        await api(`${repo()}/git/refs/heads/${encodeURIComponent(c.branch)}`, {
            method: 'PATCH',
            body: JSON.stringify({ sha: commit.sha }),
        });
        return { sha: commit.sha, url: commit.html_url || `https://github.com/${c.owner}/${c.repo}/commit/${commit.sha}` };
    }

    return { config, guardar, olvidarToken, listo, probar, leerArchivo, publicar };
})();
