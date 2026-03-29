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
const exportPdfBtn = document.getElementById('exportPdfBtn');

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
        .map(item => `<span style="--value: ${Math.round((item.total / maxValue) * 100)}" data-label="${escapeHtml(item.label)}"></span>`)
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
                    <div class="meter-label">${escapeHtml(metodo)}</div>
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
            <strong>${escapeHtml(cliente)}</strong>
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
            ${escapeHtml(text)}
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
                <td>${escapeHtml(pago.cliente || '-')}</td>
                <td>${escapeHtml(pago.metodo || '-')}</td>
                <td>${escapeHtml(pago.referencia || '-')}</td>
                <td>${formatMoney(pago.monto)}</td>
                <td><span class="status-pill status-${pago.estado || 'Registrado'}">${escapeHtml(pago.estado || 'Registrado')}</span></td>
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
    kpiTicketTag.textContent = 'Por pago en el rango';
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
    const csvContent = [header, ...rows].map(row => row.map(value => escapeCsvValue(value)).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/* ============================================================
   EXPORTAR PDF PREMIUM – NORSE KREDIT
   ============================================================ */
function exportReportPDF() {
    const pagos = getFilteredPagos();
    if (!pagos.length) {
        showNotification('No hay datos para exportar a PDF', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageW - margin * 2;
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    const periodoStr = `${reportStartDate.value || '-'} al ${reportEndDate.value || '-'}`;
    const { total, count, average } = calculateTotals(pagos);
    const uniqueClientes = new Set(pagos.map(p => p.cliente).filter(Boolean)).size;

    // Colores corporativos
    const NAVY      = [15, 22, 34];
    const DARK_BLUE = [47, 95, 158];
    const ACCENT    = [31, 158, 166];
    const WHITE     = [255, 255, 255];
    const LIGHT_BG  = [245, 247, 250];
    const MEDIUM_BG = [230, 235, 242];
    const TEXT_DARK  = [30, 40, 55];
    const TEXT_MED   = [100, 110, 130];
    const GOLD_DARK  = [47, 95, 158];

    function addPageFooter(pageNum, totalPages) {
        doc.setDrawColor(...MEDIUM_BG);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 16, pageW - margin, pageH - 16);
        doc.setFontSize(7.5);
        doc.setTextColor(...TEXT_MED);
        doc.text('Norse Kredit \u2022 Sistema de Gestión de Préstamos', margin, pageH - 11);
        doc.text(`Generado: ${dateStr} a las ${timeStr}`, margin, pageH - 7);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, pageH - 9, { align: 'right' });
    }

    // ═══════════════════════════════════════════
    //  ENCABEZADO PRINCIPAL
    // ═══════════════════════════════════════════
    // Fondo navy top
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 52, 'F');

    // Línea decorativa accent
    doc.setFillColor(...ACCENT);
    doc.rect(0, 52, pageW, 1.5, 'F');

    // Logotipo texto
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...WHITE);
    doc.text('NORSE KREDIT', margin, 20);

    // Subtitulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(170, 190, 220);
    doc.text('Sistema de Gestión de Préstamos', margin, 27);

    // Título del reporte
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...WHITE);
    doc.text('REPORTE FINANCIERO', margin, 38);

    // Periodo y fecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(170, 190, 220);
    doc.text(`Periodo: ${periodoStr}`, margin, 45);
    doc.text(dateStr, pageW - margin, 45, { align: 'right' });

    // ═══════════════════════════════════════════
    //  TARJETAS KPI
    // ═══════════════════════════════════════════
    let y = 62;
    const kpiLabels = ['Total cobrado', 'Pagos registrados', 'Ticket promedio', 'Clientes activos'];
    const kpiValues = [formatMoney(total), String(count), formatMoney(average), String(uniqueClientes)];
    const cardW = (contentW - 9) / 4;

    for (let i = 0; i < 4; i++) {
        const cardX = margin + i * (cardW + 3);

        // Sombra
        doc.setFillColor(220, 225, 235);
        doc.roundedRect(cardX + 0.5, y + 0.5, cardW, 26, 3, 3, 'F');

        // Card blanca
        doc.setFillColor(...WHITE);
        doc.roundedRect(cardX, y, cardW, 26, 3, 3, 'F');

        // Borde superior accent
        const kpiColors = [DARK_BLUE, ACCENT, [100, 130, 180], [80, 160, 120]];
        doc.setFillColor(...kpiColors[i]);
        doc.rect(cardX, y, cardW, 2.5, 'F');

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_MED);
        doc.text(kpiLabels[i], cardX + cardW / 2, y + 10, { align: 'center' });

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...TEXT_DARK);
        doc.text(kpiValues[i], cardX + cardW / 2, y + 20, { align: 'center' });
    }

    // ═══════════════════════════════════════════
    //  SECCIÓN: DISTRIBUCIÓN POR MÉTODO
    // ═══════════════════════════════════════════
    y = 98;

    // Título sección
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK_BLUE);
    doc.text('\u25C6  DISTRIBUCIÓN POR MÉTODO DE PAGO', margin + 4, y + 6.5);

    y += 14;

    const metodoOrder = ['Efectivo', 'Transferencia', 'Tarjeta', 'Yape/Plin'];
    const metodoCounts = metodoOrder.reduce((acc, m) => {
        acc[m] = pagos.filter(p => p.metodo === m).length;
        return acc;
    }, {});
    const metodoTotal = Object.values(metodoCounts).reduce((s, v) => s + v, 0) || 1;
    const metodoMontos = metodoOrder.reduce((acc, m) => {
        acc[m] = pagos.filter(p => p.metodo === m).reduce((s, p) => s + parseFloat(p.monto || 0), 0);
        return acc;
    }, {});
    const barColors = [[47, 95, 158], [31, 158, 166], [100, 130, 180], [140, 100, 180]];

    for (let i = 0; i < metodoOrder.length; i++) {
        const metodo = metodoOrder[i];
        const pct = Math.round((metodoCounts[metodo] / metodoTotal) * 100);
        const barW = Math.max((pct / 100) * (contentW - 80), 2);

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT_DARK);
        doc.text(metodo, margin + 2, y + 4);

        // Barra fondo
        doc.setFillColor(...LIGHT_BG);
        doc.roundedRect(margin + 40, y, contentW - 80, 5.5, 1.5, 1.5, 'F');

        // Barra valor
        doc.setFillColor(...barColors[i]);
        doc.roundedRect(margin + 40, y, barW, 5.5, 1.5, 1.5, 'F');

        // Porcentaje y monto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_DARK);
        doc.text(`${pct}%`, pageW - margin - 22, y + 4, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_MED);
        doc.text(formatMoney(metodoMontos[metodo]), pageW - margin, y + 4, { align: 'right' });

        y += 9;
    }

    // ═══════════════════════════════════════════
    //  SECCIÓN: TOP 5 CLIENTES
    // ═══════════════════════════════════════════
    y += 4;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK_BLUE);
    doc.text('\u25C6  TOP 5 CLIENTES', margin + 4, y + 6.5);

    y += 13;

    const clienteTotals = pagos.reduce((acc, p) => {
        const c = p.cliente || 'Sin nombre';
        acc[c] = (acc[c] || 0) + parseFloat(p.monto || 0);
        return acc;
    }, {});
    const topClientes = Object.entries(clienteTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (topClientes.length) {
        for (let i = 0; i < topClientes.length; i++) {
            const [nombre, monto] = topClientes[i];
            const isEven = i % 2 === 0;

            if (isEven) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y - 3.5, contentW, 8, 'F');
            }

            // Ranking
            doc.setFillColor(...DARK_BLUE);
            doc.circle(margin + 5, y, 3, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(...WHITE);
            doc.text(String(i + 1), margin + 5, y + 1, { align: 'center' });

            // Nombre
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...TEXT_DARK);
            doc.text(nombre, margin + 12, y + 1);

            // Monto
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...DARK_BLUE);
            doc.text(formatMoney(monto), pageW - margin, y + 1, { align: 'right' });

            y += 8;
        }
    } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MED);
        doc.text('No hay clientes en este periodo', margin + 4, y);
        y += 8;
    }

    // ═══════════════════════════════════════════
    //  SECCIÓN: FLUJO MENSUAL
    // ═══════════════════════════════════════════
    y += 6;

    if (y > pageH - 80) {
        doc.addPage();
        y = 20;
    }

    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK_BLUE);
    doc.text('\u25C6  FLUJO MENSUAL (ÚLTIMOS 6 MESES)', margin + 4, y + 6.5);

    y += 14;

    const series = getMonthlySeries(pagos);
    const maxVal = Math.max(...series.map(s => s.total), 1);
    const chartH = 30;
    const chartBarW = (contentW - 20) / series.length;

    for (let i = 0; i < series.length; i++) {
        const barH = Math.max((series[i].total / maxVal) * chartH, 1);
        const bx = margin + 10 + i * chartBarW;

        // Barra
        doc.setFillColor(...DARK_BLUE);
        doc.roundedRect(bx + 2, y + chartH - barH, chartBarW - 8, barH, 1.5, 1.5, 'F');

        // Label mes
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_MED);
        doc.text(series[i].label, bx + (chartBarW - 4) / 2, y + chartH + 5, { align: 'center' });

        // Monto encima de la barra
        if (series[i].total > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.setTextColor(...TEXT_DARK);
            doc.text(formatMoney(series[i].total), bx + (chartBarW - 4) / 2, y + chartH - barH - 2, { align: 'center' });
        }
    }

    y += chartH + 12;

    // ═══════════════════════════════════════════
    //  TABLA DE PAGOS DETALLADA
    // ═══════════════════════════════════════════
    if (y > pageH - 60) {
        doc.addPage();
        y = 20;
    }

    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...DARK_BLUE);
    doc.text('\u25C6  DETALLE DE PAGOS', margin + 4, y + 6.5);

    y += 12;

    const sortedPagos = [...pagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    doc.autoTable({
        startY: y,
        margin: { left: margin, right: margin },
        head: [['#', 'Fecha', 'Cliente', 'Método', 'Referencia', 'Monto', 'Estado']],
        body: sortedPagos.map((pago, i) => [
            String(i + 1),
            formatDate(pago.fecha),
            pago.cliente || '-',
            pago.metodo || '-',
            pago.referencia || '-',
            formatMoney(pago.monto),
            pago.estado || 'Registrado'
        ]),
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 3,
            lineColor: [220, 225, 235],
            lineWidth: 0.2,
            textColor: TEXT_DARK,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: NAVY,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 7.5,
            halign: 'center',
            cellPadding: 3.5
        },
        bodyStyles: {
            halign: 'left'
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 24 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 26 },
            4: { cellWidth: 24 },
            5: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
            6: { halign: 'center', cellWidth: 22 }
        },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 6) {
                const estado = data.cell.raw;
                if (estado === 'Aplicado') {
                    data.cell.styles.textColor = [22, 130, 75];
                    data.cell.styles.fontStyle = 'bold';
                } else if (estado === 'Observado') {
                    data.cell.styles.textColor = [200, 80, 30];
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = DARK_BLUE;
                }
            }
        },
        didDrawPage: function() {}
    });

    // ═══════════════════════════════════════════
    //  RESUMEN AL FINAL
    // ═══════════════════════════════════════════
    const finalY = doc.lastAutoTable.finalY + 8;
    const totalPages = doc.internal.getNumberOfPages();

    if (finalY < pageH - 40) {
        // Línea separadora
        doc.setDrawColor(...MEDIUM_BG);
        doc.setLineWidth(0.3);
        doc.line(margin, finalY, pageW - margin, finalY);

        // Resumen final
        const summaryY = finalY + 8;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, summaryY - 4, contentW, 22, 3, 3, 'F');
        doc.setDrawColor(...DARK_BLUE);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, summaryY - 4, contentW, 22, 3, 3, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...DARK_BLUE);
        doc.text('RESUMEN TOTAL', margin + 5, summaryY + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_DARK);
        doc.text(`${count} pagos registrados`, margin + 5, summaryY + 10);
        doc.text(`${uniqueClientes} clientes activos`, margin + 55, summaryY + 10);
        doc.text(`Promedio: ${formatMoney(average)}`, margin + 105, summaryY + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...DARK_BLUE);
        doc.text(formatMoney(total), pageW - margin - 5, summaryY + 8, { align: 'right' });
    }

    // ═══════════════════════════════════════════
    //  PAGINACIÓN Y FOOTERS
    // ═══════════════════════════════════════════
    const updatedTotalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= updatedTotalPages; p++) {
        doc.setPage(p);
        addPageFooter(p, updatedTotalPages);
    }

    // Guardar
    const fileName = `NorseKredit_Reporte_${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showNotification(`PDF descargado: ${fileName}`, 'success');
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

if (generateReportBtn) {
    generateReportBtn.addEventListener('click', renderReport);
}
if (clearReportFiltersBtn) {
    clearReportFiltersBtn.addEventListener('click', () => {
        reportMetodo.value = '';
        reportEstado.value = '';
        setDefaultRange();
        renderReport();
    });
}
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportReportCSV);
}
if (downloadResumenBtn) {
    downloadResumenBtn.addEventListener('click', downloadResumen);
}
if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', exportReportPDF);
}

setDefaultRange();
loadPagos();
