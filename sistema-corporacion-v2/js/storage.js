const API_BASE = '/.netlify/functions';

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Error de servidor');
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

const Storage = {
    async getClientes() {
        return apiRequest('/clientes');
    },
    async saveCliente(cliente) {
        return apiRequest('/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cliente)
        });
    },
    async updateCliente(id, updates) {
        return apiRequest(`/clientes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },
    async deleteCliente(id) {
        return apiRequest(`/clientes/${id}`, { method: 'DELETE' });
    },
    async getPrestamos() {
        return apiRequest('/prestamos');
    },
    async savePrestamo(prestamo) {
        return apiRequest('/prestamos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prestamo)
        });
    },
    async updatePrestamo(id, updates) {
        return apiRequest(`/prestamos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },
    async deletePrestamo(id) {
        return apiRequest(`/prestamos/${id}`, { method: 'DELETE' });
    },
    async getPagos() {
        return apiRequest('/pagos');
    },
    async savePago(payload) {
        if (payload instanceof FormData) {
            return apiRequest('/pagos', { method: 'POST', body: payload });
        }
        return apiRequest('/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
    async updatePago(id, updates) {
        return apiRequest(`/pagos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },
    async deletePago(id) {
        return apiRequest(`/pagos/${id}`, { method: 'DELETE' });
    },
    async getCobranzas() {
        return apiRequest('/cobranzas');
    },
    async saveCobranza(cobranza) {
        return apiRequest('/cobranzas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cobranza)
        });
    },
    async updateCobranza(id, updates) {
        return apiRequest(`/cobranzas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },
    async deleteCobranza(id) {
        return apiRequest(`/cobranzas/${id}`, { method: 'DELETE' });
    },
    async getEventos() {
        return apiRequest('/eventos');
    },
    async saveEvento(evento) {
        return apiRequest('/eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evento)
        });
    },
    async updateEvento(id, updates) {
        return apiRequest(`/eventos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },
    async deleteEvento(id) {
        return apiRequest(`/eventos/${id}`, { method: 'DELETE' });
    },
    async exportAllData() {
        const [clientes, prestamos, pagos, eventos, cobranzas] = await Promise.all([
            this.getClientes(),
            this.getPrestamos(),
            this.getPagos(),
            this.getEventos(),
            this.getCobranzas()
        ]);

        return {
            clientes,
            prestamos,
            pagos,
            eventos,
            cobranzas,
            exportDate: new Date().toISOString()
        };
    }
};

function formatMoney(amount) {
    return 'S/ ' + parseFloat(amount || 0).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-PE');
}

function logout() {
    if (confirm('¿Desea cerrar sesión?')) {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'index.html';
    }
}

function checkAuth() {
    if (!sessionStorage.getItem('isLoggedIn')) {
        window.location.href = 'index.html';
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'}"></i> ${message}`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function showSuccessAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'dimmed-overlay';
    document.body.appendChild(overlay);

    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('success-glow');

        setTimeout(() => {
            modalContent.classList.remove('success-glow');
            overlay.remove();
        }, 4500);
    } else {
        overlay.remove();
    }
}

async function updateBadges() {
    try {
        const [clientes, prestamos] = await Promise.all([
            Storage.getClientes(),
            Storage.getPrestamos()
        ]);

        const clientesBadges = document.querySelectorAll('#clientesBadge');
        const prestamosBadges = document.querySelectorAll('#prestamosBadge');

        clientesBadges.forEach(badge => {
            if (badge) badge.textContent = clientes.length;
        });

        prestamosBadges.forEach(badge => {
            if (badge) badge.textContent = prestamos.length;
        });
    } catch (err) {
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateBadges();
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
