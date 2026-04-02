// Vercel-first: usar /api por defecto.
function getApiBase() {
    const host = window.location.hostname;
    const port = window.location.port;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (isLocal) {
        if (port && port !== '3000') {
            return `${window.location.protocol}//${host}:3000/api`;
        }
        return '/api';
    }
    return window.__API_BASE__ || '/api';
}
const API_BASE = getApiBase();

async function apiRequest(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const requestOptions = {
        credentials: 'include',
        ...options
    };
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
        let message = 'Error de servidor';
        const errBody = await response.text();
        if (errBody) {
            try {
                const payload = JSON.parse(errBody);
                message = payload.error || payload.message || message;
            } catch (_) {
                message = errBody.length > 200 ? `${errBody.slice(0, 200)}…` : errBody;
            }
        }

        if (response.status === 401) {
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('userName');
            if (!window.location.pathname.endsWith('/index.html') && !window.location.pathname.endsWith('/')) {
                window.location.href = 'index.html';
            }
        }

        throw new Error(message);
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
    async enviarRecordatorioSMS(prestamoId) {
        return apiRequest('/recordatorios/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prestamoId })
        });
    },
    async enviarRecordatorioEmail(prestamoId) {
        return apiRequest('/recordatorios/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prestamoId })
        });
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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeLink(url) {
    if (!url) return null;
    const raw = String(url).trim();
    if (raw.startsWith('/')) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    return null;
}

function escapeCsvValue(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function logout() {
    if (confirm('¿Desea cerrar sesión?')) {
        fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
            .catch(() => null)
            .finally(() => {
                sessionStorage.removeItem('isLoggedIn');
                sessionStorage.removeItem('userName');
                window.location.href = 'index.html';
            });
    }
}

async function checkAuth() {
    if (!sessionStorage.getItem('isLoggedIn')) {
        window.location.href = 'index.html';
        return false;
    }

    try {
        await apiRequest('/auth/me');
        return true;
    } catch (_) {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('userName');
        window.location.href = 'index.html';
        return false;
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
    const icon = document.createElement('i');
    icon.className = `bi bi-${type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill'}`;
    notif.appendChild(icon);
    notif.appendChild(document.createTextNode(` ${String(message ?? '')}`));
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

window.escapeHtml = escapeHtml;
window.sanitizeLink = sanitizeLink;
window.escapeCsvValue = escapeCsvValue;
