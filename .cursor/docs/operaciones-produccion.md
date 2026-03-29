# Operaciones de producción (Vercel-first)

## Flujo activo

- Plataforma oficial: **Vercel**.
- API activa: `https://<tu-dominio>/api/*` (handler: `server/server.js`).
- Frontend activo: archivos estáticos en `sistema-corporacion-v2`.

## Variables de entorno en Vercel

Configurar en **Development**, **Preview** y **Production**:

- `JWT_SECRET`
- `JWT_EXPIRATION` (ej. `8h`)
- `AUTH_COOKIE_NAME` (ej. `nk_session`)
- `ALLOWED_ORIGINS` (dominios permitidos por CORS)
- `AUTH_INIT_USERS` (usuarios iniciales)
- `TRACKING_API_KEY` (opcional para app móvil)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `ADMIN_EMAIL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE`

## Flujo de despliegue recomendado

1. Ejecutar `npm run check` en la raíz.
2. Ejecutar `npm --prefix server run check`.
3. Verificar manualmente login, dashboard y tracking.
4. Desplegar a Vercel.
5. Validar `GET /api/health` y `GET /api/metrics` con sesión activa.

## Netlify como respaldo (no activo por defecto)

- Mantener `netlify/functions` y `netlify.toml` solo para contingencias.
- El frontend no debe usar fallback Netlify automático.
- Para habilitar fallback de tracking de forma temporal, setear en runtime:
  - `window.__ENABLE_NETLIFY_BACKUP__ = true`
- No usar este modo salvo incidente operativo en Vercel.
