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

const addCobranzaBtn = document.getElementById('addCobranzaBtn');
const cobranzaForm = document.getElementById('cobranzaForm');
const cobranzasTableBody = document.getElementById('cobranzasTableBody');

let cobranzasCache = [];

function renderCobranzas() {
    if (!cobranzasTableBody) return;

    if (!cobranzasCache.length) {
        cobranzasTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin casos asignados</td></tr>';
        return;
    }

    cobranzasTableBody.innerHTML = cobranzasCache
        .map(item => `
            <tr>
                <td>${item.cliente || '-'}</td>
                <td>${formatMoney(item.saldo)}</td>
                <td>${item.dias_mora ?? item.diasMora ?? 0}</td>
                <td>${item.ultima_gestion || item.ultimaGestion || '-'}</td>
                <td>${item.estado || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteCobranza('${item.id}')" type="button">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `)
        .join('');
}

async function loadCobranzas() {
    if (!Storage?.getCobranzas) return;
    try {
        cobranzasCache = await Storage.getCobranzas();
        renderCobranzas();
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') {
            showNotification('No se pudieron cargar las cobranzas', 'error');
        }
    }
}

function showAddCobranzaModal() {
    if (!cobranzaForm) return;
    cobranzaForm.reset();
    if (typeof showModal === 'function') {
        showModal('addCobranzaModal');
    }
}

async function deleteCobranza(id) {
    if (!confirm('Desea eliminar esta gestion?')) return;
    if (!Storage?.deleteCobranza) return;
    try {
        await Storage.deleteCobranza(id);
        if (typeof showNotification === 'function') {
            showNotification('Gestion eliminada', 'success');
        }
        await loadCobranzas();
    } catch (err) {
        console.error(err);
        if (typeof showNotification === 'function') {
            showNotification('No se pudo eliminar la gestion', 'error');
        }
    }
}

if (cobranzaForm) {
    cobranzaForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            cliente: document.getElementById('cobranzaCliente').value.trim(),
            saldo: document.getElementById('cobranzaSaldo').value,
            diasMora: document.getElementById('cobranzaDias').value,
            ultimaGestion: document.getElementById('cobranzaUltima').value.trim(),
            estado: document.getElementById('cobranzaEstado').value
        };

        if (!Storage?.saveCobranza) return;
        try {
            await Storage.saveCobranza(payload);
            if (typeof showNotification === 'function') {
                showNotification('Gestion registrada', 'success');
            }
            if (typeof closeModal === 'function') {
                closeModal('addCobranzaModal');
            }
            await loadCobranzas();
        } catch (err) {
            console.error(err);
            if (typeof showNotification === 'function') {
                showNotification('No se pudo registrar la gestion', 'error');
            }
        }
    });
}

if (addCobranzaBtn) {
    addCobranzaBtn.addEventListener('click', showAddCobranzaModal);
}

window.showAddCobranzaModal = showAddCobranzaModal;
window.deleteCobranza = deleteCobranza;

loadCobranzas();
