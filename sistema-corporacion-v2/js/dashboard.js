checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

function getMesAnio(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getStartEndMonth(yearMonth) {
    const [y, m] = yearMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return { start, end };
}

function parseDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function isInRange(date, start, end) {
    if (!date) return false;
    const t = date.getTime ? date.getTime() : new Date(date).getTime();
    return t >= start.getTime() && t <= end.getTime();
}

async function loadStats() {
    try {
        const [clientes, prestamos, pagos] = await Promise.all([
            Storage.getClientes(),
            Storage.getPrestamos(),
            Storage.getPagos()
        ]);

        const hoy = new Date();
        const mesActual = getMesAnio(hoy);
        const { start: curStart, end: curEnd } = getStartEndMonth(mesActual);
        const prevMonth = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const mesAnterior = getMesAnio(prevMonth);
        const { start: prevStart, end: prevEnd } = getStartEndMonth(mesAnterior);

        const clientesEsteMes = clientes.filter(c => {
            const created = parseDate(c.createdAt);
            return created && isInRange(created, curStart, curEnd);
        });
        const clientesMesAnterior = clientes.filter(c => {
            const created = parseDate(c.createdAt);
            return created && isInRange(created, prevStart, prevEnd);
        });
        const tendenciaClientes = clientesMesAnterior.length > 0
            ? Math.round(((clientesEsteMes.length - clientesMesAnterior.length) / clientesMesAnterior.length) * 100)
            : (clientesEsteMes.length > 0 ? 100 : 0);

        const prestamosActivos = prestamos.filter(p => (p.estado || '').toLowerCase() === 'activo');
        const prestamosActivosEsteMes = prestamosActivos.filter(p => {
            const created = parseDate(p.createdAt);
            return created && isInRange(created, curStart, curEnd);
        });
        const prestamosActivosMesAnterior = prestamos.filter(p => (p.estado || '').toLowerCase() === 'activo').filter(p => {
            const created = parseDate(p.createdAt);
            return created && isInRange(created, prevStart, prevEnd);
        });
        const tendenciaPrestamos = prestamosActivosMesAnterior.length > 0
            ? Math.round(((prestamosActivosEsteMes.length - prestamosActivosMesAnterior.length) / prestamosActivosMesAnterior.length) * 100)
            : (prestamosActivosEsteMes.length > 0 ? 100 : 0);

        const capitalPrestado = prestamos
            .filter(p => (p.estado || '').toLowerCase() === 'activo' || (p.estado || '').toLowerCase() === 'vencido')
            .reduce((sum, p) => sum + parseFloat(p.montoPrestado || 0), 0);
        const capitalMesAnterior = prestamos
            .filter(p => (p.estado || '').toLowerCase() === 'activo' || (p.estado || '').toLowerCase() === 'vencido')
            .filter(p => {
                const created = parseDate(p.createdAt);
                return created && created < curStart;
            })
            .reduce((sum, p) => sum + parseFloat(p.montoPrestado || 0), 0);
        const tendenciaCapital = capitalMesAnterior > 0
            ? Math.round(((capitalPrestado - capitalMesAnterior) / capitalMesAnterior) * 100)
            : (capitalPrestado > 0 ? 100 : 0);

        const prestamosVencidos = prestamos.filter(p => (p.estado || '').toLowerCase() === 'vencido').length;

        document.getElementById('totalClientes').textContent = clientes.length;
        document.getElementById('prestamosActivos').textContent = prestamosActivos.length;
        document.getElementById('capitalPrestado').textContent = formatMoney(capitalPrestado);
        document.getElementById('prestamosVencidos').textContent = prestamosVencidos;

        const clientesTrend = document.getElementById('clientesTrend');
        if (clientesTrend) {
            const span = clientesTrend.querySelector('span');
            const icon = clientesTrend.querySelector('i');
            if (span && icon) {
                icon.className = tendenciaClientes >= 0 ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
                clientesTrend.style.background = tendenciaClientes >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
                clientesTrend.style.color = tendenciaClientes >= 0 ? '#2ecc71' : '#e74c3c';
                span.textContent = tendenciaClientes >= 0 ? `+${tendenciaClientes}% este mes` : `${tendenciaClientes}% este mes`;
                if (tendenciaClientes === 0) span.textContent = 'Sin cambio este mes';
            }
        }

        const prestamosTrend = document.getElementById('prestamosActivosTrend');
        if (prestamosTrend) {
            const span = prestamosTrend.querySelector('span');
            const icon = prestamosTrend.querySelector('i');
            if (span && icon) {
                icon.className = tendenciaPrestamos >= 0 ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
                prestamosTrend.style.background = tendenciaPrestamos >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
                prestamosTrend.style.color = tendenciaPrestamos >= 0 ? '#2ecc71' : '#e74c3c';
                span.textContent = tendenciaPrestamos >= 0 ? `+${tendenciaPrestamos}% este mes` : `${tendenciaPrestamos}% este mes`;
                if (tendenciaPrestamos === 0) span.textContent = 'Sin cambio este mes';
            }
        }

        const capitalTrend = document.getElementById('capitalTrend');
        if (capitalTrend) {
            const span = capitalTrend.querySelector('span');
            const icon = capitalTrend.querySelector('i');
            if (span && icon) {
                icon.className = tendenciaCapital >= 0 ? 'bi bi-arrow-up' : 'bi bi-arrow-down';
                capitalTrend.style.background = tendenciaCapital >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
                capitalTrend.style.color = tendenciaCapital >= 0 ? '#2ecc71' : '#e74c3c';
                span.textContent = tendenciaCapital >= 0 ? `+${tendenciaCapital}% este mes` : `${tendenciaCapital}% este mes`;
                if (tendenciaCapital === 0) span.textContent = 'Sin cambio este mes';
            }
        }

        const vencidosTrend = document.getElementById('prestamosVencidosTrend');
        if (vencidosTrend) {
            const span = vencidosTrend.querySelector('span');
            if (span) span.textContent = prestamosVencidos > 0 ? 'Requiere atención' : 'Al día';
        }

        updateBadges();
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los indicadores', 'error');
    }
}

function getProximasCuotas(prestamos) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const items = [];

    prestamos.forEach(p => {
        if ((p.estado || '').toLowerCase() !== 'activo') return;
        const crono = p.cronogramaPagos || [];
        const pendientes = crono.filter(c => (c.estado || '').toLowerCase() === 'pendiente');
        if (!pendientes.length) return;

        const prox = pendientes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0];
        const fechaVenc = new Date(prox.fecha + 'T00:00:00');
        const dias = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
        if (dias < 0) return;

        items.push({
            cliente: p.cliente || p.clienteId || '-',
            monto: parseFloat(prox.monto || 0),
            fecha: prox.fecha,
            dias
        });
    });

    return items.sort((a, b) => a.dias - b.dias).slice(0, 10);
}

async function loadProximosVencer() {
    const tbody = document.querySelector('#proximosVencerTable tbody');
    if (!tbody) return;

    try {
        const prestamos = await Storage.getPrestamos();
        const items = getProximasCuotas(prestamos);

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay préstamos próximos a vencer</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(item => `
            <tr>
                <td>${escapeHtml(item.cliente)}</td>
                <td>${formatMoney(item.monto)}</td>
                <td>${formatDate(item.fecha)}</td>
                <td>${item.dias === 0 ? 'Hoy' : item.dias === 1 ? 'Mañana' : `${item.dias} días`}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Error al cargar</td></tr>';
    }
}

async function loadPagosRecientes() {
    const listEl = document.getElementById('pagosRecientesList');
    if (!listEl) return;

    try {
        const pagos = await Storage.getPagos();
        const recientes = [...pagos]
            .sort((a, b) => new Date(b.fecha || b.createdAt) - new Date(a.fecha || a.createdAt))
            .slice(0, 8);

        if (!recientes.length) {
            listEl.innerHTML = '<div class="list-item text-center text-muted">No hay actividad reciente</div>';
            return;
        }

        listEl.innerHTML = recientes.map(p => `
            <div class="list-item">
                <span><strong>${escapeHtml(p.cliente || '-')}</strong> · ${formatMoney(p.monto)} · ${formatDate(p.fecha)}</span>
                ${p.metodo ? `<span class="badge badge-secondary">${escapeHtml(p.metodo)}</span>` : ''}
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
        listEl.innerHTML = '<div class="list-item text-center text-muted">Error al cargar</div>';
    }
}

async function loadAll() {
    await loadStats();
    await loadProximosVencer();
    await loadPagosRecientes();
}

loadAll();

const revealOverlay = document.querySelector('.reveal-overlay');
document.body.classList.add('intro-reveal');
if (revealOverlay) {
    revealOverlay.innerHTML = `
        <div class="reveal-scanline" aria-hidden="true"></div>
        <div class="reveal-hud">
            <div class="hud-ring outer" aria-hidden="true"></div>
            <div class="hud-ring middle" aria-hidden="true"></div>
            <div class="hud-ring inner" aria-hidden="true"></div>
            <div class="hud-content">
                <span class="system-text">INITIALIZING</span>
                <span class="brand-text">Norse Kredit</span>
                <span class="status-text"><span class="status-dot"></span>ONLINE</span>
            </div>
        </div>
        <div class="reveal-boot-lines" aria-hidden="true">
            <div class="reveal-boot-line" style="animation-delay: 0.6s">[OK] Core modules loaded</div>
            <div class="reveal-boot-line" style="animation-delay: 0.9s">[OK] Security layer active</div>
            <div class="reveal-boot-line" style="animation-delay: 1.2s">[OK] Dashboard ready</div>
        </div>
        <div class="reveal-progress-wrap" aria-hidden="true">
            <div class="reveal-progress-fill"></div>
        </div>
    `;

    setTimeout(() => {
        revealOverlay.classList.add('reveal-hide');
    }, 2600);

    setTimeout(() => {
        revealOverlay.remove();
        document.body.classList.remove('intro-reveal');
    }, 3200);
} else {
    document.body.classList.remove('intro-reveal');
}
