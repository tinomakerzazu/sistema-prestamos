checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
updateBadges();

const reportStartDate = document.getElementById('reportStartDate');
const reportEndDate = document.getElementById('reportEndDate');
const reportMetodo = document.getElementById('reportMetodo');
const reportEstado = document.getElementById('reportEstado');

const reportUpdatedTag = document.getElementById('reportUpdatedTag');
const reportTotalTag = document.getElementById('reportTotalTag');
const reportPaymentsTag = document.getElementById('reportPaymentsTag');
const reportRangeLabel = document.getElementById('reportRangeLabel');

const kpiTotalCobrado = document.getElementById('kpiTotalCobrado');
const kpiCobradoChange = document.getElementById('kpiCobradoChange');
const kpiPagosCount = document.getElementById('kpiPagosCount');
const kpiPagosRange = document.getElementById('kpiPagosRange');
const kpiTicketPromedio = document.getElementById('kpiTicketPromedio');
const kpiTicketTag = document.getElementById('kpiTicketTag');
const kpiClientesActivos = document.getElementById('kpiClientesActivos');
const kpiClientesTag = document.getElementById('kpiClientesTag');

const monthlyChart = document.getElementById('monthlyChart');
const monthlyTotalLabel = document.getElementById('monthlyTotalLabel');
const metodoList = document.getElementById('metodoList');
const topClientesList = document.getElementById('topClientesList');
const reportInsights = document.getElementById('reportInsights');
const reportPagosBody = document.getElementById('reportPagosBody');

const generateReportBtn = document.getElementById('generateReportBtn');
const clearReportFiltersBtn = document.getElementById('clearReportFiltersBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const downloadResumenBtn = document.getElementById('downloadResumenBtn');

let pagosCache = [];

function parseDate(value) {
    if (!value) return null;
    return new Date(`${value}T00:00:00`);
}

function isWithinRange(date, start, end) {
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
}

function setDefaultRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    reportStartDate.valueAsDate = start;
    reportEndDate.valueAsDate = end;
}

function getFilteredPagos() {
    const startDate = parseDate(reportStartDate.value);
    const endDate = parseDate(reportEndDate.value);
    const metodoValue = reportMetodo.value;
    const estadoValue = reportEstado.value;

    return pagosCache.filter(pago => {
        const pagoDate = parseDate(pago.fecha);
        const matchesDate = isWithinRange(pagoDate, startDate, endDate);
        const matchesMetodo = !metodoValue || pago.metodo === metodoValue;
        const matchesEstado = !estadoValue || pago.estado === estadoValue;
        return matchesDate && matchesMetodo && matchesEstado;
    });
}

function calculateTotals(pagos) {
    const total = pagos.reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0);
    const count = pagos.length;
    const average = count ? total / count : 0;
    return { total, count, average };
}

function getMonthlySeries(pagos, monthsCount = 6) {
    const series = [];
    const now = new Date();

    for (let i = monthsCount - 1; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = date.toLocaleDateString('es-PE', { month: 'short' });
        const total = pagos
            .filter(pago => {
                const pagoDate = parseDate(pago.fecha);
                return pagoDate && pagoDate.getMonth() === date.getMonth() &&
                    pagoDate.getFullYear() === date.getFullYear();
            })
            .reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0);
        series.push({ label, total });
    }
    return series;
}

function renderMonthlyChart(pagos) {
    const series = getMonthlySeries(pagos);
    const maxValue = Math.max(...series.map(item => item.total), 1);

    monthlyChart.innerHTML = series
        .map(item => `<span style="--value: ${Math.round((item.total / maxValue) * 100)}" data-label="${item.label}"></span>`)
        .join('');

    const monthlyTotal = series.reduce((sum, item) => sum + item.total, 0);
    monthlyTotalLabel.textContent = formatMoney(monthlyTotal);
}

function renderMetodoList(pagos) {
    const metodoOrder = ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin'];
    const counts = metodoOrder.reduce((acc, metodo) => {
        acc[metodo] = pagos.filter(pago => pago.metodo === metodo).length;
        return acc;
    }, {});

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;

    metodoList.innerHTML = metodoOrder.map(metodo => {
        const count = counts[metodo];
        const percentage = Math.round((count / total) * 100);
        return `
            <div class="meter-item">
                <div>
                    <div class="meter-label">${metodo}</div>
                    <div class="meter-bar"><span style="--value: ${percentage}%"></span></div>
                </div>
                <div class="meter-value">${percentage}%</div>
            </div>
        `;
    }).join('');
}

function renderTopClientes(pagos) {
    const totals = pagos.reduce((acc, pago) => {
        const cliente = pago.cliente || 'Sin nombre';
        acc[cliente] = (acc[cliente] || 0) + parseFloat(pago.monto || 0);
        return acc;
    }, {});

    const top = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (!top.length) {
        topClientesList.innerHTML = '<div class="list-item text-center text-muted">Sin pagos registrados</div>';
        return;
    }

    topClientesList.innerHTML = top.map(([cliente, total]) => `
        <div class="list-item">
            <strong>${cliente}</strong>
            <div class="text-muted">${formatMoney(total)}</div>
        </div>
    `).join('');
}

function renderInsights(pagos) {
    const { total, average } = calculateTotals(pagos);
    const metodoPopular = pagos.reduce((acc, pago) => {
        acc[pago.metodo] = (acc[pago.metodo] || 0) + 1;
        return acc;
    }, {});
    const metodoTop = Object.keys(metodoPopular).sort((a, b) => metodoPopular[b] - metodoPopular[a])[0] || 'Sin datos';

    const insights = [
        `Método más usado: ${metodoTop}`,
        `Ticket promedio: ${formatMoney(average)}`,
        `Total cobrado: ${formatMoney(total)}`
    ];

    reportInsights.innerHTML = insights.map(text => `
        <div class="list-item">
            <i class="bi bi-stars"></i>
            ${text}
        </div>
    `).join('');
}

function renderReportTable(pagos) {
    if (!pagos.length) {
        reportPagosBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay pagos registrados</td></tr>';
        return;
    }

    reportPagosBody.innerHTML = pagos
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 8)
        .map(pago => `
            <tr>
                <td>${formatDate(pago.fecha)}</td>
                <td>${pago.cliente || '-'}</td>
                <td>${pago.metodo || '-'}</td>
                <td>${pago.referencia || '-'}</td>
                <td>${formatMoney(pago.monto)}</td>
                <td><span class="status-pill status-${pago.estado || 'Registrado'}">${pago.estado || 'Registrado'}</span></td>
            </tr>
        `).join('');
}

function updateHeaderTags(pagos) {
    const { total, count } = calculateTotals(pagos);
    reportUpdatedTag.textContent = `Actualizado: ${formatDate(new Date().toISOString())}`;
    reportTotalTag.textContent = `Total: ${formatMoney(total)}`;
    reportPaymentsTag.textContent = `${count} pagos`;
}

function updateKpis(pagos) {
    const { total, count, average } = calculateTotals(pagos);
    kpiTotalCobrado.textContent = formatMoney(total);
    kpiPagosCount.textContent = count;
    kpiTicketPromedio.textContent = formatMoney(average);

    const uniqueClientes = new Set(pagos.map(pago => pago.cliente).filter(Boolean)).size;
    kpiClientesActivos.textContent = uniqueClientes;

    const change = getPeriodChange();
    kpiCobradoChange.textContent = `${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}%`;
    kpiCobradoChange.classList.toggle('positive', change.percent >= 0);
    kpiPagosRange.textContent = change.label;
    kpiTicketTag.textContent = `Meta ${formatMoney(250)}`;
    kpiClientesTag.textContent = 'Con pagos recientes';
}

function getPeriodChange() {
    const startDate = parseDate(reportStartDate.value);
    const endDate = parseDate(reportEndDate.value);
    if (!startDate || !endDate) {
        return { percent: 0, label: 'Últimos 30 días' };
    }

    const rangeDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - rangeDays + 1);

    const currentTotal = pagosCache
        .filter(p => isWithinRange(parseDate(p.fecha), startDate, endDate))
        .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
    const prevTotal = pagosCache
        .filter(p => isWithinRange(parseDate(p.fecha), prevStart, prevEnd))
        .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

    const percent = prevTotal ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
    const label = `Periodo ${formatDate(startDate.toISOString())} - ${formatDate(endDate.toISOString())}`;
    reportRangeLabel.textContent = label;
    return { percent, label: `Últimos ${rangeDays} días` };
}

function renderReport() {
    const pagos = getFilteredPagos();
    updateHeaderTags(pagos);
    updateKpis(pagos);
    renderMonthlyChart(pagos);
    renderMetodoList(pagos);
    renderTopClientes(pagos);
    renderInsights(pagos);
    renderReportTable(pagos);
}

function exportReportCSV() {
    const pagos = getFilteredPagos();
    if (!pagos.length) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }
    const header = ['Fecha', 'Cliente', 'Método', 'Referencia', 'Monto', 'Estado'];
    const rows = pagos.map(pago => [
        formatDate(pago.fecha),
        pago.cliente || '',
        pago.metodo || '',
        pago.referencia || '',
        pago.monto || '',
        pago.estado || ''
    ]);
    const csvContent = [header, ...rows].map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function downloadResumen() {
    const pagos = getFilteredPagos();
    const { total, count, average } = calculateTotals(pagos);
    const resumen = [
        'Resumen de reportes',
        `Periodo: ${reportStartDate.value || '-'} a ${reportEndDate.value || '-'}`,
        `Total cobrado: ${formatMoney(total)}`,
        `Pagos registrados: ${count}`,
        `Ticket promedio: ${formatMoney(average)}`
    ].join('\n');

    const blob = new Blob([resumen], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resumen_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
}

async function loadPagos() {
    try {
        pagosCache = await Storage.getPagos();
        renderReport();
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los pagos', 'error');
    }
}

generateReportBtn.addEventListener('click', renderReport);
clearReportFiltersBtn.addEventListener('click', () => {
    reportMetodo.value = '';
    reportEstado.value = '';
    setDefaultRange();
    renderReport();
});
exportCsvBtn.addEventListener('click', exportReportCSV);
downloadResumenBtn.addEventListener('click', downloadResumen);

setDefaultRange();
loadPagos();
