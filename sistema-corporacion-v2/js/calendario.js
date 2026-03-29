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

const addEventoBtn = document.getElementById('addEventoBtn');
const eventoForm = document.getElementById('eventoForm');
const eventosTableBody = document.getElementById('eventosTableBody');
const avisosAdminList = document.getElementById('avisosAdminList');
const avisosAdminEmpty = document.getElementById('avisosAdminEmpty');
const avisosClienteList = document.getElementById('avisosClienteList');
const avisosClienteEmpty = document.getElementById('avisosClienteEmpty');

let eventosCache = [];

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function eventosHoyParaAdmin() {
    const hoy = todayStr();
    return eventosCache.filter(e => e.fecha === hoy && (e.avisarAdmin !== false));
}

function eventosPendientesAvisarCliente() {
    return eventosCache.filter(e => e.avisarCliente === true && e.avisoEnviadoCliente !== true);
}

function renderAvisosPanel() {
    const adminItems = eventosHoyParaAdmin();
    const clienteItems = eventosPendientesAvisarCliente();

    if (avisosAdminList) {
        avisosAdminList.innerHTML = adminItems.length
            ? adminItems.map(e => `<li><span class="avisos-text"><strong>${escapeHtml(e.tipo || 'Evento')}</strong> · ${escapeHtml(e.cliente || '-')} ${e.detalle ? '· ' + escapeHtml(e.detalle) : ''}</span></li>`).join('')
            : '';
    }
    if (avisosAdminEmpty) avisosAdminEmpty.style.display = adminItems.length ? 'none' : 'block';

    if (avisosClienteList) {
        avisosClienteList.innerHTML = clienteItems.length
            ? clienteItems.map(e => `
                <li>
                    <span class="avisos-text">${formatDate(e.fecha)} · <strong>${escapeHtml(e.cliente || '-')}</strong> · ${escapeHtml(e.tipo || '-')} ${e.detalle ? '· ' + escapeHtml(e.detalle) : ''}</span>
                    <button class="btn btn-primary btn-sm js-marcar-avisado" data-evento-id="${escapeHtml(e.id)}" type="button" title="Marcar como avisado al cliente">
                        <i class="bi bi-check2-circle"></i> Avisado
                    </button>
                </li>
            `).join('')
            : '';
    }
    if (avisosClienteEmpty) avisosClienteEmpty.style.display = clienteItems.length ? 'none' : 'block';
}

function setEventoDefaultDate() {
    const input = document.getElementById('eventoFecha');
    if (input) input.valueAsDate = new Date();
}

function renderEventos() {
    if (!eventosTableBody) return;

    if (!eventosCache.length) {
        eventosTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin eventos registrados</td></tr>';
        renderAvisosPanel();
        return;
    }

    eventosTableBody.innerHTML = eventosCache
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .map(evento => `
            <tr>
                <td>${formatDate(evento.fecha)}</td>
                <td>${escapeHtml(evento.cliente || '-')}</td>
                <td>${escapeHtml(evento.tipo || '-')}</td>
                <td>${escapeHtml(evento.detalle || '-')}</td>
                <td>${escapeHtml(evento.prioridad || '-')} ${evento.avisarCliente && evento.avisoEnviadoCliente !== true ? ' <i class="bi bi-person-lines-fill" title="Pendiente avisar al cliente"></i>' : ''}</td>
                <td>
                    <button class="btn btn-danger btn-sm js-delete-evento" data-evento-id="${escapeHtml(evento.id)}" type="button">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `)
        .join('');

    renderAvisosPanel();
}

async function loadEventos() {
    if (!Storage?.getEventos) return;
    try {
        eventosCache = await Storage.getEventos();
        renderEventos();
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') {
            showNotification('No se pudieron cargar los eventos', 'error');
        }
    }
}

function showAddEventoModal() {
    if (!eventoForm) return;
    eventoForm.reset();
    setEventoDefaultDate();
    if (typeof showModal === 'function') {
        showModal('addEventoModal');
    }
}

async function deleteEvento(id) {
    if (!confirm('Desea eliminar este evento?')) return;
    if (!Storage?.deleteEvento) return;
    try {
        await Storage.deleteEvento(id);
        if (typeof showNotification === 'function') {
            showNotification('Evento eliminado', 'success');
        }
        await loadEventos();
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') {
            showNotification('No se pudo eliminar el evento', 'error');
        }
    }
}

if (eventoForm) {
    eventoForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            fecha: document.getElementById('eventoFecha').value,
            cliente: document.getElementById('eventoCliente').value.trim(),
            tipo: document.getElementById('eventoTipo').value,
            prioridad: document.getElementById('eventoPrioridad').value,
            detalle: document.getElementById('eventoDetalle').value.trim(),
            avisarAdmin: document.getElementById('eventoAvisarAdmin')?.checked !== false,
            avisarCliente: document.getElementById('eventoAvisarCliente')?.checked === true,
            avisoEnviadoCliente: false
        };

        if (!Storage?.saveEvento) return;
        try {
            await Storage.saveEvento(payload);
            if (typeof showNotification === 'function') {
                showNotification('Evento registrado', 'success');
            }
            if (typeof closeModal === 'function') {
                closeModal('addEventoModal');
            }
            await loadEventos();
        } catch (err) {
            console.error(err);
            if (typeof showNotification === 'function') {
                showNotification('No se pudo registrar el evento', 'error');
            }
        }
    });
}

if (addEventoBtn) {
    addEventoBtn.addEventListener('click', showAddEventoModal);
}

document.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('.js-delete-evento');
    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-evento-id');
        if (id) deleteEvento(id);
        return;
    }

    const avisadoBtn = event.target.closest('.js-marcar-avisado');
    if (avisadoBtn) {
        const id = avisadoBtn.getAttribute('data-evento-id');
        if (id) marcarComoAvisado(id);
    }
});

async function marcarComoAvisado(id) {
    const evento = eventosCache.find(e => e.id === id);
    if (!evento || !Storage?.updateEvento) return;
    try {
        await Storage.updateEvento(id, { ...evento, avisoEnviadoCliente: true });
        if (typeof showNotification === 'function') {
            showNotification('Marcado como avisado al cliente', 'success');
        }
        await loadEventos();
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') {
            showNotification('No se pudo actualizar', 'error');
        }
    }
}

window.showAddEventoModal = showAddEventoModal;
window.deleteEvento = deleteEvento;
window.marcarComoAvisado = marcarComoAvisado;

setEventoDefaultDate();
loadEventos();
