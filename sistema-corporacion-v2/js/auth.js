function showNotification(type, title, message) {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notice = document.createElement('div');
    notice.className = `notification ${type}`;
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    notice.innerHTML = `
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}"></i>
        <div>
            <strong>${title}</strong><br>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notice);

    setTimeout(() => {
        notice.remove();
    }, 3500);
}

function loginWithProvider(provider) {
    showNotification('error', 'En desarrollo', `La opcion ${provider} aun no esta disponible.`);
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === 'jairo@corp.prestamos.com' && password === '011029') {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('userName', 'Jairo');

            const btn = document.querySelector('.btn-login');
            btn.textContent = 'ACCESO AUTORIZADO';
            btn.style.transform = 'scale(1.05)';

            showNotification('success', 'Acceso autorizado', 'Redirigiendo al panel.');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            showNotification('error', 'Acceso denegado', 'Verifica tus credenciales e intenta de nuevo.');
        }
    });
}

window.loginWithProvider = loginWithProvider;
