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
const indicadorRecuperacion = document.getElementById('indicadorRecuperacion');
const indicadorMorosidad = document.getElementById('indicadorMorosidad');
const indicadorTicket = document.getElementById('indicadorTicket');
const trendRecuperacion = document.getElementById('trendRecuperacion');
const trendMorosidad = document.getElementById('trendMorosidad');
const trendTicket = document.getElementById('trendTicket');
const comparativoMensualBody = document.getElementById('comparativoMensualBody');

function parseDate(val) {
    if (!val) return null;
    const d = new Date(`${val}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isInMonth(date, year, month) {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() === year && d.getMonth() === month;
}

async function loadAndRenderAdvancedReport() {
    try {
        const [pagos, prestamos] = await Promise.all([
            Storage.getPagos(),
            Storage.getPrestamos()
        ]);

        const capitalPrestado = prestamos
            .filter(p => (p.estado || '').toLowerCase() === 'activo' || (p.estado || '').toLowerCase() === 'vencido')
            .reduce((sum, p) => sum + parseFloat(p.montoPrestado || 0), 0);

        const totalCobrado = pagos
            .filter(p => (p.estado || '').toLowerCase() === 'aplicado' || (p.estado || '').toLowerCase() === 'registrado')
            .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

        const prestamosActivos = prestamos.filter(p => (p.estado || '').toLowerCase() === 'activo').length;
        const prestamosVencidos = prestamos.filter(p => (p.estado || '').toLowerCase() === 'vencido').length;
        const totalPrestamos = prestamosActivos + prestamosVencidos;

        const indiceRecuperacion = capitalPrestado > 0
            ? Math.min(100, Math.round((totalCobrado / capitalPrestado) * 100))
            : (totalCobrado > 0 ? 100 : 0);

        const morosidad = totalPrestamos > 0
            ? Math.round((prestamosVencidos / totalPrestamos) * 1000) / 10
            : 0;

        const ticketPromedio = pagos.length > 0
            ? pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0) / pagos.length
            : 0;

        if (indicadorRecuperacion) indicadorRecuperacion.textContent = `${indiceRecuperacion}%`;
        if (indicadorMorosidad) indicadorMorosidad.textContent = `${morosidad}%`;
        if (indicadorTicket) indicadorTicket.textContent = typeof formatMoney === 'function' ? formatMoney(ticketPromedio) : `S/ ${ticketPromedio.toFixed(2)}`;

        if (trendRecuperacion) {
            const span = trendRecuperacion.querySelector('span');
            if (span) span.textContent = capitalPrestado > 0 ? 'Según capital prestado' : 'Sin préstamos activos';
        }
        if (trendMorosidad) {
            const span = trendMorosidad.querySelector('span');
            if (span) span.textContent = prestamosVencidos > 0 ? 'Requiere monitoreo' : 'Al día';
        }
        if (trendTicket) {
            const span = trendTicket.querySelector('span');
            if (span) span.textContent = pagos.length > 0 ? `${pagos.length} pagos registrados` : 'Sin pagos';
        }

        const now = new Date();
        const rows = [];
        for (let i = 5; i >= 0; i -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();

            const cobradoMes = pagos
                .filter(p => isInMonth(parseDate(p.fecha), y, m))
                .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

            const vencidosMes = prestamos.filter(p => {
                const creado = parseDate(p.createdAt);
                return creado && creado <= new Date(y, m + 1, 0) && (p.estado || '').toLowerCase() === 'vencido';
            }).length;

            const activosMes = prestamos.filter(p => {
                const creado = parseDate(p.createdAt);
                return creado && creado <= new Date(y, m + 1, 0) && ((p.estado || '').toLowerCase() === 'activo' || (p.estado || '').toLowerCase() === 'vencido');
            }).length;

            const morosidadMes = activosMes + vencidosMes > 0
                ? Math.round((vencidosMes / (activosMes + vencidosMes)) * 1000) / 10
                : 0;

            const eficienciaMes = capitalPrestado > 0
                ? Math.min(100, Math.round((cobradoMes / capitalPrestado) * 100))
                : 0;

            const label = d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
            const cobradoStr = typeof formatMoney === 'function' ? formatMoney(cobradoMes) : `S/ ${cobradoMes.toFixed(2)}`;
            rows.push(`<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(cobradoStr)}</td><td>${morosidadMes}%</td><td>${eficienciaMes}%</td></tr>`);
        }

        if (comparativoMensualBody) {
            comparativoMensualBody.innerHTML = rows.length
                ? rows.join('')
                : '<tr><td colspan="4" class="text-center text-muted">No hay datos disponibles</td></tr>';
        }
    } catch (err) {
        console.error(err);
        if (indicadorRecuperacion) indicadorRecuperacion.textContent = '--';
        if (indicadorMorosidad) indicadorMorosidad.textContent = '--';
        if (indicadorTicket) indicadorTicket.textContent = '--';
        if (comparativoMensualBody) {
            comparativoMensualBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Error al cargar datos</td></tr>';
        }
    }
}

function exportAdvancedReport() {
    const titulo = 'Reporte avanzado';
    const fecha = new Date().toLocaleString('es-PE');
    const indicadores = [
        indicadorRecuperacion?.textContent ? `Índice de recuperación: ${indicadorRecuperacion.textContent}` : '',
        indicadorMorosidad?.textContent ? `Morosidad: ${indicadorMorosidad.textContent}` : '',
        indicadorTicket?.textContent ? `Ticket promedio: ${indicadorTicket.textContent}` : ''
    ].filter(Boolean);

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
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

if (exportAdvancedReportBtn) {
    exportAdvancedReportBtn.addEventListener('click', exportAdvancedReport);
}

window.exportAdvancedReport = exportAdvancedReport;

loadAndRenderAdvancedReport();
