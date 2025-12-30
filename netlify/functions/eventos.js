const { getSupabaseClient } = require('./_supabase');
const { jsonResponse, parseJsonBody, getPathId, makeId } = require('./_utils');

exports.handler = async (event) => {
  const supabase = getSupabaseClient();
  const method = event.httpMethod;
  const id = getPathId(event, 'eventos');

  try {
    if (method === 'GET') {
      const { data, error } = await supabase.from('eventos').select('*').order('fecha', { ascending: true });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      if (!payload.fecha || !payload.tipo) {
        return jsonResponse(400, { error: 'Faltan campos obligatorios.' });
      }

      const now = new Date().toISOString();
      const record = {
        id: makeId(),
        fecha: payload.fecha,
        cliente: payload.cliente || '',
        tipo: payload.tipo,
        detalle: payload.detalle || '',
        prioridad: payload.prioridad || 'Media',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('eventos').insert(record).select().single();
      if (error) throw error;
      return jsonResponse(201, data);
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        ...payload,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('eventos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, data);
    }

    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('eventos').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Metodo no permitido.' });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error en eventos.' });
  }
};
