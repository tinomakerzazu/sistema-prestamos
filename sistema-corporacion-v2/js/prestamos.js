checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
updateBadges();

const prestamoForm = document.getElementById('prestamoForm');
const prestamosTableBody = document.getElementById('prestamosTableBody');
const cronogramaTableBody = document.getElementById('cronogramaTableBody');
const generarCronogramaBtn = document.getElementById('generarCronogramaBtn');
const prestamoClienteSelect = document.getElementById('prestamoCliente');

const montoPrestadoInput = document.getElementById('montoPrestado');
const interesPrestamoInput = document.getElementById('interesPrestamo');
const numeroCuotasInput = document.getElementById('numeroCuotas');
const cuotaEstimadaInput = document.getElementById('cuotaEstimada');
const totalPagarInput = document.getElementById('totalPagar');
const fechaInicioInput = document.getElementById('fechaInicio');
const frecuenciaPagoInput = document.getElementById('frecuenciaPago');
const plazoCantidadInput = document.getElementById('plazoCantidad');
const plazoUnidadInput = document.getElementById('plazoUnidad');

let prestamosCache = [];
let cronogramaCache = [];
let clientesCache = [];

function parseNumber(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function roundTwo(value) {
    return Math.round(value * 100) / 100;
}

function setDefaultFecha() {
    if (fechaInicioInput) {
        fechaInicioInput.valueAsDate = new Date();
    }
}

function calculateTotals() {
    const monto = parseNumber(montoPrestadoInput.value);
    const interes = parseNumber(interesPrestamoInput.value);
    const cuotas = parseInt(numeroCuotasInput.value, 10) || 0;
    const total = roundTwo(monto * (1 + interes / 100));
    const cuota = cuotas > 0 ? roundTwo(total / cuotas) : 0;

    totalPagarInput.value = formatMoney(total);
    cuotaEstimadaInput.value = formatMoney(cuota);

    return { total, cuota };
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function addMonths(date, months) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() + months);
    return copy;
}

function formatIsoDate(date) {
    if (!date) return '';
    return date.toISOString().slice(0, 10);
}

function getTiempoPaga() {
    const cantidad = parseInt(plazoCantidadInput.value, 10);
    const unidad = plazoUnidadInput.value;
    if (!cantidad || !unidad) return '';
    return `${cantidad} ${unidad}`;
}

function getBadgeClass(estado) {
    const normal = (estado || '').toLowerCase();
    if (normal.includes('mora')) return 'badge-danger';
    if (normal.includes('cerrado') || normal.includes('pagado')) return 'badge-success';
    if (normal.includes('activo')) return 'badge-primary';
    return 'badge-warning';
}

function buildCronograma() {
    const fechaInicioValue = fechaInicioInput.value;
    const cuotas = parseInt(numeroCuotasInput.value, 10) || 0;
    const frecuencia = frecuenciaPagoInput.value;
    const { total } = calculateTotals();

    if (!fechaInicioValue || cuotas <= 0) {
        showNotification('Completa fecha de inicio y numero de cuotas', 'error');
        return [];
    }

    const startDate = new Date(`${fechaInicioValue}T00:00:00`);
    const montoBase = cuotas > 0 ? roundTwo(total / cuotas) : 0;
    const schedule = [];

    for (let i = 0; i < cuotas; i += 1) {
        let fechaPago = startDate;
        if (frecuencia === 'mensual') {
            fechaPago = addMonths(startDate, i);
        } else if (frecuencia === 'quincenal') {
            fechaPago = addDays(startDate, i * 15);
        } else {
            fechaPago = addDays(startDate, i * 7);
        }

        const monto = i === cuotas - 1
            ? roundTwo(total - montoBase * (cuotas - 1))
            : montoBase;

        schedule.push({
            numero: i + 1,
            fecha: formatIsoDate(fechaPago),
            monto,
            estado: 'Pendiente'
        });
    }

    return schedule;
}

function renderCronograma(schedule) {
    if (!schedule.length) {
        cronogramaTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Genera un cronograma para ver las cuotas.</td></tr>';
        return;
    }

    cronogramaTableBody.innerHTML = schedule.map(item => `
        <tr>
            <td>${item.numero}</td>
            <td>${formatDate(item.fecha)}</td>
            <td>${formatMoney(item.monto)}</td>
            <td>${item.estado}</td>
        </tr>
    `).join('');
}

function showAddPrestamoModal() {
    prestamoForm.reset();
    cronogramaCache = [];
    setDefaultFecha();
    calculateTotals();
    renderCronograma([]);
    loadClientesForSelect();
    showModal('addPrestamoModal');
}

function getProximoPago(prestamo) {
    const cronograma = prestamo.cronogramaPagos || [];
    const pendiente = cronograma.find(item => (item.estado || '').toLowerCase() !== 'pagado');
    return pendiente ? formatDate(pendiente.fecha) : '-';
}

function renderPrestamos() {
    if (!prestamosCache.length) {
        prestamosTableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay prestamos registrados</td></tr>';
        return;
    }

    prestamosTableBody.innerHTML = prestamosCache.map(prestamo => {
        const estado = prestamo.estado || 'activo';
        const badgeClass = getBadgeClass(estado);
        const cuota = prestamo.cuota ? formatMoney(prestamo.cuota) : '-';
        return `
            <tr>
                <td>${prestamo.cliente || '-'}</td>
                <td>${formatMoney(prestamo.montoPrestado)}</td>
                <td>${prestamo.interes ? `${prestamo.interes}%` : '-'}</td>
                <td>${prestamo.tiempoPaga || '-'}</td>
                <td>${cuota}</td>
                <td>${getProximoPago(prestamo)}</td>
                <td><span class="badge ${badgeClass}">${estado}</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="viewPrestamo('${prestamo.id}')" type="button">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletePrestamo('${prestamo.id}')" type="button">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function syncPrestamos() {
    try {
        prestamosCache = await Storage.getPrestamos();
        updateBadges();
        renderPrestamos();
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los prestamos', 'error');
    }
}

async function deletePrestamo(id) {
    if (confirm('Desea eliminar este prestamo?')) {
        try {
            await Storage.deletePrestamo(id);
            showNotification('Prestamo eliminado', 'success');
            await syncPrestamos();
        } catch (err) {
            console.error(err);
            showNotification('No se pudo eliminar el prestamo', 'error');
        }
    }
}

function viewPrestamo(id) {
    const prestamo = prestamosCache.find(item => item.id === id);
    if (!prestamo) return;

    let message = `Cliente: ${prestamo.cliente || '-'}\n`;
    message += `Monto prestado: ${formatMoney(prestamo.montoPrestado)}\n`;
    message += `Interes: ${prestamo.interes || 0}%\n`;
    message += `Tiempo de paga: ${prestamo.tiempoPaga || '-'}\n`;
    message += `Total a pagar: ${prestamo.montoTotal ? formatMoney(prestamo.montoTotal) : '-'}\n`;
    message += `Cuota: ${prestamo.cuota ? formatMoney(prestamo.cuota) : '-'}\n`;
    message += `Estado: ${prestamo.estado || '-'}\n`;
    message += `\nCronograma:\n`;

    const cronograma = prestamo.cronogramaPagos || [];
    if (!cronograma.length) {
        message += 'Sin cronograma registrado';
    } else {
        message += cronograma
            .map(item => `#${item.numero} - ${formatDate(item.fecha)} - ${formatMoney(item.monto)} - ${item.estado}`)
            .join('\n');
    }

    alert(message);
}

async function loadClientesForSelect() {
    if (!prestamoClienteSelect) return;

    try {
        clientesCache = await Storage.getClientes();
        if (!clientesCache.length) {
            prestamoClienteSelect.innerHTML = '<option value="">No hay clientes registrados</option>';
            prestamoClienteSelect.disabled = true;
            return;
        }

        const options = ['<option value="">Selecciona un cliente</option>'];
        clientesCache.forEach(cliente => {
            const nombreCompleto = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
            const label = cliente.dni
                ? `${cliente.dni} - ${nombreCompleto}`
                : nombreCompleto || 'Cliente sin nombre';
            options.push(`<option value="${nombreCompleto}">${label}</option>`);
        });

        prestamoClienteSelect.innerHTML = options.join('');
        prestamoClienteSelect.disabled = false;
    } catch (err) {
        console.error(err);
        prestamoClienteSelect.innerHTML = '<option value="">No se pudieron cargar clientes</option>';
        prestamoClienteSelect.disabled = true;
    }
}

prestamoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!cronogramaCache.length) {
        cronogramaCache = buildCronograma();
    }
    if (!cronogramaCache.length) {
        return;
    }

    const clienteSeleccionado = prestamoClienteSelect.value.trim();
    if (!clienteSeleccionado) {
        showNotification('Selecciona un cliente', 'error');
        return;
    }

    const montoPrestado = parseNumber(montoPrestadoInput.value);
    const interes = parseNumber(interesPrestamoInput.value);
    const numeroCuotas = parseInt(numeroCuotasInput.value, 10) || 0;
    const { total, cuota } = calculateTotals();

    const payload = {
        cliente: clienteSeleccionado,
        montoPrestado,
        interes,
        tiempoPaga: getTiempoPaga(),
        frecuenciaPago: frecuenciaPagoInput.value,
        numeroCuotas,
        fechaInicio: fechaInicioInput.value,
        cronogramaPagos: cronogramaCache,
        observaciones: document.getElementById('prestamoObservaciones').value.trim(),
        montoTotal: total,
        cuota,
        estado: document.getElementById('estadoPrestamo').value
    };

    try {
        await Storage.savePrestamo(payload);
        showSuccessAnimation();
        showNotification('Prestamo registrado correctamente', 'success');
        setTimeout(() => {
            closeModal('addPrestamoModal');
            syncPrestamos();
        }, 1500);
    } catch (err) {
        console.error(err);
        showNotification('No se pudo registrar el prestamo', 'error');
    }
});

generarCronogramaBtn.addEventListener('click', () => {
    cronogramaCache = buildCronograma();
    renderCronograma(cronogramaCache);
});

[montoPrestadoInput, interesPrestamoInput, numeroCuotasInput].forEach(input => {
    input.addEventListener('input', calculateTotals);
});

window.showAddPrestamoModal = showAddPrestamoModal;
window.viewPrestamo = viewPrestamo;
window.deletePrestamo = deletePrestamo;

setDefaultFecha();
calculateTotals();
loadClientesForSelect();
syncPrestamos();
