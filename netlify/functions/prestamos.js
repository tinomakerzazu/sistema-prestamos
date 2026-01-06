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
      const mapped = (data || []).map(item => ({
        id: item.id,
        cliente: item.cliente,
        montoPrestado: item.monto_prestado,
        interes: item.interes,
        tiempoPaga: item.tiempo_paga,
        frecuenciaPago: item.frecuencia_pago,
        numeroCuotas: item.numero_cuotas,
        fechaInicio: item.fecha_inicio,
        cronogramaPagos: item.cronograma_pagos,
        observaciones: item.observaciones,
        montoTotal: item.monto_total,
        cuota: item.cuota,
        estado: item.estado,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }));
      return jsonResponse(200, mapped);
    }

    if (method === 'POST') {
      const payload = parseJsonBody(event.body);
      const now = new Date().toISOString();
      const montoPrestado = Number(payload.montoPrestado) || 0;
      const interes = Number(payload.interes) || 0;
      const numeroCuotas = Number(payload.numeroCuotas) || 0;
      const montoTotal = Number(payload.montoTotal) || 0;
      const cuota = Number(payload.cuota) || 0;
      const record = {
        id: makeId(),
        cliente: payload.cliente || '',
        monto_prestado: montoPrestado,
        interes,
        tiempo_paga: payload.tiempoPaga || '',
        frecuencia_pago: payload.frecuenciaPago || '',
        numero_cuotas: numeroCuotas,
        fecha_inicio: payload.fechaInicio || null,
        cronograma_pagos: payload.cronogramaPagos || null,
        observaciones: payload.observaciones || '',
        monto_total: montoTotal,
        cuota,
        estado: payload.estado || 'activo',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase.from('prestamos').insert(record).select().single();
      if (error) throw error;
      return jsonResponse(201, {
        id: data.id,
        cliente: data.cliente,
        montoPrestado: data.monto_prestado,
        interes: data.interes,
        tiempoPaga: data.tiempo_paga,
        frecuenciaPago: data.frecuencia_pago,
        numeroCuotas: data.numero_cuotas,
        fechaInicio: data.fecha_inicio,
        cronogramaPagos: data.cronograma_pagos,
        observaciones: data.observaciones,
        montoTotal: data.monto_total,
        cuota: data.cuota,
        estado: data.estado,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    }

    if (method === 'PUT' && id) {
      const payload = parseJsonBody(event.body);
      const updates = {
        cliente: payload.cliente,
        monto_prestado: payload.montoPrestado,
        interes: payload.interes,
        tiempo_paga: payload.tiempoPaga,
        frecuencia_pago: payload.frecuenciaPago,
        numero_cuotas: payload.numeroCuotas,
        fecha_inicio: payload.fechaInicio,
        cronograma_pagos: payload.cronogramaPagos,
        observaciones: payload.observaciones,
        monto_total: payload.montoTotal,
        cuota: payload.cuota,
        estado: payload.estado,
        updated_at: new Date().toISOString()
      };

      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) delete updates[key];
      });

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
