checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';
updateBadges();
