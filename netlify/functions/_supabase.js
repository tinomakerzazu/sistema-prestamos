const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

function getBucketName() {
  return process.env.SUPABASE_BUCKET || 'comprobantes';
}

module.exports = {
  getSupabaseClient,
  getBucketName
};
