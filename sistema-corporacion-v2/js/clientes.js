checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';

let fotoPerfilBase64 = null;
let fotoDocumentoBase64 = null;
let locationWatchId = null;
let mapInstance = null;
let mapMarker = null;
let clientesCache = [];

const locationStatus = document.getElementById('locationStatus');
const locationAccuracy = document.getElementById('locationAccuracy');
const ubicacionLat = document.getElementById('ubicacionLat');
const ubicacionLng = document.getElementById('ubicacionLng');
const ubicacionAcc = document.getElementById('ubicacionAcc');
const mapLive = document.getElementById('mapLive');

function ensureMap() {
    if (!mapLive || !window.L) return;
    if (mapInstance) return;

    mapInstance = L.map('mapLive', { zoomControl: true }).setView([-12.0464, -77.0428], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);
}

function startLocation() {
    if (!navigator.geolocation) {
        showNotification('Geolocalización no soportada en este navegador', 'error');
        return;
    }
    if (locationWatchId !== null) return;

    ensureMap();
    locationStatus.textContent = 'Buscando ubicación...';
    locationAccuracy.textContent = '';

    locationWatchId = navigator.geolocation.watchPosition(
        (position) => updateLocation(position),
        () => {
            locationStatus.textContent = 'No se pudo obtener la ubicación';
            showNotification('No se pudo obtener la ubicación', 'error');
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
}

function stopLocation() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        locationStatus.textContent = 'Ubicación detenida';
    }
}

function clearLocation() {
    stopLocation();
    ubicacionLat.value = '';
    ubicacionLng.value = '';
    ubicacionAcc.value = '';
    locationStatus.textContent = 'Ubicación no registrada';
    locationAccuracy.textContent = '';
    if (mapMarker && mapInstance) {
        mapInstance.removeLayer(mapMarker);
        mapMarker = null;
    }
}

function updateLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;
    ubicacionLat.value = latitude.toFixed(6);
    ubicacionLng.value = longitude.toFixed(6);
    ubicacionAcc.value = Math.round(accuracy);

    locationStatus.textContent = `Lat: ${ubicacionLat.value}, Lng: ${ubicacionLng.value}`;
    locationAccuracy.textContent = `Precisión: ${ubicacionAcc.value}m`;

    if (mapInstance && window.L) {
        const coords = [latitude, longitude];
        if (!mapMarker) {
            mapMarker = L.marker(coords).addTo(mapInstance);
        } else {
            mapMarker.setLatLng(coords);
        }
        mapInstance.setView(coords, 15);
    }
}

function buildLocationPayload() {
    if (!ubicacionLat.value || !ubicacionLng.value) return null;
    return {
        lat: parseFloat(ubicacionLat.value),
        lng: parseFloat(ubicacionLng.value),
        accuracy: parseFloat(ubicacionAcc.value || 0),
        timestamp: new Date().toISOString()
    };
}

function buildAvalPayload() {
    const nombre = document.getElementById('avalNombre').value.trim();
    const telefono = document.getElementById('avalTelefono').value.trim();
    const relacion = document.getElementById('avalRelacion').value.trim();
    if (!nombre && !telefono && !relacion) return null;
    return { nombre, telefono, relacion };
}

function previewFoto(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es muy grande. Máximo 5MB');
            input.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            const base64 = e.target.result;

            if (previewId === 'fotoPerfilPreview') {
                fotoPerfilBase64 = base64;
            } else {
                fotoDocumentoBase64 = base64;
            }

            preview.innerHTML = `<img src="${base64}" alt="Vista previa">`;
        };

        reader.readAsDataURL(file);
    }
}

async function loadClientes() {
    try {
        clientesCache = await Storage.getClientes();
        const tbody = document.getElementById('clientesTableBody');

        updateBadges();

        if (clientesCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay clientes registrados</td></tr>';
            return;
        }

        tbody.innerHTML = clientesCache.map(cliente => renderClienteRow(cliente)).join('');
    } catch (err) {
        console.error(err);
        showNotification('No se pudieron cargar los clientes', 'error');
    }
}

function renderClienteRow(cliente) {
    const fotoHTML = cliente.fotoPerfil
        ? `<img src="${escapeHtml(cliente.fotoPerfil)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gold);">`
        : '<i class="bi bi-person-circle" style="font-size: 2rem; color: var(--gold);"></i>';

    const avalNombre = cliente.aval?.nombre ? cliente.aval.nombre : '-';
    const id = escapeHtml(cliente.id);

    return `<tr>
        <td>${fotoHTML}</td>
        <td>${escapeHtml(cliente.dni)}</td>
        <td>${escapeHtml(`${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim())}</td>
        <td>${escapeHtml(cliente.telefonoPrincipal)}</td>
        <td>${escapeHtml(cliente.correo || '-')}</td>
        <td>${escapeHtml(cliente.direccion || '-')}</td>
        <td>${escapeHtml(avalNombre)}</td>
        <td>
            <button class="btn btn-info btn-sm js-view-cliente" data-cliente-id="${id}" type="button">
                <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-secondary btn-sm js-edit-cliente" data-cliente-id="${id}" type="button">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-danger btn-sm js-delete-cliente" data-cliente-id="${id}" type="button">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    </tr>`;
}

function filterClientes() {
    const search = document.getElementById('searchCliente').value.toLowerCase();

    const filtered = clientesCache.filter(c =>
        String(c.dni || '').includes(search) ||
        String(c.nombres || '').toLowerCase().includes(search) ||
        String(c.apellidos || '').toLowerCase().includes(search) ||
        String(c.telefonoPrincipal || '').includes(search) ||
        String(c.correo || '').toLowerCase().includes(search) ||
        (c.aval?.nombre || '').toLowerCase().includes(search) ||
        (c.aval?.telefono || '').includes(search)
    );

    const tbody = document.getElementById('clientesTableBody');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No se encontraron resultados</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(cliente => renderClienteRow(cliente)).join('');
}

function showAddClienteModal() {
    const editId = document.getElementById('clienteEditId');
    if (editId) editId.value = '';
    const title = document.getElementById('clienteModalTitle');
    if (title) title.innerHTML = '<i class="bi bi-person-plus"></i> Nuevo cliente';

    document.getElementById('clienteForm').reset();
    fotoPerfilBase64 = null;
    fotoDocumentoBase64 = null;
    clearLocation();

    document.getElementById('fotoPerfilPreview').innerHTML = `
        <div class="foto-placeholder">
            <i class="bi bi-camera-fill"></i>
            <p>Click para subir foto</p>
            <small>PNG, JPG (Max. 5MB)</small>
        </div>`;

    document.getElementById('fotoDocumentoPreview').innerHTML = `
        <div class="foto-placeholder">
            <i class="bi bi-file-earmark-image"></i>
            <p>Click para subir documento</p>
            <small>PNG, JPG (Max. 5MB)</small>
        </div>`;

    showModal('addClienteModal');
}

function showEditCliente(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;

    const editId = document.getElementById('clienteEditId');
    if (editId) editId.value = cliente.id;

    const title = document.getElementById('clienteModalTitle');
    if (title) title.innerHTML = '<i class="bi bi-pencil-square"></i> Editar cliente';

    document.getElementById('dni').value = cliente.dni || '';
    document.getElementById('nombres').value = cliente.nombres || '';
    document.getElementById('apellidos').value = cliente.apellidos || '';
    document.getElementById('telefonoPrincipal').value = cliente.telefonoPrincipal || '';
    const correoEl = document.getElementById('correoCliente');
    if (correoEl) correoEl.value = cliente.correo || '';
    document.getElementById('direccion').value = cliente.direccion || '';
    document.getElementById('ocupacion').value = cliente.ocupacion || '';
    document.getElementById('ingresosMensuales').value = cliente.ingresosMensuales ?? '';
    document.getElementById('observaciones').value = cliente.observaciones || '';

    if (cliente.aval) {
        document.getElementById('avalNombre').value = cliente.aval.nombre || '';
        document.getElementById('avalTelefono').value = cliente.aval.telefono || '';
        document.getElementById('avalRelacion').value = cliente.aval.relacion || '';
    }

    if (cliente.ubicacion?.lat != null && cliente.ubicacion?.lng != null) {
        document.getElementById('ubicacionLat').value = cliente.ubicacion.lat;
        document.getElementById('ubicacionLng').value = cliente.ubicacion.lng;
        document.getElementById('ubicacionAcc').value = cliente.ubicacion.accuracy || '';
    }

    fotoPerfilBase64 = null;
    fotoDocumentoBase64 = null;
    const fp = document.getElementById('fotoPerfilPreview');
    const fd = document.getElementById('fotoDocumentoPreview');
    if (cliente.fotoPerfil && fp) {
        fp.innerHTML = `<img src="${escapeHtml(cliente.fotoPerfil)}" alt="Perfil">`;
    } else if (fp) {
        fp.innerHTML = `<div class="foto-placeholder"><i class="bi bi-camera-fill"></i><p>Click para subir foto</p></div>`;
    }
    if (cliente.fotoDocumento && fd) {
        fd.innerHTML = `<img src="${escapeHtml(cliente.fotoDocumento)}" alt="Documento">`;
    } else if (fd) {
        fd.innerHTML = `<div class="foto-placeholder"><i class="bi bi-file-earmark-image"></i><p>Click para subir documento</p></div>`;
    }

    showModal('addClienteModal');
}

document.getElementById('clienteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
        form.reportValidity();
        showNotification('Completa los campos obligatorios para registrar el cliente.', 'error');
        return;
    }

    const editId = document.getElementById('clienteEditId')?.value?.trim();
    const existing = editId ? clientesCache.find(c => c.id === editId) : null;

    const cliente = {
        dni: document.getElementById('dni').value.trim(),
        nombres: document.getElementById('nombres').value.trim(),
        apellidos: document.getElementById('apellidos').value.trim(),
        telefonoPrincipal: document.getElementById('telefonoPrincipal').value.trim(),
        correo: document.getElementById('correoCliente')?.value?.trim() || '',
        direccion: document.getElementById('direccion').value.trim(),
        ocupacion: document.getElementById('ocupacion').value.trim(),
        ingresosMensuales: document.getElementById('ingresosMensuales').value,
        observaciones: document.getElementById('observaciones').value.trim(),
        fotoPerfil: fotoPerfilBase64 || existing?.fotoPerfil || null,
        fotoDocumento: fotoDocumentoBase64 || existing?.fotoDocumento || null,
        ubicacion: buildLocationPayload(),
        aval: buildAvalPayload()
    };

    try {
        if (editId) {
            await Storage.updateCliente(editId, cliente);
            showNotification('Cliente actualizado', 'success');
            closeModal('addClienteModal');
            loadClientes();
        } else {
            await Storage.saveCliente(cliente);
            showSuccessAnimation();
            showNotification('Cliente registrado exitosamente', 'success');
            setTimeout(() => {
                closeModal('addClienteModal');
                loadClientes();
            }, 2000);
        }
    } catch (err) {
        console.error(err);
        showNotification(err.message || 'No se pudo registrar el cliente', 'error');
    }
});

function viewCliente(id) {
    const cliente = clientesCache.find(item => item.id === id);
    if (cliente) {
        let message = `Cliente: ${cliente.nombres} ${cliente.apellidos}\nDNI: ${cliente.dni}\nTeléfono: ${cliente.telefonoPrincipal}`;

        if (cliente.fotoPerfil) {
            message += '\n\nSí. Tiene foto de perfil';
        }
        if (cliente.fotoDocumento) {
            message += '\nSí. Tiene foto de documento';
        }
        if (cliente.aval?.nombre) {
            message += `\n\nAval: ${cliente.aval.nombre}`;
            if (cliente.aval.telefono) message += `\nTeléfono aval: ${cliente.aval.telefono}`;
            if (cliente.aval.relacion) message += `\nRelación: ${cliente.aval.relacion}`;
        }
        if (cliente.ubicacion?.lat && cliente.ubicacion?.lng) {
            message += `\n\nUbicación: ${cliente.ubicacion.lat.toFixed(5)}, ${cliente.ubicacion.lng.toFixed(5)}`;
        }

        showNotification(message, 'success');
    }
}

async function deleteCliente(id) {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
        try {
            await Storage.deleteCliente(id);
            showNotification('Cliente eliminado', 'success');
            loadClientes();
        } catch (err) {
            console.error(err);
            showNotification('No se pudo eliminar el cliente', 'error');
        }
    }
}

loadClientes();

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', toggleSidebar);
}

const nuevoClienteBtn = document.getElementById('nuevoClienteBtn');
if (nuevoClienteBtn) {
    nuevoClienteBtn.addEventListener('click', showAddClienteModal);
}

const searchClienteInput = document.getElementById('searchCliente');
if (searchClienteInput) {
    searchClienteInput.addEventListener('input', filterClientes);
}

document.querySelectorAll('.close-cliente-modal-btn').forEach((button) => {
    button.addEventListener('click', () => closeModal('addClienteModal'));
});

const fotoPerfilPreview = document.getElementById('fotoPerfilPreview');
const fotoPerfilInput = document.getElementById('fotoPerfil');
if (fotoPerfilPreview && fotoPerfilInput) {
    fotoPerfilPreview.addEventListener('click', () => fotoPerfilInput.click());
    fotoPerfilInput.addEventListener('change', () => previewFoto(fotoPerfilInput, 'fotoPerfilPreview'));
}

const fotoDocumentoPreview = document.getElementById('fotoDocumentoPreview');
const fotoDocumentoInput = document.getElementById('fotoDocumento');
if (fotoDocumentoPreview && fotoDocumentoInput) {
    fotoDocumentoPreview.addEventListener('click', () => fotoDocumentoInput.click());
    fotoDocumentoInput.addEventListener('change', () => previewFoto(fotoDocumentoInput, 'fotoDocumentoPreview'));
}

const startLocationBtn = document.getElementById('startLocationBtn');
if (startLocationBtn) {
    startLocationBtn.addEventListener('click', startLocation);
}

const stopLocationBtn = document.getElementById('stopLocationBtn');
if (stopLocationBtn) {
    stopLocationBtn.addEventListener('click', stopLocation);
}

const clearLocationBtn = document.getElementById('clearLocationBtn');
if (clearLocationBtn) {
    clearLocationBtn.addEventListener('click', clearLocation);
}

document.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.js-view-cliente');
    if (viewBtn) {
        const id = viewBtn.getAttribute('data-cliente-id');
        if (id) viewCliente(id);
        return;
    }

    const editBtn = event.target.closest('.js-edit-cliente');
    if (editBtn) {
        const id = editBtn.getAttribute('data-cliente-id');
        if (id) showEditCliente(id);
        return;
    }

    const deleteBtn = event.target.closest('.js-delete-cliente');
    if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-cliente-id');
        if (id) deleteCliente(id);
    }
});
window.previewFoto = previewFoto;
window.startLocation = startLocation;
window.stopLocation = stopLocation;
window.clearLocation = clearLocation;
window.showAddClienteModal = showAddClienteModal;
window.showEditCliente = showEditCliente;
window.filterClientes = filterClientes;
window.viewCliente = viewCliente;
window.deleteCliente = deleteCliente;
