const { getSupabaseClient } = require('./_supabase');
const { jsonResponse, parseJsonBody, getPathId, makeId } = require('./_utils');

exports.handler = async (event) => {
  const supabase = getSupabaseClient();
  const method = event.httpMethod;
  const id = getPathId(event, 'prestamos');

  try {
    if (method === 'GET') {
      const { data, error } = await supabase.from('prestamos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      const now = new Date().toISOString();
      const record = {
        id: makeId(),
        cliente: payload.cliente || '',
        monto_prestado: payload.montoPrestado || 0,
        estado: payload.estado || 'activo',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('prestamos').insert(record).select().single();
      if (error) throw error;
      return jsonResponse(201, data);
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        ...payload,
        monto_prestado: payload.montoPrestado,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('prestamos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, data);
    }

    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('prestamos').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Metodo no permitido.' });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error en prestamos.' });
  }
};
