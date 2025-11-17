// JS/script.js

function descargarBanlist() {
    // En lugar de tener el contenido hardcodeado, ahora apunta a tu archivo
    const url = './banlist/XYZ_banlist.lflist.conf';
    
    // Crear un enlace temporal para la descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = 'XYZ_banlist.lflist.conf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Mostrar notificación de descarga exitosa
    mostrarNotificacion('¡Archivo descargado correctamente!');
}

function mostrarNotificacion(mensaje) {
    const notificacion = document.createElement('div');
    notificacion.textContent = mensaje;
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary);
        color: var(--dark);
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.remove();
    }, 3000);
}

// Agregar estilos para la animación si no existen
if (!document.querySelector('#notificacion-styles')) {
    const style = document.createElement('style');
    style.id = 'notificacion-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}


console.log('Script de banlist cargado correctamente');
