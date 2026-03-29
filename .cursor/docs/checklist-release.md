# Checklist de release y monitoreo

## Antes de liberar

- [ ] `npm run check` pasa sin errores.
- [ ] Login responde `200` y crea sesión por cookie.
- [ ] Endpoint protegido (`/api/clientes`) responde `401` sin sesión.
- [ ] Endpoint protegido responde `200` con sesión válida.
- [ ] `GET /api/health` retorna `ok: true`.
- [ ] Variables sensibles están en Vercel (no en repo).

## Después de liberar

- [ ] Revisar logs de Vercel durante 15 minutos.
- [ ] Verificar error rate (5xx) dentro de umbral.
- [ ] Verificar envío de SMS (si está habilitado).
- [ ] Verificar solicitudes de recuperación por correo (SMTP).
- [ ] Revisar `/api/metrics` con sesión activa.

## Incidentes y rollback

- [ ] Si hay falla crítica, revertir al deployment estable anterior en Vercel.
- [ ] Mantener Netlify como respaldo técnico, no como flujo principal.
- [ ] Documentar causa raíz y acción correctiva antes del siguiente release.
