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

let eventosCache = [];

function setEventoDefaultDate() {
    const input = document.getElementById('eventoFecha');
    if (input) input.valueAsDate = new Date();
}

function renderEventos() {
    if (!eventosTableBody) return;

    if (!eventosCache.length) {
        eventosTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin eventos registrados</td></tr>';
        return;
    }

    eventosTableBody.innerHTML = eventosCache
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .map(evento => `
            <tr>
                <td>${formatDate(evento.fecha)}</td>
                <td>${evento.cliente || '-'}</td>
                <td>${evento.tipo || '-'}</td>
                <td>${evento.detalle || '-'}</td>
                <td>${evento.prioridad || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteEvento('${evento.id}')" type="button">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `)
        .join('');
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
            detalle: document.getElementById('eventoDetalle').value.trim()
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

window.showAddEventoModal = showAddEventoModal;
window.deleteEvento = deleteEvento;

setEventoDefaultDate();
loadEventos();
