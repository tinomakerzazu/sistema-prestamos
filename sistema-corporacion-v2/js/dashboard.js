checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
document.getElementById('currentDate').textContent = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

async function loadStats() {
    try {
        const [clientes, prestamos] = await Promise.all([
            Storage.getClientes(),
            Storage.getPrestamos()
        ]);

        document.getElementById('totalClientes').textContent = clientes.length;
        document.getElementById('prestamosActivos').textContent = prestamos.filter(p => p.estado === 'activo').length;

        const capitalPrestado = prestamos
            .filter(p => p.estado === 'activo' || p.estado === 'vencido')
            .reduce((sum, p) => sum + parseFloat(p.montoPrestado || 0), 0);
        document.getElementById('capitalPrestado').textContent = formatMoney(capitalPrestado);

        const prestamosVencidos = prestamos.filter(p => p.estado === 'vencido').length;
        document.getElementById('prestamosVencidos').textContent = prestamosVencidos;

        updateBadges();
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los indicadores', 'error');
    }
}

loadStats();

const revealOverlay = document.querySelector('.reveal-overlay');
document.body.classList.add('intro-reveal');
if (revealOverlay) {
    setTimeout(() => {
        revealOverlay.classList.add('reveal-hide');
    }, 1500);

    setTimeout(() => {
        revealOverlay.remove();
        document.body.classList.remove('intro-reveal');
    }, 2400);
} else {
    document.body.classList.remove('intro-reveal');
}
