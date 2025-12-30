const { getSupabaseClient } = require('./_supabase');
const { jsonResponse, parseJsonBody, getPathId, makeId } = require('./_utils');

exports.handler = async (event) => {
  const supabase = getSupabaseClient();
  const method = event.httpMethod;
  const id = getPathId(event, 'cobranzas');

  try {
    if (method === 'GET') {
      const { data, error } = await supabase.from('cobranzas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      if (!payload.cliente || payload.saldo === undefined) {
        return jsonResponse(400, { error: 'Faltan campos obligatorios.' });
      }

      const now = new Date().toISOString();
      const record = {
        id: makeId(),
        cliente: payload.cliente,
        saldo: Number(payload.saldo) || 0,
        dias_mora: Number(payload.diasMora || 0),
        ultima_gestion: payload.ultimaGestion || '',
        estado: payload.estado || 'Pendiente',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('cobranzas').insert(record).select().single();
      if (error) throw error;
      return jsonResponse(201, data);
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        cliente: payload.cliente,
        saldo: payload.saldo !== undefined ? Number(payload.saldo) : undefined,
        dias_mora: payload.diasMora !== undefined ? Number(payload.diasMora) : undefined,
        ultima_gestion: payload.ultimaGestion,
        estado: payload.estado,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('cobranzas')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, data);
    }

    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('cobranzas').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Metodo no permitido.' });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error en cobranzas.' });
  }
};
