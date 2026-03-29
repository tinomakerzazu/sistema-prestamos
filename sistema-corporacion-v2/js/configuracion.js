checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';

const testSupabaseBtn = document.getElementById('testSupabaseBtn');
const conexionResultados = document.getElementById('conexionResultados');
const generateQrBtn = document.getElementById('generateQrBtn');
const qrApiBase = document.getElementById('qrApiBase');
const qrClientId = document.getElementById('qrClientId');
const qrToken = document.getElementById('qrToken');
const qrJson = document.getElementById('qrJson');
const trackingQr = document.getElementById('trackingQr');

async function exportarTodosLosDatos() {
    try {
        const data = await Storage.exportAllData();
        const json = JSON.stringify(data, null, 2);

        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_corporacion_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

        showNotification('Datos exportados exitosamente', 'success');
    } catch (err) {
        console.error(err);
        showNotification('No se pudo exportar la data', 'error');
    }
}

async function testConexion() {
    if (!conexionResultados) return;
    conexionResultados.innerHTML = '<div class="list-item text-center text-muted">Probando conexión...</div>';

    try {
        const [clientes, prestamos, pagos] = await Promise.all([
            Storage.getClientes(),
            Storage.getPrestamos(),
            Storage.getPagos()
        ]);

        const now = new Date().toLocaleString('es-PE');
        conexionResultados.innerHTML = [
            `<div class="list-item"><strong>Estado:</strong> Conectado</div>`,
            `<div class="list-item"><strong>Clientes:</strong> ${clientes.length}</div>`,
            `<div class="list-item"><strong>Préstamos:</strong> ${prestamos.length}</div>`,
            `<div class="list-item"><strong>Pagos:</strong> ${pagos.length}</div>`,
            `<div class="list-item"><strong>Última prueba:</strong> ${escapeHtml(now)}</div>`
        ].join('');

        showNotification('Conexión exitosa', 'success');
    } catch (err) {
        console.error(err);
        conexionResultados.innerHTML = '<div class="list-item text-center text-muted">No se pudo conectar. Revisa variables y Functions.</div>';
        showNotification('No se pudo conectar al servidor', 'error');
    }
}

if (testSupabaseBtn) {
    testSupabaseBtn.addEventListener('click', testConexion);
}

function getDefaultApiBase() {
    if (typeof window.__API_BASE__ === 'string' && window.__API_BASE__.trim()) {
        return window.__API_BASE__.trim();
    }
    const host = window.location.hostname;
    const port = window.location.port;
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3000') {
        return `${window.location.protocol}//${host}:3000/api`;
    }
    return `${window.location.origin}/api`;
}

function generateTrackingQr() {
    if (!qrApiBase || !qrClientId || !qrToken || !qrJson || !trackingQr) return;

    const payload = {
        clientId: qrClientId.value.trim(),
        token: qrToken.value.trim(),
        apiBaseUrl: qrApiBase.value.trim()
    };

    if (!payload.clientId || !payload.token || !payload.apiBaseUrl) {
        showNotification('Completa API, Client ID y Token para generar el QR', 'error');
        return;
    }

    const jsonText = JSON.stringify(payload);
    qrJson.value = jsonText;
    trackingQr.innerHTML = '';
    new QRCode(trackingQr, {
        text: jsonText,
        width: 220,
        height: 220,
        colorDark: '#ffffff',
        colorLight: '#141e2c'
    });
}

if (qrApiBase && !qrApiBase.value) {
    qrApiBase.value = getDefaultApiBase();
}

if (generateQrBtn) {
    generateQrBtn.addEventListener('click', generateTrackingQr);
}

window.exportarTodosLosDatos = exportarTodosLosDatos;
