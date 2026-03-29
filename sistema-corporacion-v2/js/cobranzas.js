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
const cobranzaModalTitle = document.getElementById('cobranzaModalTitle');
const cobranzaIdInput = document.getElementById('cobranzaId');

let cobranzasCache = [];

function normalizeCobranza(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        id: raw.id,
        cliente: raw.cliente,
        saldo: parseFloat(raw.saldo ?? 0) || 0,
        diasMora: parseInt(raw.dias_mora ?? raw.diasMora ?? 0, 10) || 0,
        ultimaGestion: raw.ultima_gestion ?? raw.ultimaGestion ?? '',
        estado: raw.estado || 'Pendiente',
        createdAt: raw.created_at ?? raw.createdAt
    };
}

function renderCobranzasMetrics() {
    const elCartera = document.getElementById('cobranzaKpiCartera');
    const elCrit = document.getElementById('cobranzaKpiCriticos');
    const elCont = document.getElementById('cobranzaKpiContactos');
    const trendCartera = document.querySelector('#cobranzaKpiCarteraTrend span');
    const trendCrit = document.querySelector('#cobranzaKpiCriticosTrend span');
    const trendCont = document.querySelector('#cobranzaKpiContactosTrend span');

    const items = cobranzasCache.map(normalizeCobranza).filter(Boolean);
    const activos = items.filter(c => (c.estado || '').toLowerCase() !== 'cerrado');
    const suma = activos.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
    const criticos = items.filter(c => {
        const mora = Number(c.diasMora) || 0;
        const est = (c.estado || '').toLowerCase();
        return mora >= 21 || est.includes('mora') || est.includes('crit');
    }).length;

    const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recientes = items.filter(c => {
        const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return t >= hace7;
    }).length;

    if (elCartera) elCartera.textContent = typeof formatMoney === 'function' ? formatMoney(suma) : `S/ ${suma.toFixed(2)}`;
    if (elCrit) elCrit.textContent = String(criticos);
    if (elCont) elCont.textContent = String(recientes);

    if (trendCartera) {
        trendCartera.textContent = activos.length ? `${activos.length} caso(s) activo(s)` : 'Sin casos activos';
    }
    if (trendCrit) {
        trendCrit.textContent = criticos ? 'Revisar prioridad' : 'Sin casos en umbral crítico';
    }
    if (trendCont) {
        trendCont.textContent = `Registros nuevos en 7 días: ${recientes}`;
    }
}

function renderCobranzas() {
    if (!cobranzasTableBody) return;

    if (!cobranzasCache.length) {
        cobranzasTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Sin casos asignados</td></tr>';
        return;
    }

    cobranzasTableBody.innerHTML = cobranzasCache
        .map(raw => {
            const item = normalizeCobranza(raw);
            if (!item) return '';
            return `
            <tr>
                <td>${escapeHtml(item.cliente || '-')}</td>
                <td>${formatMoney(item.saldo)}</td>
                <td>${escapeHtml(item.diasMora)}</td>
                <td>${escapeHtml(item.ultimaGestion || '-')}</td>
                <td>${escapeHtml(item.estado || '-')}</td>
                <td>
                    <button class="btn btn-secondary btn-sm js-edit-cobranza" data-cobranza-id="${escapeHtml(item.id)}" type="button" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-danger btn-sm js-delete-cobranza" data-cobranza-id="${escapeHtml(item.id)}" type="button" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        })
        .join('');
}

async function loadCobranzas() {
    if (!Storage?.getCobranzas) return;
    try {
        const data = await Storage.getCobranzas();
        cobranzasCache = Array.isArray(data) ? data : [];
        renderCobranzas();
        renderCobranzasMetrics();
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
    if (cobranzaIdInput) cobranzaIdInput.value = '';
    if (cobranzaModalTitle) {
        cobranzaModalTitle.innerHTML = '<i class="bi bi-clipboard-plus"></i> Registrar gestión';
    }
    if (typeof showModal === 'function') {
        showModal('addCobranzaModal');
    }
}

function showEditCobranzaModal(id) {
    const item = cobranzasCache.find(c => c.id === id);
    const n = normalizeCobranza(item);
    if (!n || !cobranzaForm) return;

    if (cobranzaIdInput) cobranzaIdInput.value = n.id;
    document.getElementById('cobranzaCliente').value = n.cliente || '';
    document.getElementById('cobranzaSaldo').value = n.saldo;
    document.getElementById('cobranzaDias').value = n.diasMora;
    document.getElementById('cobranzaUltima').value = n.ultimaGestion || '';
    document.getElementById('cobranzaEstado').value = n.estado || 'Pendiente';

    if (cobranzaModalTitle) {
        cobranzaModalTitle.innerHTML = '<i class="bi bi-pencil-square"></i> Editar gestión';
    }
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
    cobranzaForm.addEventListener('submit', async e => {
        e.preventDefault();

        const payload = {
            cliente: document.getElementById('cobranzaCliente').value.trim(),
            saldo: document.getElementById('cobranzaSaldo').value,
            diasMora: document.getElementById('cobranzaDias').value,
            ultimaGestion: document.getElementById('cobranzaUltima').value.trim(),
            estado: document.getElementById('cobranzaEstado').value
        };

        const editId = cobranzaIdInput?.value?.trim();

        try {
            if (editId && Storage?.updateCobranza) {
                await Storage.updateCobranza(editId, payload);
                if (typeof showNotification === 'function') {
                    showNotification('Gestion actualizada', 'success');
                }
            } else if (Storage?.saveCobranza) {
                await Storage.saveCobranza(payload);
                if (typeof showNotification === 'function') {
                    showNotification('Gestion registrada', 'success');
                }
            } else {
                return;
            }
            if (typeof closeModal === 'function') {
                closeModal('addCobranzaModal');
            }
            await loadCobranzas();
        } catch (err) {
            console.error(err);
            if (typeof showNotification === 'function') {
                showNotification('No se pudo guardar la gestion', 'error');
            }
        }
    });
}

if (addCobranzaBtn) {
    addCobranzaBtn.addEventListener('click', showAddCobranzaModal);
}

document.addEventListener('click', event => {
    const editBtn = event.target.closest('.js-edit-cobranza');
    if (editBtn) {
        const id = editBtn.getAttribute('data-cobranza-id');
        if (id) showEditCobranzaModal(id);
        return;
    }

    const deleteBtn = event.target.closest('.js-delete-cobranza');
    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-cobranza-id');
        if (id) deleteCobranza(id);
    }
});

window.showAddCobranzaModal = showAddCobranzaModal;
window.showEditCobranzaModal = showEditCobranzaModal;
window.deleteCobranza = deleteCobranza;

loadCobranzas();
