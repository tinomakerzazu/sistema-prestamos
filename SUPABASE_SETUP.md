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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.prestamos (
  id uuid primary key,
  cliente text,
  monto_prestado numeric,
  estado text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.pagos (
  id uuid primary key,
  cliente text not null,
  cliente_id uuid,
  monto numeric not null,
  fecha date not null,
  metodo text not null,
  referencia text,
  estado text,
  nota text,
  comprobante_url text,
  comprobante_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.eventos (
  id uuid primary key,
  fecha date not null,
  cliente text,
  tipo text not null,
  detalle text,
  prioridad text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cobranzas (
  id uuid primary key,
  cliente text not null,
  saldo numeric not null,
  dias_mora integer,
  ultima_gestion text,
  estado text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Nota
- Usamos `SUPABASE_SERVICE_ROLE_KEY` solo en Functions (backend). No lo pongas en el frontend.
