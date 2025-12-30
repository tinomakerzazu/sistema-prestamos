checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
updateBadges();

const pagoForm = document.getElementById('pagoForm');
const pagosTableBody = document.getElementById('pagosTableBody');
const focusPagoBtn = document.getElementById('focusPagoBtn');
const exportPagosBtn = document.getElementById('exportPagosBtn');
const pagoComprobante = document.getElementById('pagoComprobante');

const filterSearch = document.getElementById('filterSearch');
const filterMetodo = document.getElementById('filterMetodo');
const filterEstado = document.getElementById('filterEstado');
const filterStartDate = document.getElementById('filterStartDate');
const filterEndDate = document.getElementById('filterEndDate');

const pagosTotalMonto = document.getElementById('pagosTotalMonto');
const pagosTotalCount = document.getElementById('pagosTotalCount');
const pagosAvgMonto = document.getElementById('pagosAvgMonto');
const pagosUltimoMonto = document.getElementById('pagosUltimoMonto');
const pagosUltimoFecha = document.getElementById('pagosUltimoFecha');
const pagosTotalDelta = document.getElementById('pagosTotalDelta');
const pagosTotalTag = document.getElementById('pagosTotalTag');

let pagosCache = [];

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
    });
}

function setDefaultDate() {
    const today = new Date();
    const input = document.getElementById('pagoFecha');
    if (input) {
        input.valueAsDate = today;
    }
}

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

function getFilteredPagos() {
    const searchValue = (filterSearch.value || '').toLowerCase();
    const metodoValue = filterMetodo.value;
    const estadoValue = filterEstado.value;
    const startDate = parseDate(filterStartDate.value);
    const endDate = parseDate(filterEndDate.value);

    return pagosCache.filter(pago => {
        const matchesSearch = !searchValue ||
            (pago.cliente || '').toLowerCase().includes(searchValue) ||
            (pago.referencia || '').toLowerCase().includes(searchValue);
        const matchesMetodo = !metodoValue || pago.metodo === metodoValue;
        const matchesEstado = !estadoValue || pago.estado === estadoValue;
        const pagoDate = parseDate(pago.fecha);
        const matchesDate = isWithinRange(pagoDate, startDate, endDate);
        return matchesSearch && matchesMetodo && matchesEstado && matchesDate;
    });
}

function renderPagos() {
    const pagos = getFilteredPagos();

    if (pagos.length === 0) {
        pagosTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay pagos registrados</td></tr>';
    } else {
        const rows = [...pagos]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .map(pago => {
                const estadoClass = `status-pill status-${pago.estado || 'Registrado'}`;
                const comprobante = pago.comprobante?.url
                    ? `<a class="btn btn-secondary btn-sm" href="${pago.comprobante.url}" target="_blank" rel="noopener">
                        <i class="bi bi-image"></i>
                    </a>`
                    : '<span class="text-muted">-</span>';
                return `<tr>
                    <td>${formatDate(pago.fecha)}</td>
                    <td>${pago.cliente || '-'}</td>
                    <td>${pago.metodo || '-'}</td>
                    <td>${pago.referencia || '-'}</td>
                    <td>${formatMoney(pago.monto)}</td>
                    <td><span class="${estadoClass}">${pago.estado || 'Registrado'}</span></td>
                    <td>${comprobante}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="markPagoEstado('${pago.id}', 'Aplicado')" type="button">
                            <i class="bi bi-check2-circle"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="markPagoEstado('${pago.id}', 'Registrado')" type="button">
                            <i class="bi bi-arrow-repeat"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deletePago('${pago.id}')" type="button">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
            })
            .join('');
        pagosTableBody.innerHTML = rows;
    }

    updateResumen(pagosCache);
}

function updateResumen(pagos) {
    const totalMonto = pagos.reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0);
    const totalCount = pagos.length;
    const avgMonto = totalCount ? totalMonto / totalCount : 0;

    pagosTotalMonto.textContent = formatMoney(totalMonto);
    pagosTotalCount.textContent = totalCount;
    pagosAvgMonto.textContent = formatMoney(avgMonto);

    const ultimoPago = [...pagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
    pagosUltimoMonto.textContent = ultimoPago ? formatMoney(ultimoPago.monto) : 'S/ 0.00';
    pagosUltimoFecha.textContent = ultimoPago ? formatDate(ultimoPago.fecha) : 'Sin registros';

    const { porcentaje, label } = calcularCambioMensual(pagos);
    pagosTotalDelta.textContent = `${porcentaje >= 0 ? '+' : ''}${porcentaje.toFixed(1)}%`;
    pagosTotalDelta.classList.toggle('positive', porcentaje >= 0);
    pagosTotalTag.textContent = label;
}

function calcularCambioMensual(pagos) {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalActual = pagos
        .filter(p => isWithinRange(parseDate(p.fecha), currentStart, currentEnd))
        .reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0);
    const totalPrevio = pagos
        .filter(p => isWithinRange(parseDate(p.fecha), prevStart, prevEnd))
        .reduce((sum, pago) => sum + parseFloat(pago.monto || 0), 0);

    const porcentaje = totalPrevio ? ((totalActual - totalPrevio) / totalPrevio) * 100 : 0;
    return { porcentaje, label: 'Comparado al mes anterior' };
}

function exportPagosCSV() {
    const pagos = getFilteredPagos();
    if (!pagos.length) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }
    const header = ['Fecha', 'Cliente', 'Método', 'Referencia', 'Monto', 'Estado', 'Nota'];
    const rows = pagos.map(pago => [
        formatDate(pago.fecha),
        pago.cliente || '',
        pago.metodo || '',
        pago.referencia || '',
        pago.monto || '',
        pago.estado || '',
        (pago.nota || '').replace(/[\n\r]+/g, ' ')
    ]);

    const csvContent = [header, ...rows].map(row => row.map(value => `"${value}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pagos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

async function deletePago(id) {
    if (confirm('¿Desea eliminar este pago?')) {
        try {
            await Storage.deletePago(id);
            showNotification('Pago eliminado', 'success');
            await syncPagos();
        } catch (err) {
            console.error(err);
            showNotification('No se pudo eliminar el pago', 'error');
        }
    }
}

async function markPagoEstado(id, estado) {
    try {
        await Storage.updatePago(id, { estado });
        showNotification(`Pago actualizado a ${estado}`, 'success');
        await syncPagos();
    } catch (err) {
        console.error(err);
        showNotification('No se pudo actualizar el pago', 'error');
    }
}

pagoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        cliente: document.getElementById('pagoCliente').value.trim(),
        monto: document.getElementById('pagoMonto').value,
        fecha: document.getElementById('pagoFecha').value,
        metodo: document.getElementById('pagoMetodo').value,
        referencia: document.getElementById('pagoReferencia').value.trim(),
        estado: document.getElementById('pagoEstado').value,
        nota: document.getElementById('pagoNota').value.trim()
    };

    const comprobanteFile = pagoComprobante?.files[0];
    if (comprobanteFile) {
        if (comprobanteFile.size > 4 * 1024 * 1024) {
            showNotification('El comprobante supera 4MB', 'error');
            return;
        }
        try {
            payload.comprobanteBase64 = await fileToDataUrl(comprobanteFile);
            payload.comprobanteName = comprobanteFile.name;
        } catch (err) {
            console.error(err);
            showNotification('No se pudo leer el comprobante', 'error');
            return;
        }
    }

    try {
        await Storage.savePago(payload);
        showNotification('Pago registrado correctamente', 'success');
        pagoForm.reset();
        setDefaultDate();
        await syncPagos();
    } catch (err) {
        console.error(err);
        showNotification('No se pudo registrar el pago', 'error');
    }
});

[filterSearch, filterMetodo, filterEstado, filterStartDate, filterEndDate].forEach(input => {
    input.addEventListener('input', renderPagos);
    input.addEventListener('change', renderPagos);
});

focusPagoBtn.addEventListener('click', () => {
    document.getElementById('pagoCliente').focus();
});

exportPagosBtn.addEventListener('click', exportPagosCSV);

async function syncPagos() {
    try {
        pagosCache = await Storage.getPagos();
        renderPagos();
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los pagos', 'error');
    }
}

window.deletePago = deletePago;
window.markPagoEstado = markPagoEstado;

setDefaultDate();
syncPagos();
