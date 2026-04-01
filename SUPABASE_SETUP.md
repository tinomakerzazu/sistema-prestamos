# Supabase setup para Netlify

## Variables de entorno en Netlify
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET` (ej: `comprobantes`)

## Bucket de Storage
1) Crear bucket con el nombre de `SUPABASE_BUCKET`.
2) Ponerlo en **Public** para que los links funcionen sin firma.

## Tablas (SQL)
Ejecuta esto en el SQL Editor de Supabase:

```sql
-- =============================================
-- TABLAS COMPLETAS (crear desde cero)
-- =============================================

create table if not exists public.clientes (
  id uuid primary key,
  dni text not null,
  nombres text not null,
  apellidos text not null,
  telefono_principal text not null,
  direccion text,
  ocupacion text,
  ingresos_mensuales numeric,
  observaciones text,
  foto_perfil text,
  foto_documento text,
  ubicacion jsonb,
  aval jsonb,
  correo text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prestamos (
  id uuid primary key,
  cliente_id uuid,
  cliente text,
  monto_prestado numeric,
  interes numeric default 0,
  tiempo_paga text default '',
  frecuencia_pago text default '',
  numero_cuotas integer default 0,
  fecha_inicio text,
  cronograma_pagos jsonb default '[]'::jsonb,
  observaciones text default '',
  monto_total numeric,
  cuota numeric,
  estado text default 'activo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pagos (
  id uuid primary key,
  cliente text not null,
  cliente_id uuid,
  monto numeric not null,
  fecha text not null,
  metodo text not null,
  referencia text default '',
  estado text default 'Registrado',
  nota text default '',
  comprobante_url text,
  comprobante_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.eventos (
  id uuid primary key,
  fecha text not null,
  cliente text default '',
  tipo text not null,
  detalle text default '',
  prioridad text default 'Media',
  avisar_admin boolean default true,
  avisar_cliente boolean default false,
  aviso_enviado_cliente boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cobranzas (
  id uuid primary key,
  cliente text not null,
  saldo numeric not null,
  dias_mora integer default 0,
  ultima_gestion text default '',
  estado text default 'Pendiente',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tracking (
  id uuid primary key,
  client_id text not null,
  lat numeric not null,
  lng numeric not null,
  accuracy numeric,
  timestamp text,
  token text default '',
  updated_at timestamptz default now()
);

-- Log de recordatorios por correo (cron diario; evita duplicados por préstamo y fecha de cuota)
create table if not exists public.recordatorios_email_log (
  id uuid primary key default gen_random_uuid(),
  prestamo_id text not null,
  fecha_cuota text not null,
  sent_at timestamptz not null default now(),
  unique (prestamo_id, fecha_cuota)
);
```

## Migración (si las tablas ya existen)

Si ya creaste las tablas pero les faltan columnas, ejecuta:

```sql
-- Clientes
alter table public.clientes add column if not exists correo text default '';

-- Prestamos (columnas faltantes)
alter table public.prestamos add column if not exists cliente_id uuid;
alter table public.prestamos add column if not exists interes numeric default 0;
alter table public.prestamos add column if not exists tiempo_paga text default '';
alter table public.prestamos add column if not exists frecuencia_pago text default '';
alter table public.prestamos add column if not exists numero_cuotas integer default 0;
alter table public.prestamos add column if not exists fecha_inicio text;
alter table public.prestamos add column if not exists cronograma_pagos jsonb default '[]'::jsonb;
alter table public.prestamos add column if not exists observaciones text default '';
alter table public.prestamos add column if not exists monto_total numeric;
alter table public.prestamos add column if not exists cuota numeric;

-- Eventos (columnas faltantes)
alter table public.eventos add column if not exists avisar_admin boolean default true;
alter table public.eventos add column if not exists avisar_cliente boolean default false;
alter table public.eventos add column if not exists aviso_enviado_cliente boolean default false;

-- Tracking (crear tabla si no existe)
create table if not exists public.tracking (
  id uuid primary key,
  client_id text not null,
  lat numeric not null,
  lng numeric not null,
  accuracy numeric,
  timestamp text,
  token text default '',
  updated_at timestamptz default now()
);

-- Recordatorios por correo (deduplicación del cron)
create table if not exists public.recordatorios_email_log (
  id uuid primary key default gen_random_uuid(),
  prestamo_id text not null,
  fecha_cuota text not null,
  sent_at timestamptz not null default now(),
  unique (prestamo_id, fecha_cuota)
);
```

## Nota
- Usamos `SUPABASE_SERVICE_ROLE_KEY` solo en Functions (backend). No lo pongas en el frontend.
- `fecha` en pagos y eventos es `text` (no `date`) porque el frontend envía strings ISO.
