if (typeof checkAuth === 'function') {
    checkAuth();
}

const userNameEl = document.getElementById('userName');
if (userNameEl) {
    userNameEl.textContent = sessionStorage.getItem('userName') || 'Usuario';
}

if (typeof updateBadges === 'function') {
    updateBadges();
}

const exportAdvancedReportBtn = document.getElementById('exportAdvancedReportBtn');

function exportAdvancedReport() {
    const titulo = 'Reporte avanzado';
    const fecha = new Date().toLocaleString('es-PE');
    const indicadores = Array.from(document.querySelectorAll('.stats-grid .stat-info')).map(info => {
        const value = info.querySelector('h3')?.textContent?.trim() || '-';
        const label = info.querySelector('p')?.textContent?.trim() || '-';
        return `${label}: ${value}`;
    });

    const claves = Array.from(document.querySelectorAll('.content-grid .list-item')).map(item => item.textContent.trim());

    const contenido = [
        titulo,
        `Generado: ${fecha}`,
        '',
        'Indicadores:',
        ...indicadores,
        '',
        'Notas clave:',
        ...claves
    ].join('\n');

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_avanzado_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
}

if (exportAdvancedReportBtn) {
    exportAdvancedReportBtn.addEventListener('click', exportAdvancedReport);
}

window.exportAdvancedReport = exportAdvancedReport;
