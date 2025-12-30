checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';

const testSupabaseBtn = document.getElementById('testSupabaseBtn');
const conexionResultados = document.getElementById('conexionResultados');

async function exportarTodosLosDatos() {
    try {
        const data = await Storage.exportAllData();
        const json = JSON.stringify(data, null, 2);

        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_corporacion_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

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
            `<div class="list-item"><strong>Última prueba:</strong> ${now}</div>`
        ].join('');

        showNotification('Conexión exitosa', 'success');
    } catch (err) {
        console.error(err);
        conexionResultados.innerHTML = '<div class="list-item text-center text-muted">No se pudo conectar. Revisa variables y Functions.</div>';
        showNotification('No se pudo conectar a Supabase', 'error');
    }
}

if (testSupabaseBtn) {
    testSupabaseBtn.addEventListener('click', testConexion);
}

window.exportarTodosLosDatos = exportarTodosLosDatos;
