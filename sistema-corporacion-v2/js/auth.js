function getApiBaseAuth() {
    const host = window.location.hostname;
    const port = window.location.port;
    if (host === 'localhost' || host === '127.0.0.1') {
        if (port && port !== '3000') {
            return `${window.location.protocol}//${host}:3000/api`;
        }
        return '/api';
    }
    return window.__API_BASE__ || '/api';
}
const API_BASE = getApiBaseAuth();

function showNotification(type, title, message) {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notice = document.createElement('div');
    notice.className = `notification ${type}`;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    const icon = document.createElement('i');
    icon.className = `bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`;
    const content = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = String(title || '');
    const br = document.createElement('br');
    const span = document.createElement('span');
    span.textContent = String(message || '');
    content.appendChild(strong);
    content.appendChild(br);
    content.appendChild(span);
    notice.appendChild(icon);
    notice.appendChild(content);

    document.body.appendChild(notice);

    setTimeout(() => {
        notice.remove();
    }, 3500);
}

function loginWithProvider(provider) {
    showNotification('error', 'En desarrollo', `La opción ${provider} aún no está disponible.`);
}

async function doLogin(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
    });

    const text = await res.text();
    let data = {};
    if (text && text.trim()) {
        try {
            data = JSON.parse(text);
        } catch (_) {
            throw new Error('El servidor no respondió correctamente. ¿Está en ejecución?');
        }
    }

    if (!res.ok) {
        throw new Error(data.error || 'Error de autenticación');
    }
    return data;
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const btn = document.querySelector('.btn-login');

        try {
            btn.disabled = true;
            const data = await doLogin(username, password);

            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userName', data.name || 'Usuario');

            btn.textContent = 'ACCESO AUTORIZADO';
            btn.style.transform = 'scale(1.05)';

            showNotification('success', 'Acceso autorizado', 'Redirigiendo al panel.');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } catch (err) {
            btn.disabled = false;
            showNotification('error', 'Acceso denegado', err.message || 'Verifica tus credenciales e intenta de nuevo.');
        }
    });
}

function showForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.classList.add('active');
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.classList.remove('active');
}

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email })
            });
            const text = await res.text();
            let data = {};
            if (text && text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch (_) {
                    throw new Error('El servidor no respondió con un formato válido.');
                }
            }

            if (data.ok) {
                showNotification('success', 'Solicitud enviada', data.message);
                closeForgotPasswordModal();
                forgotPasswordForm.reset();
            } else {
                showNotification('error', 'Error', data.error || 'No se pudo enviar la solicitud.');
            }
        } catch (err) {
            showNotification('error', 'Error', 'No se pudo conectar. Verifica que el servidor esté en ejecución.');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

window.loginWithProvider = loginWithProvider;
window.showForgotPasswordModal = showForgotPasswordModal;
window.closeForgotPasswordModal = closeForgotPasswordModal;