function loginWithProvider(provider) {
    alert(`Funcion "${provider}" en desarrollo.\n\nPor ahora usa el login tradicional:\nUsuario: jairo@corp.prestamos.com\nContrasena: 011029`);
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username === 'jairo@corp.prestamos.com' && password === '011029') {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userName', 'Jairo');

        const btn = document.querySelector('.btn-login');
        btn.textContent = 'ACCESO AUTORIZADO';
        btn.style.transform = 'scale(1.05)';

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
    } else {
        alert('Acceso denegado\n\nCredenciales incorrectas\n\nUsuario: jairo@corp.prestamos.com\nContrasena: 011029');
    }
});

window.loginWithProvider = loginWithProvider;
