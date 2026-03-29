# Configuración Cursor del proyecto

Este directorio centraliza la configuración y guías usadas por Cursor/Agentes.

## Estructura

- `rules/`: reglas `.mdc` activas para desarrollo seguro en producción.
- `docs/`: documentación operativa y checklist de release.

## Reglas activas

- `rules/core-production.mdc`
- `rules/backend-api.mdc`
- `rules/frontend-web.mdc`

## Recomendación de uso

1. Mantener nuevas reglas en `rules/` (una responsabilidad por archivo).
2. Mantener guías operativas en `docs/`.
3. Conservar `AGENTS.md` en raíz para máxima compatibilidad de descubrimiento.
