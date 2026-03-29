# Guía rápida de arquitectura

## Módulos principales

- `server/`: API Express, autenticación por cookie, JSON como almacenamiento local.
- `sistema-corporacion-v2/`: panel web multipágina (HTML/CSS/JS vanilla).
- `netlify/functions/`: backend alterno con Supabase (respaldo no activo).
- `app-track/`: app Flutter de tracking.

## Endpoints críticos

- `POST /api/auth/login`: inicia sesión y setea cookie `httpOnly`.
- `POST /api/auth/logout`: cierra sesión.
- `GET /api/health`: salud de servicio y almacenamiento.
- `POST /api/tracking`: tracking (sesión o `TRACKING_API_KEY`).
- CRUD: `/api/clientes`, `/api/prestamos`, `/api/pagos`, `/api/cobranzas`, `/api/eventos`.

## Convenciones del proyecto

- Vercel es el despliegue principal, con `vercel.json` en la raíz.
- `sistema-corporacion-v2/js/storage.js` centraliza llamadas al API.
- Todo cambio relevante debe pasar `npm run check` en la raíz.
- Mantener compatibilidad con datos actuales en `server/data/*.json`.
