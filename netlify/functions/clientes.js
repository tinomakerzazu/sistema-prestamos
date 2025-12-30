const { getSupabaseClient } = require('./_supabase');
const { jsonResponse, parseJsonBody, getPathId, makeId } = require('./_utils');

exports.handler = async (event) => {
  const supabase = getSupabaseClient();
  const method = event.httpMethod;
  const id = getPathId(event, 'clientes');

  try {
    if (method === 'GET') {
      const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, data || []);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      if (!payload.dni || !payload.nombres || !payload.apellidos || !payload.telefonoPrincipal) {
        return jsonResponse(400, { error: 'Faltan campos obligatorios.' });
      }

      const now = new Date().toISOString();
      const record = {
        id: makeId(),
        dni: payload.dni,
        nombres: payload.nombres,
        apellidos: payload.apellidos,
        telefono_principal: payload.telefonoPrincipal,
        direccion: payload.direccion || '',
        ocupacion: payload.ocupacion || '',
        ingresos_mensuales: payload.ingresosMensuales || null,
        observaciones: payload.observaciones || '',
        foto_perfil: payload.fotoPerfil || null,
        foto_documento: payload.fotoDocumento || null,
        ubicacion: payload.ubicacion || null,
        aval: payload.aval || null,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('clientes').insert(record).select().single();
      if (error) throw error;
      return jsonResponse(201, data);
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        ...payload,
        telefono_principal: payload.telefonoPrincipal,
        foto_perfil: payload.fotoPerfil,
        foto_documento: payload.fotoDocumento,
        ingresos_mensuales: payload.ingresosMensuales,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(200, data);
    }

    if (method === 'DELETE' && id) {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Metodo no permitido.' });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error en clientes.' });
  }
};
