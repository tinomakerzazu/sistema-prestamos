const { getSupabaseClient, getBucketName } = require('./_supabase');
const { jsonResponse, parseJsonBody, getPathId, makeId, parseDataUrl, getExtensionFromType } = require('./_utils');

exports.handler = async (event) => {
  const supabase = getSupabaseClient();
  const bucket = getBucketName();
  const method = event.httpMethod;
  const id = getPathId(event, 'pagos');

  try {
    if (method === 'GET') {
      const { data, error } = await supabase.from('pagos').select('*').order('fecha', { ascending: false });
      if (error) throw error;

      const mapped = (data || []).map(item => ({
        id: item.id,
        cliente: item.cliente,
        clienteId: item.cliente_id,
        monto: item.monto,
        fecha: item.fecha,
        metodo: item.metodo,
        referencia: item.referencia,
        estado: item.estado,
        nota: item.nota,
        comprobante: item.comprobante_url ? {
          url: item.comprobante_url,
          name: item.comprobante_name || ''
        } : null
      }));

      return jsonResponse(200, mapped);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      if (!payload.cliente || !payload.monto || !payload.fecha || !payload.metodo) {
        return jsonResponse(400, { error: 'Faltan campos obligatorios.' });
      }

      let comprobanteUrl = null;
      let comprobanteName = null;

      if (payload.comprobanteBase64) {
        const parsed = parseDataUrl(payload.comprobanteBase64);
        if (!parsed) {
          return jsonResponse(400, { error: 'Comprobante invalido.' });
        }

        const ext = payload.comprobanteName
          ? `.${payload.comprobanteName.split('.').pop()}`
          : getExtensionFromType(parsed.contentType);
        const fileName = `${Date.now()}-${makeId()}${ext}`;
        const filePath = `pagos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, parsed.buffer, {
            contentType: parsed.contentType,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        comprobanteUrl = publicData?.publicUrl || null;
        comprobanteName = payload.comprobanteName || fileName;
      }

      const now = new Date().toISOString();
      const record = {
        id: makeId(),
        cliente: payload.cliente,
        cliente_id: payload.clienteId || null,
        monto: Number(payload.monto) || 0,
        fecha: payload.fecha,
        metodo: payload.metodo,
        referencia: payload.referencia || '',
        estado: payload.estado || 'Registrado',
        nota: payload.nota || '',
        comprobante_url: comprobanteUrl,
        comprobante_name: comprobanteName,
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('pagos').insert(record).select().single();
      if (error) throw error;

      return jsonResponse(201, {
        id: data.id,
        cliente: data.cliente,
        clienteId: data.cliente_id,
        monto: data.monto,
        fecha: data.fecha,
        metodo: data.metodo,
        referencia: data.referencia,
        estado: data.estado,
        nota: data.nota,
        comprobante: data.comprobante_url ? {
          url: data.comprobante_url,
          name: data.comprobante_name || ''
        } : null
      });
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        estado: payload.estado,
        nota: payload.nota,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('pagos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      return jsonResponse(200, data);
    }

    if (method === 'DELETE' && id) {
      const { data: existing, error: fetchError } = await supabase
        .from('pagos')
        .select('comprobante_url')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      if (existing?.comprobante_url) {
        const parts = existing.comprobante_url.split('/');
        const fileName = parts.slice(-2).join('/');
        if (fileName) {
          await supabase.storage.from(bucket).remove([fileName]);
        }
      }

      const { error } = await supabase.from('pagos').delete().eq('id', id);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Metodo no permitido.' });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error en pagos.' });
  }
};
