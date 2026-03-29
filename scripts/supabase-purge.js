const { createClient } = require('@supabase/supabase-js');

const TABLES = ['pagos', 'prestamos', 'clientes', 'cobranzas', 'eventos'];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return String(value).trim();
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    yes: args.has('--yes') || args.has('-y')
  };
}

async function main() {
  const { yes } = parseArgs(process.argv);
  if (!yes) {
    console.error(
      [
        '[aborted] Este script borra datos en Supabase.',
        'Ejecuta con --yes para confirmar.',
        'Ejemplo: node scripts/supabase-purge.js --yes'
      ].join('\n')
    );
    process.exitCode = 2;
    return;
  }

  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const table of TABLES) {
    // Borrado total: requiere que la tabla tenga al menos una columna 'id' o que RLS permita delete.
    // Con service role normalmente se omite RLS.
    const { error } = await supabase.from(table).delete().neq('id', '');
    if (error) {
      throw new Error(`Error borrando tabla ${table}: ${error.message || String(error)}`);
    }
    console.log(`[ok] ${table}: registros borrados`);
  }

  console.log('[done] Supabase limpio.');
}

main().catch((err) => {
  console.error('[error]', err?.message || err);
  process.exitCode = 1;
});

