checkAuth();
document.getElementById('userName').textContent = sessionStorage.getItem('userName') || 'Usuario';

const POLL_INTERVAL_MS = 10000;
const ONLINE_THRESHOLD_MS = 30000;
const FALLBACK_CENTER = { lat: -12.0464, lng: -77.0428 };

let mapInstance = null;
const markers = new Map();
let latestTracking = [];
let pollingTimer = null;
let mapReady = false;

const trackingStatus = document.getElementById('trackingStatus');
const trackingLastUpdate = document.getElementById('trackingLastUpdate');
const trackingLastDelta = document.getElementById('trackingLastDelta');
const trackingOnline = document.getElementById('trackingOnline');
const trackingOffline = document.getElementById('trackingOffline');
const trackingTotal = document.getElementById('trackingTotal');
const trackingTableBody = document.getElementById('trackingTableBody');
const trackingSearch = document.getElementById('trackingSearch');
const trackingStatusFilter = document.getElementById('trackingStatusFilter');
const trackingMapStatus = document.getElementById('trackingMapStatus');
const trackingSelected = document.getElementById('trackingSelected');

const refreshTrackingBtn = document.getElementById('refreshTrackingBtn');
const toggleTrackingBtn = document.getElementById('toggleTrackingBtn');
const centerMapBtn = document.getElementById('centerMapBtn');
const fitMapBtn = document.getElementById('fitMapBtn');

function getTrackingApiBase() {
    if (typeof window.__API_BASE__ === 'string' && window.__API_BASE__.trim()) {
        return window.__API_BASE__.trim();
    }
    const host = window.location.hostname;
    const port = window.location.port;
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3000') {
        return `${window.location.protocol}//${host}:3000/api`;
    }
    return '/api';
}

function initTrackingMap() {
    const mapElement = document.getElementById('trackingMap');
    if (!mapElement || !window.L) {
        if (trackingMapStatus) {
            trackingMapStatus.textContent = 'No se pudo cargar el mapa. Verifica la libreria Leaflet.';
        }
        return;
    }

    mapInstance = L.map(mapElement, {
        zoomControl: true
    }).setView([FALLBACK_CENTER.lat, FALLBACK_CENTER.lng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    mapReady = true;
    refreshTracking();
}

function startPolling() {
    stopPolling();
    pollingTimer = setInterval(refreshTracking, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
}

async function refreshTracking() {
    if (trackingStatus) {
        trackingStatus.textContent = 'Sincronizando ubicaciones...';
    }

    const locations = await fetchTrackingData();
    latestTracking = locations;

    updateSummary(locations);
    renderTable();
    updateMarkers(locations);
}

async function fetchTrackingData() {
    const apiBase = getTrackingApiBase();
    const endpoints = [`${apiBase}/tracking`];
    if (window.__ENABLE_NETLIFY_BACKUP__ === true) {
        endpoints.push('/.netlify/functions/tracking');
    }
    let rawLocations = [];
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, { cache: 'no-store', credentials: 'include' });
            if (!response.ok) continue;
            const payload = await response.json();
            rawLocations = normalizeTrackingPayloadRaw(payload);
            if (rawLocations.length > 0) break;
        } catch (err) {
            continue;
        }
    }

    let clientesMap = {};
    try {
        const clientes = await (typeof Storage !== 'undefined' && Storage.getClientes
            ? Storage.getClientes()
            : fetch(`${getTrackingApiBase()}/clientes`, { credentials: 'include' }).then(r => r.json()));
        clientes.forEach(c => { clientesMap[c.id] = `${c.nombres || ''} ${c.apellidos || ''}`.trim() || c.dni || 'Cliente'; });
    } catch (_) {}

    return rawLocations.map((item) => {
        const clientId = item.clientId || item.clienteId || item.id || item.cliente;
        const nombreReal = clientesMap[clientId] || item.cliente || item.clienteNombre || item.nombre || 'Cliente';
        return {
            ...item,
            id: item.id || clientId || `cliente-${Math.random()}`,
            cliente: nombreReal,
            clientId
        };
    });
}

function normalizeTrackingPayloadRaw(payload) {
    if (!payload) return [];
    const raw = Array.isArray(payload)
        ? payload
        : payload.data || payload.items || payload.locations || [];

    if (!Array.isArray(raw)) return [];

    return raw.map((item) => ({
        id: item.id || item.clientId || item.clienteId || item.cliente || item.userId || `cliente-${Math.random()}`,
        clientId: item.clientId || item.clienteId || item.cliente,
        cliente: item.cliente || item.clienteNombre || item.nombre || 'Cliente',
        lat: Number(item.lat ?? item.latitude),
        lng: Number(item.lng ?? item.lon ?? item.longitude),
        accuracy: Number(item.accuracy ?? item.precision),
        updatedAt: item.updatedAt || item.timestamp || item.fecha || new Date().toISOString(),
        dni: item.dni || '',
        speed: Number(item.speed || 0)
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function updateSummary(locations) {
    const now = Date.now();
    const online = locations.filter((loc) => isOnline(loc.updatedAt, now));
    const offlineCount = Math.max(locations.length - online.length, 0);

    if (trackingOnline) trackingOnline.textContent = online.length;
    if (trackingOffline) trackingOffline.textContent = offlineCount;
    if (trackingTotal) trackingTotal.textContent = locations.length;

    if (trackingLastUpdate) {
        trackingLastUpdate.textContent = locations.length
            ? formatTimestamp(getLatestTimestamp(locations))
            : '--';
    }

    if (trackingLastDelta) {
        trackingLastDelta.textContent = locations.length
            ? `Hace ${formatDelta(getLatestTimestamp(locations))}`
            : 'Esperando datos';
    }

    if (trackingStatus) {
        trackingStatus.textContent = locations.length
            ? `Actualizado cada ${POLL_INTERVAL_MS / 1000}s.`
            : 'Sin ubicaciones registradas.';
    }
}

function renderTable() {
    if (!trackingTableBody) return;
    const filtered = applyFilters(latestTracking);

    if (!filtered.length) {
        trackingTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ubicaciones disponibles.</td></tr>';
        return;
    }

    trackingTableBody.innerHTML = filtered.map((loc) => {
        const online = isOnline(loc.updatedAt, Date.now());
        const statusClass = online ? 'badge-success' : 'badge-warning';
        const statusLabel = online ? 'En linea' : 'Sin senal';
        const accuracyText = Number.isFinite(loc.accuracy) && loc.accuracy > 0 ? `${Math.round(loc.accuracy)} m` : '-';
        return `
            <tr data-id="${loc.id}">
                <td>${escapeHtml(loc.cliente)}${loc.dni ? `<small class="text-muted"> (${escapeHtml(loc.dni)})</small>` : ''}</td>
                <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td>${formatTimestamp(loc.updatedAt)}</td>
                <td>${accuracyText}</td>
                <td>${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</td>
            </tr>
        `;
    }).join('');
}

function updateMarkers(locations) {
    if (!mapReady || !mapInstance) return;

    const ids = new Set(locations.map((loc) => loc.id));
    markers.forEach((marker, id) => {
        if (!ids.has(id)) {
            marker.remove();
            markers.delete(id);
        }
    });

    locations.forEach((loc) => {
        const position = [loc.lat, loc.lng];
        if (!markers.has(loc.id)) {
            const marker = L.marker(position, { title: loc.cliente }).addTo(mapInstance);
            marker.bindPopup(buildInfoWindow(loc), { closeButton: false });

            marker.on('click', () => {
                marker.openPopup();
                if (trackingSelected) {
                    trackingSelected.textContent = `${loc.cliente} - ${formatTimestamp(loc.updatedAt)}`;
                }
            });

            markers.set(loc.id, marker);
        } else {
            markers.get(loc.id).setLatLng(position);
            markers.get(loc.id).setPopupContent(buildInfoWindow(loc));
        }
    });

    if (trackingMapStatus) {
        trackingMapStatus.textContent = locations.length
            ? `Mostrando ${locations.length} ubicaciones en el mapa.`
            : 'Mapa listo para recibir ubicaciones.';
    }
}

function buildInfoWindow(loc) {
    const accuracyText = Number.isFinite(loc.accuracy) && loc.accuracy > 0 ? `${Math.round(loc.accuracy)} m` : 'N/D';
    return `
        <div style="font-family: Arial, sans-serif; font-size: 12px;">
            <strong>${escapeHtml(loc.cliente)}</strong><br>
            Actualizado: ${formatTimestamp(loc.updatedAt)}<br>
            Precision: ${accuracyText}<br>
            Lat/Lng: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}
        </div>
    `;
}

function isOnline(updatedAt, nowMs) {
    const timestamp = new Date(updatedAt).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return (nowMs - timestamp) <= ONLINE_THRESHOLD_MS;
}

function getLatestTimestamp(locations) {
    return locations.reduce((latest, loc) => {
        const ts = new Date(loc.updatedAt).getTime();
        return ts > latest ? ts : latest;
    }, 0);
}

function formatTimestamp(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('es-PE');
}

function formatDelta(timestamp) {
    if (!timestamp) return '--';
    const diff = Date.now() - timestamp;
    if (!Number.isFinite(diff) || diff < 0) return '0s';
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

function applyFilters(locations) {
    const query = (trackingSearch?.value || '').trim().toLowerCase();
    const statusFilter = trackingStatusFilter?.value || '';
    return locations.filter((loc) => {
        const cliente = (loc.cliente || '').toLowerCase();
        const dni = (loc.dni || '').toLowerCase();
        const matchesQuery = !query || cliente.includes(query) || dni.includes(query);
        const isOnlineNow = isOnline(loc.updatedAt, Date.now());
        const matchesStatus = !statusFilter || (statusFilter === 'online' && isOnlineNow) || (statusFilter === 'offline' && !isOnlineNow);
        return matchesQuery && matchesStatus;
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

if (refreshTrackingBtn) {
    refreshTrackingBtn.addEventListener('click', refreshTracking);
}

if (toggleTrackingBtn) {
    toggleTrackingBtn.addEventListener('click', () => {
        const isOn = toggleTrackingBtn.dataset.state !== 'off';
        if (isOn) {
            toggleTrackingBtn.dataset.state = 'off';
            toggleTrackingBtn.innerHTML = '<i class="bi bi-play-circle"></i> Reanudar';
            stopPolling();
            if (trackingStatus) trackingStatus.textContent = 'Seguimiento en pausa.';
        } else {
            toggleTrackingBtn.dataset.state = 'on';
            toggleTrackingBtn.innerHTML = '<i class="bi bi-pause-circle"></i> Pausar';
            refreshTracking();
            startPolling();
        }
    });
}

if (centerMapBtn) {
    centerMapBtn.addEventListener('click', () => {
        if (mapInstance) {
            mapInstance.setView([FALLBACK_CENTER.lat, FALLBACK_CENTER.lng], 12);
        }
    });
}

if (fitMapBtn) {
    fitMapBtn.addEventListener('click', () => {
        if (!mapInstance || !markers.size) return;
        const group = L.featureGroup(Array.from(markers.values()));
        mapInstance.fitBounds(group.getBounds().pad(0.15));
    });
}

if (trackingSearch) {
    trackingSearch.addEventListener('input', renderTable);
}

if (trackingStatusFilter) {
    trackingStatusFilter.addEventListener('change', renderTable);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrackingMap);
} else {
    initTrackingMap();
}

startPolling();
