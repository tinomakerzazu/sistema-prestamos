function loginWithProvider(provider) {
    alert(`Función "${provider}" en desarrollo.\n\nPor ahora usa el login tradicional:\nUsuario: admin\nContraseña: admin123`);
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username === 'admin' && password === 'admin123') {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userName', 'Administrador');

        const btn = document.querySelector('.btn-login');
        btn.textContent = 'ACCESO AUTORIZADO';
        btn.style.transform = 'scale(1.05)';

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
    } else {
        alert('Acceso denegado\n\nCredenciales incorrectas\n\nUsuario: admin\nContraseña: admin123');
    }
});

window.loginWithProvider = loginWithProvider;
