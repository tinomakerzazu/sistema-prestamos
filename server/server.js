const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'nk-data') : path.join(__dirname, 'data');
const UPLOAD_DIR = IS_VERCEL ? path.join('/tmp', 'nk-uploads') : path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, '..', 'sistema-corporacion-v2');
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'nk_session';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '8h';
const TRACKING_API_KEY = process.env.TRACKING_API_KEY || '';
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev-insecure-fallback';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET = (process.env.SUPABASE_BUCKET || 'comprobantes').trim() || 'comprobantes';
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
bootstrapSeedData();

const dataFiles = {
  clientes: path.join(DATA_DIR, 'clientes.json'),
  prestamos: path.join(DATA_DIR, 'prestamos.json'),
  pagos: path.join(DATA_DIR, 'pagos.json'),
  tracking: path.join(DATA_DIR, 'tracking.json'),
  cobranzas: path.join(DATA_DIR, 'cobranzas.json'),
  eventos: path.join(DATA_DIR, 'eventos.json'),
  users: path.join(DATA_DIR, 'users.json'),
  authLogs: path.join(DATA_DIR, 'auth-logs.json')
};

const requestMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  byRoute: {},
  byStatus: {}
};

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().optional().default('')
});

const createClienteSchema = z.object({
  dni: z.string().trim().min(6),
  nombres: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
  telefonoPrincipal: z.string().trim().min(7),
  direccion: z.string().optional().default(''),
  ocupacion: z.string().optional().default(''),
  ingresosMensuales: z.union([z.string(), z.number()]).optional(),
  observaciones: z.string().optional().default(''),
  fotoPerfil: z.string().optional().nullable(),
  fotoDocumento: z.string().optional().nullable(),
  ubicacion: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
    timestamp: z.string().optional()
  }).optional().nullable(),
  aval: z.object({
    nombre: z.string().optional().default(''),
    telefono: z.string().optional().default(''),
    relacion: z.string().optional().default('')
  }).optional().nullable()
});

const trackLocationSchema = z.object({
  clientId: z.string().trim().min(1),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  accuracy: z.coerce.number().optional(),
  timestamp: z.string().optional(),
  token: z.string().optional()
});

const sendSmsSchema = z.object({
  prestamoId: z.string().trim().min(1)
});

const cobranzaSchema = z.object({
  cliente: z.string().trim().min(1),
  saldo: z.coerce.number().nonnegative(),
  diasMora: z.coerce.number().int().nonnegative().optional().default(0),
  ultimaGestion: z.string().optional().default(''),
  estado: z.string().trim().min(1)
});

const eventoSchema = z.object({
  fecha: z.string().trim().min(1),
  cliente: z.string().optional().default(''),
  tipo: z.string().trim().min(1),
  prioridad: z.string().optional().default(''),
  detalle: z.string().optional().default(''),
  avisarAdmin: z.boolean().optional().default(true),
  avisarCliente: z.boolean().optional().default(false),
  avisoEnviadoCliente: z.boolean().optional().default(false)
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${makeId()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imagenes.'));
    }
    cb(null, true);
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtelo de nuevo más tarde.' }
});

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados envíos de SMS en poco tiempo.' }
});

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción.');
  }
  console.warn('[security] JWT_SECRET no está definido. Usando secreto temporal de desarrollo.');
}

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        connectSrc: ["'self'", 'http://localhost:3000', 'http://127.0.0.1:3000'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    }
  })
);
app.use((req, res, next) => {
  cors({
    credentials: true,
    origin: (origin, callback) => corsOriginHandler(origin, callback, req)
  })(req, res, next);
});
app.use(cookieParser());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(requestContextMiddleware);
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

// --- Endpoints públicos ---
app.get('/api/health', (req, res) => {
  const fsHealth = getDataDirHealth();
  const statusCode = fsHealth.ok ? 200 : 503;
  res.status(statusCode).json({
    ok: fsHealth.ok,
    timestamp: new Date().toISOString(),
    service: 'sistema-corporacion-server',
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    dataDir: fsHealth,
    supabase: HAS_SUPABASE ? { configured: true, url: redactUrl(SUPABASE_URL) } : { configured: false },
    metrics: {
      totalRequests: requestMetrics.totalRequests,
      totalErrors: requestMetrics.totalErrors
    }
  });
});

app.get('/api/metrics', requireAuth, (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    metrics: requestMetrics
  });
});

app.post('/api/auth/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  let users = readData(dataFiles.users);
  if (!users.length) {
    users = getDefaultUsers();
    writeData(dataFiles.users, users);
  }

  const allUsers = readData(dataFiles.users);
  const matched = allUsers.find(u => u.username === username);
  if (!matched) {
    appendAuditLog('auth.login.failed', { username, reason: 'user_not_found' });
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const passwordOk = await verifyPasswordAndMigrate(matched, password, allUsers);
  if (!passwordOk) {
    appendAuditLog('auth.login.failed', { username, reason: 'invalid_password' });
    return res.status(401).json({ error: 'Credenciales inválidas.' });
  }

  const tokenPayload = { userId: matched.id, username: matched.username, name: matched.name || 'Usuario' };
  const token = jwt.sign(tokenPayload, EFFECTIVE_JWT_SECRET, { expiresIn: JWT_EXPIRATION });
  setAuthCookie(res, token);

  appendAuditLog('auth.login.success', { username, userId: matched.id });
  res.json({ ok: true, name: matched.name || 'Usuario' });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.post('/api/auth/forgot-password', authLimiter, validateBody(forgotPasswordSchema), async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'jamesrojasdiaz01@gmail.com';
  const requestEmail = (req.body.email || '').trim() || '(no indicado)';
  let mailSent = false;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: adminEmail,
        subject: 'Norse Kredit - Solicitud de restablecimiento de contraseña',
        text: `El usuario ${requestEmail} ha solicitado restablecer su contraseña. Fecha: ${new Date().toISOString()}.`,
        html: `<p>El usuario <strong>${requestEmail}</strong> ha solicitado restablecer su contraseña.</p><p>Fecha: ${new Date().toLocaleString('es-PE')}.</p>`
      });
      mailSent = true;
    } catch (err) {
      logError('smtp.send.error', err);
    }
  }

  appendAuditLog('auth.forgot_password', { requestEmail, mailSent });
  res.json({
    ok: true,
    message: mailSent
      ? `Se ha enviado un correo a ${adminEmail} para restablecer tu contraseña.`
      : 'Solicitud registrada. Un administrador te contactará pronto.',
    mailSent
  });
});

// Endpoint para tracker móvil sin sesión (requiere key explícita).
app.post('/api/tracking', validateBody(trackLocationSchema), (req, res, next) => {
  if (isTrackingRequestAuthorized(req)) return next();
  return requireAuth(req, res, next);
}, (req, res) => {
  const { clientId, lat, lng } = req.body;
  const now = new Date().toISOString();

  if (HAS_SUPABASE) {
    return upsertTrackingSupabase({
      clientId,
      lat: normalizeNumber(lat),
      lng: normalizeNumber(lng),
      accuracy: normalizeNumber(req.body.accuracy),
      timestamp: req.body.timestamp || now,
      token: req.body.token || '',
      updatedAt: now
    })
      .then(payload => res.status(payload.__created ? 201 : 200).json(stripInternal(payload)))
      .catch(err => {
        logError('supabase.tracking.upsert.error', err);
        return res.status(500).json({ error: 'No se pudo registrar la ubicación.' });
      });
  }

  const items = readData(dataFiles.tracking);
  const index = items.findIndex(item => item.clientId === clientId);
  const payload = {
    id: index >= 0 ? items[index].id : makeId(),
    clientId,
    lat: normalizeNumber(lat),
    lng: normalizeNumber(lng),
    accuracy: normalizeNumber(req.body.accuracy),
    timestamp: req.body.timestamp || now,
    token: req.body.token || '',
    updatedAt: now
  };

  if (index >= 0) {
    items[index] = payload;
    writeData(dataFiles.tracking, items);
    return res.json(payload);
  }

  items.push(payload);
  writeData(dataFiles.tracking, items);
  return res.status(201).json(payload);
});

// Requiere sesión desde aquí en adelante.
app.use('/api', requireAuth);

app.get('/api/clientes', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json((data || []).map(mapClienteFromDb));
      })
      .catch(err => {
        logError('supabase.clientes.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar los clientes.' });
      });
  }

  res.json(readData(dataFiles.clientes));
});

app.post('/api/clientes', validateBody(createClienteSchema), (req, res) => {
  const now = new Date().toISOString();
  if (HAS_SUPABASE) {
    const record = mapClienteToDb({ id: makeId(), ...req.body, createdAt: now, updatedAt: now });
    return getSupabase()
      .from('clientes')
      .insert(record)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        res.status(201).json(mapClienteFromDb(data));
      })
      .catch(err => {
        logError('supabase.clientes.create.error', err);
        res.status(500).json({ error: 'No se pudo registrar el cliente.' });
      });
  }

  const clientes = readData(dataFiles.clientes);
  const nuevo = {
    id: makeId(),
    ...req.body,
    createdAt: now,
    updatedAt: now
  };
  clientes.push(nuevo);
  writeData(dataFiles.clientes, clientes);
  res.status(201).json(nuevo);
});

app.put('/api/clientes/:id', validateBody(createClienteSchema.partial()), (req, res) => {
  if (HAS_SUPABASE) {
    const updates = mapClienteToDb({ ...req.body, updatedAt: new Date().toISOString() });
    return getSupabase()
      .from('clientes')
      .update(removeUndefined(updates))
      .eq('id', req.params.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Cliente no encontrado.' });
        res.json(mapClienteFromDb(data));
      })
      .catch(err => {
        logError('supabase.clientes.update.error', err);
        res.status(500).json({ error: 'No se pudo actualizar el cliente.' });
      });
  }

  const clientes = readData(dataFiles.clientes);
  const index = clientes.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Cliente no encontrado.' });

  const updated = {
    ...clientes[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  clientes[index] = updated;
  writeData(dataFiles.clientes, clientes);
  res.json(updated);
});

app.delete('/api/clientes/:id', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('clientes')
      .delete()
      .eq('id', req.params.id)
      .then(({ error }) => {
        if (error) throw error;
        res.json({ ok: true });
      })
      .catch(err => {
        logError('supabase.clientes.delete.error', err);
        res.status(500).json({ error: 'No se pudo eliminar el cliente.' });
      });
  }

  const clientes = readData(dataFiles.clientes);
  const updated = clientes.filter(item => item.id !== req.params.id);
  writeData(dataFiles.clientes, updated);
  res.json({ ok: true });
});

app.get('/api/prestamos', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('prestamos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json((data || []).map(mapPrestamoFromDb));
      })
      .catch(err => {
        logError('supabase.prestamos.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar los prestamos.' });
      });
  }

  res.json(readData(dataFiles.prestamos));
});

app.post('/api/prestamos', validateBody(z.object({
  clienteId: z.string().trim().min(1).optional(),
  cliente: z.string().trim().optional(),
  montoPrestado: z.coerce.number().nonnegative(),
  interes: z.coerce.number().min(0).max(1000).optional().default(0),
  tiempoPaga: z.string().trim().optional().default(''),
  frecuenciaPago: z.string().trim().optional().default(''),
  numeroCuotas: z.coerce.number().int().nonnegative().optional().default(0),
  fechaInicio: z.string().trim().optional().default(''),
  cronogramaPagos: z.array(z.object({
    numero: z.coerce.number().int().positive(),
    fecha: z.string().trim(),
    monto: z.coerce.number().nonnegative(),
    estado: z.string().trim().optional().default('Pendiente')
  })).optional().default([]),
  observaciones: z.string().optional().default(''),
  montoTotal: z.coerce.number().nonnegative().optional(),
  cuota: z.coerce.number().nonnegative().optional(),
  estado: z.string().trim().optional().default('activo')
})), (req, res) => {
  const now = new Date().toISOString();
  if (HAS_SUPABASE) {
    const record = mapPrestamoToDb({ id: makeId(), ...req.body, createdAt: now, updatedAt: now });
    return getSupabase()
      .from('prestamos')
      .insert(record)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        res.status(201).json(mapPrestamoFromDb(data));
      })
      .catch(err => {
        logError('supabase.prestamos.create.error', err);
        res.status(500).json({ error: 'No se pudo registrar el prestamo.' });
      });
  }

  const prestamos = readData(dataFiles.prestamos);
  const nuevo = {
    id: makeId(),
    ...req.body,
    createdAt: now,
    updatedAt: now
  };
  prestamos.push(nuevo);
  writeData(dataFiles.prestamos, prestamos);
  res.status(201).json(nuevo);
});

app.put('/api/prestamos/:id', validateBody(z.object({
  clienteId: z.string().trim().optional(),
  cliente: z.string().trim().optional(),
  montoPrestado: z.coerce.number().nonnegative().optional(),
  interes: z.coerce.number().min(0).max(1000).optional(),
  tiempoPaga: z.string().optional(),
  frecuenciaPago: z.string().optional(),
  numeroCuotas: z.coerce.number().int().nonnegative().optional(),
  fechaInicio: z.string().optional(),
  cronogramaPagos: z.array(z.object({
    numero: z.coerce.number().int().positive(),
    fecha: z.string().trim(),
    monto: z.coerce.number().nonnegative(),
    estado: z.string().optional()
  })).optional(),
  observaciones: z.string().optional(),
  montoTotal: z.coerce.number().nonnegative().optional(),
  cuota: z.coerce.number().nonnegative().optional(),
  estado: z.string().optional()
}).partial()), (req, res) => {
  if (HAS_SUPABASE) {
    const updates = mapPrestamoToDb({ ...req.body, updatedAt: new Date().toISOString() });
    return getSupabase()
      .from('prestamos')
      .update(removeUndefined(updates))
      .eq('id', req.params.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Prestamo no encontrado.' });
        res.json(mapPrestamoFromDb(data));
      })
      .catch(err => {
        logError('supabase.prestamos.update.error', err);
        res.status(500).json({ error: 'No se pudo actualizar el prestamo.' });
      });
  }

  const prestamos = readData(dataFiles.prestamos);
  const index = prestamos.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Prestamo no encontrado.' });

  const updated = {
    ...prestamos[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  prestamos[index] = updated;
  writeData(dataFiles.prestamos, prestamos);
  res.json(updated);
});

app.delete('/api/prestamos/:id', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('prestamos')
      .delete()
      .eq('id', req.params.id)
      .then(({ error }) => {
        if (error) throw error;
        res.json({ ok: true });
      })
      .catch(err => {
        logError('supabase.prestamos.delete.error', err);
        res.status(500).json({ error: 'No se pudo eliminar el prestamo.' });
      });
  }

  const prestamos = readData(dataFiles.prestamos);
  const updated = prestamos.filter(item => item.id !== req.params.id);
  writeData(dataFiles.prestamos, updated);
  res.json({ ok: true });
});

app.post('/api/recordatorios/enviar', smsLimiter, validateBody(sendSmsSchema), (req, res) => {
  const { prestamoId } = req.body;
  if (HAS_SUPABASE) {
    return Promise.all([
      getSupabase().from('prestamos').select('*').eq('id', prestamoId).maybeSingle(),
    ])
      .then(async ([prestamoResult]) => {
        if (prestamoResult.error) throw prestamoResult.error;
        const prestamoDb = prestamoResult.data;
        if (!prestamoDb) {
          return res.status(404).json({ error: 'Prestamo no encontrado.' });
        }

        const prestamo = mapPrestamoFromDb(prestamoDb);
        const clienteId = prestamo.clienteId;
        if (!clienteId) {
          return res.status(400).json({ error: 'El prestamo no tiene clienteId asociado. Agregue la columna cliente_id en Supabase.' });
        }

        const clienteResult = await getSupabase().from('clientes').select('*').eq('id', clienteId).maybeSingle();
        if (clienteResult.error) throw clienteResult.error;
        const clienteDb = clienteResult.data;
        if (!clienteDb) {
          return res.status(400).json({ error: 'Cliente no encontrado para este prestamo.' });
        }

        const cliente = mapClienteFromDb(clienteDb);
        return { prestamo, cliente };
      })
      .then(({ prestamo, cliente }) => {
        const telefono = (cliente.telefonoPrincipal || '').trim().replace(/\D/g, '');
        if (!telefono || telefono.length < 9) {
          return res.status(400).json({ error: 'El cliente no tiene un numero de telefono valido.' });
        }

        return sendTwilioSms({ req, res, prestamo, cliente, telefono });
      })
      .catch(err => {
        logError('supabase.sms.reminder.error', err);
        return res.status(500).json({ error: 'No se pudo enviar el SMS.' });
      });
  }

  const prestamos = readData(dataFiles.prestamos);
  const clientes = readData(dataFiles.clientes);
  const prestamo = prestamos.find(p => p.id === prestamoId);
  if (!prestamo) {
    return res.status(404).json({ error: 'Prestamo no encontrado.' });
  }

  const clienteId = prestamo.clienteId || prestamo.cliente;
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) {
    return res.status(400).json({ error: 'Cliente no encontrado para este prestamo.' });
  }

  const telefono = (cliente.telefonoPrincipal || cliente.telefono || '').trim().replace(/\D/g, '');
  if (!telefono || telefono.length < 9) {
    return res.status(400).json({ error: 'El cliente no tiene un numero de telefono valido.' });
  }

  const cronograma = prestamo.cronogramaPagos || [];
  const proximaCuota = cronograma.find(c => (c.estado || '').toLowerCase() === 'pendiente');
  const montoCuota = proximaCuota ? Number(proximaCuota.monto) : Number(prestamo.cuota) || 0;
  const fechaCuota = proximaCuota && proximaCuota.fecha ? proximaCuota.fecha : '';
  const nombreCliente = (prestamo.cliente || cliente.nombres || 'Cliente').split(' ')[0];
  let mensaje = `NORSE KREDIT: Hola ${nombreCliente}, tiene un pago pendiente de S/ ${montoCuota.toFixed(2)}.`;
  if (fechaCuota) mensaje += ` Fecha: ${fechaCuota}.`;
  mensaje += ' Gracias.';

  return sendTwilioSms({ req, res, prestamo, cliente, telefono, mensaje, clienteId });
});

app.get('/api/pagos', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('pagos')
      .select('*')
      .order('fecha', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json((data || []).map(mapPagoFromDb));
      })
      .catch(err => {
        logError('supabase.pagos.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar los pagos.' });
      });
  }

  res.json(readData(dataFiles.pagos));
});

app.get('/api/tracking', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('tracking')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json((data || []).map(mapTrackingFromDb));
      })
      .catch(err => {
        logError('supabase.tracking.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar las ubicaciones.' });
      });
  }

  res.json(readData(dataFiles.tracking));
});

app.post(
  '/api/pagos',
  (req, res, next) => {
    const isJson = req.is('application/json');
    if (isJson) return next();
    return upload.single('comprobante')(req, res, next);
  },
  validateBody(z.object({
    cliente: z.string().trim().min(1),
    clienteId: z.string().trim().nullable().optional(),
    monto: z.coerce.number().positive(),
    fecha: z.string().trim().min(1),
    metodo: z.string().trim().min(1),
    referencia: z.string().optional().default(''),
    estado: z.string().optional().default('Registrado'),
    nota: z.string().optional().default(''),
    comprobanteBase64: z.string().optional(),
    comprobanteName: z.string().optional()
  }).passthrough()),
  async (req, res) => {
    const { cliente, monto, fecha, metodo } = req.body || {};
    if (!cliente || !monto || !fecha || !metodo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const now = new Date().toISOString();
    const nuevo = {
      id: makeId(),
      cliente: req.body.cliente,
      clienteId: req.body.clienteId || null,
      monto: normalizeNumber(req.body.monto),
      fecha: req.body.fecha,
      metodo: req.body.metodo,
      referencia: req.body.referencia || '',
      estado: req.body.estado || 'Registrado',
      nota: req.body.nota || '',
      createdAt: now,
      updatedAt: now
    };

    if (HAS_SUPABASE) {
      try {
        if (nuevo.clienteId) {
          const { data: exists, error: existsError } = await getSupabase()
            .from('clientes')
            .select('id')
            .eq('id', nuevo.clienteId)
            .maybeSingle();
          if (existsError) throw existsError;
          if (!exists) {
            return res.status(400).json({ error: 'clienteId no corresponde a un cliente existente.' });
          }
        }

        let comprobanteUrl = null;
        let comprobanteName = null;
        let storagePath = null;

        if (req.file) {
          const buf = fs.readFileSync(req.file.path);
          storagePath = `pagos/${Date.now()}-${makeId()}${path.extname(req.file.originalname) || '.jpg'}`;
          const { error: uploadError } = await getSupabase().storage
            .from(SUPABASE_BUCKET)
            .upload(storagePath, buf, { contentType: req.file.mimetype, upsert: false });
          if (uploadError) throw uploadError;
          comprobanteName = req.file.originalname || path.basename(storagePath);
        } else if (req.body?.comprobanteBase64) {
          const parsed = parseDataUrl(req.body.comprobanteBase64);
          if (!parsed) {
            return res.status(400).json({ error: 'Comprobante invalido.' });
          }
          const ext = (req.body.comprobanteName || '').includes('.')
            ? `.${String(req.body.comprobanteName).split('.').pop()}`
            : getExtensionFromType(parsed.contentType);
          storagePath = `pagos/${Date.now()}-${makeId()}${ext}`;
          const { error: uploadError } = await getSupabase().storage
            .from(SUPABASE_BUCKET)
            .upload(storagePath, parsed.buffer, { contentType: parsed.contentType, upsert: false });
          if (uploadError) throw uploadError;
          comprobanteName = req.body.comprobanteName || path.basename(storagePath);
        }

        if (storagePath) {
          const { data: publicData } = getSupabase().storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
          comprobanteUrl = publicData?.publicUrl || null;
        }

        if (req.file?.path) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
        }

        const record = mapPagoToDb({
          ...nuevo,
          comprobante: comprobanteUrl ? { url: comprobanteUrl, name: comprobanteName || '' } : null
        });
        const { data, error } = await getSupabase().from('pagos').insert(record).select().single();
        if (error) throw error;
        return res.status(201).json(mapPagoFromDb(data));
      } catch (err) {
        logError('supabase.pagos.create.error', err);
        return res.status(500).json({ error: 'No se pudo registrar el pago.' });
      }
    }

    const pagos = readData(dataFiles.pagos);
    const clientes = readData(dataFiles.clientes);

    if (nuevo.clienteId && !clientes.some(c => c.id === nuevo.clienteId)) {
      return res.status(400).json({ error: 'clienteId no corresponde a un cliente existente.' });
    }

    if (req.file) {
      nuevo.comprobante = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mime: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
      };
    } else if (req.body?.comprobanteBase64) {
      try {
        const base64 = req.body.comprobanteBase64;
        const ext = (req.body.comprobanteName || '').match(/\.(jpe?g|png|webp|gif)$/i)
          ? path.extname(req.body.comprobanteName)
          : '.jpg';
        const fileName = `${Date.now()}-${makeId()}${ext}`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        fs.writeFileSync(filePath, buf);
        nuevo.comprobante = {
          fileName,
          originalName: req.body.comprobanteName || 'comprobante.jpg',
          mime: base64.match(/^data:([^;]+)/)?.[1] || 'image/jpeg',
          size: buf.length,
          url: `/uploads/${fileName}`
        };
      } catch (err) {
        logError('payment.receipt.write.error', err);
      }
    }

    pagos.push(nuevo);
    writeData(dataFiles.pagos, pagos);
    appendAuditLog('payment.created', {
      paymentId: nuevo.id,
      clienteId: nuevo.clienteId || null,
      userId: req.user?.userId || null
    });
    return res.status(201).json(nuevo);
  }
);

app.put('/api/pagos/:id', validateBody(z.object({
  cliente: z.string().optional(),
  clienteId: z.string().nullable().optional(),
  monto: z.coerce.number().positive().optional(),
  fecha: z.string().optional(),
  metodo: z.string().optional(),
  referencia: z.string().optional(),
  estado: z.string().optional(),
  nota: z.string().optional()
}).partial()), (req, res) => {
  if (HAS_SUPABASE) {
    const updates = mapPagoToDb({ ...req.body, updatedAt: new Date().toISOString() });
    return getSupabase()
      .from('pagos')
      .update(removeUndefined(updates))
      .eq('id', req.params.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pago no encontrado.' });
        res.json(mapPagoFromDb(data));
      })
      .catch(err => {
        logError('supabase.pagos.update.error', err);
        res.status(500).json({ error: 'No se pudo actualizar el pago.' });
      });
  }

  const pagos = readData(dataFiles.pagos);
  const index = pagos.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Pago no encontrado.' });

  const updated = {
    ...pagos[index],
    ...req.body,
    monto: req.body.monto !== undefined ? normalizeNumber(req.body.monto) : pagos[index].monto,
    updatedAt: new Date().toISOString()
  };
  pagos[index] = updated;
  writeData(dataFiles.pagos, pagos);
  res.json(updated);
});

app.delete('/api/pagos/:id', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('pagos')
      .select('comprobante_url,comprobante_name')
      .eq('id', req.params.id)
      .maybeSingle()
      .then(async ({ data: existing, error: fetchError }) => {
        if (fetchError) throw fetchError;
        if (!existing) return res.status(404).json({ error: 'Pago no encontrado.' });

        if (existing.comprobante_url) {
          const storagePath = deriveStoragePathFromPublicUrl(existing.comprobante_url);
          if (storagePath) {
            await getSupabase().storage.from(SUPABASE_BUCKET).remove([storagePath]);
          }
        }

        const { error } = await getSupabase().from('pagos').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ ok: true });
      })
      .catch(err => {
        logError('supabase.pagos.delete.error', err);
        res.status(500).json({ error: 'No se pudo eliminar el pago.' });
      });
  }

  const pagos = readData(dataFiles.pagos);
  const pago = pagos.find(item => item.id === req.params.id);
  const updated = pagos.filter(item => item.id !== req.params.id);
  writeData(dataFiles.pagos, updated);

  if (pago?.comprobante?.fileName) {
    const filePath = path.join(UPLOAD_DIR, pago.comprobante.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  res.json({ ok: true });
});

app.get('/api/cobranzas', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('cobranzas')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json(data || []);
      })
      .catch(err => {
        logError('supabase.cobranzas.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar las cobranzas.' });
      });
  }

  res.json(readData(dataFiles.cobranzas));
});

app.post('/api/cobranzas', validateBody(cobranzaSchema), (req, res) => {
  const now = new Date().toISOString();
  if (HAS_SUPABASE) {
    const record = {
      id: makeId(),
      cliente: req.body.cliente,
      saldo: normalizeNumber(req.body.saldo),
      dias_mora: parseInt(req.body.diasMora, 10) || 0,
      ultima_gestion: req.body.ultimaGestion || '',
      estado: req.body.estado || 'Pendiente',
      created_at: now,
      updated_at: now
    };
    return getSupabase()
      .from('cobranzas')
      .insert(record)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        res.status(201).json(data);
      })
      .catch(err => {
        logError('supabase.cobranzas.create.error', err);
        res.status(500).json({ error: 'No se pudo registrar la cobranza.' });
      });
  }

  const cobranzas = readData(dataFiles.cobranzas);
  const nuevo = {
    id: makeId(),
    ...req.body,
    saldo: normalizeNumber(req.body.saldo),
    diasMora: parseInt(req.body.diasMora, 10) || 0,
    createdAt: now,
    updatedAt: now
  };
  cobranzas.push(nuevo);
  writeData(dataFiles.cobranzas, cobranzas);
  res.status(201).json(nuevo);
});

app.put('/api/cobranzas/:id', validateBody(cobranzaSchema.partial()), (req, res) => {
  if (HAS_SUPABASE) {
    const updates = {
      cliente: req.body.cliente,
      saldo: req.body.saldo !== undefined ? normalizeNumber(req.body.saldo) : undefined,
      dias_mora: req.body.diasMora !== undefined ? parseInt(req.body.diasMora, 10) || 0 : undefined,
      ultima_gestion: req.body.ultimaGestion,
      estado: req.body.estado,
      updated_at: new Date().toISOString()
    };
    return getSupabase()
      .from('cobranzas')
      .update(removeUndefined(updates))
      .eq('id', req.params.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Cobranza no encontrada.' });
        res.json(data);
      })
      .catch(err => {
        logError('supabase.cobranzas.update.error', err);
        res.status(500).json({ error: 'No se pudo actualizar la cobranza.' });
      });
  }

  const cobranzas = readData(dataFiles.cobranzas);
  const index = cobranzas.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Cobranza no encontrada.' });
  cobranzas[index] = { ...cobranzas[index], ...req.body, updatedAt: new Date().toISOString() };
  writeData(dataFiles.cobranzas, cobranzas);
  res.json(cobranzas[index]);
});

app.delete('/api/cobranzas/:id', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('cobranzas')
      .delete()
      .eq('id', req.params.id)
      .then(({ error }) => {
        if (error) throw error;
        res.json({ ok: true });
      })
      .catch(err => {
        logError('supabase.cobranzas.delete.error', err);
        res.status(500).json({ error: 'No se pudo eliminar la cobranza.' });
      });
  }

  const cobranzas = readData(dataFiles.cobranzas);
  const exists = cobranzas.some(item => item.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Cobranza no encontrada.' });
  writeData(dataFiles.cobranzas, cobranzas.filter(item => item.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/eventos', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('eventos')
      .select('*')
      .order('fecha', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        res.json((data || []).map(mapEventoFromDb));
      })
      .catch(err => {
        logError('supabase.eventos.list.error', err);
        res.status(500).json({ error: 'No se pudieron cargar los eventos.' });
      });
  }

  res.json(readData(dataFiles.eventos));
});

app.post('/api/eventos', validateBody(eventoSchema), (req, res) => {
  const now = new Date().toISOString();
  if (HAS_SUPABASE) {
    const record = mapEventoToDb({
      id: makeId(),
      ...req.body,
      avisoEnviadoCliente: req.body.avisarCliente === true ? false : undefined,
      createdAt: now,
      updatedAt: now
    });
    return getSupabase()
      .from('eventos')
      .insert(record)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        res.status(201).json(mapEventoFromDb(data));
      })
      .catch(err => {
        logError('supabase.eventos.create.error', err);
        res.status(500).json({ error: 'No se pudo registrar el evento.' });
      });
  }

  const eventos = readData(dataFiles.eventos);
  const nuevo = {
    id: makeId(),
    ...req.body,
    avisoEnviadoCliente: req.body.avisarCliente === true ? false : undefined,
    createdAt: now,
    updatedAt: now
  };
  eventos.push(nuevo);
  writeData(dataFiles.eventos, eventos);
  res.status(201).json(nuevo);
});

app.put('/api/eventos/:id', validateBody(eventoSchema.partial()), (req, res) => {
  if (HAS_SUPABASE) {
    const updates = mapEventoToDb({ ...req.body, updatedAt: new Date().toISOString() });
    return getSupabase()
      .from('eventos')
      .update(removeUndefined(updates))
      .eq('id', req.params.id)
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Evento no encontrado.' });
        res.json(mapEventoFromDb(data));
      })
      .catch(err => {
        logError('supabase.eventos.update.error', err);
        res.status(500).json({ error: 'No se pudo actualizar el evento.' });
      });
  }

  const eventos = readData(dataFiles.eventos);
  const index = eventos.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Evento no encontrado.' });
  eventos[index] = { ...eventos[index], ...req.body, updatedAt: new Date().toISOString() };
  writeData(dataFiles.eventos, eventos);
  res.json(eventos[index]);
});

app.delete('/api/eventos/:id', (req, res) => {
  if (HAS_SUPABASE) {
    return getSupabase()
      .from('eventos')
      .delete()
      .eq('id', req.params.id)
      .then(({ error }) => {
        if (error) throw error;
        res.json({ ok: true });
      })
      .catch(err => {
        logError('supabase.eventos.delete.error', err);
        res.status(500).json({ error: 'No se pudo eliminar el evento.' });
      });
  }

  const eventos = readData(dataFiles.eventos);
  const exists = eventos.some(item => item.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Evento no encontrado.' });
  writeData(dataFiles.eventos, eventos.filter(item => item.id !== req.params.id));
  res.json({ ok: true });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, _next) => {
  requestMetrics.totalErrors += 1;
  logError('api.unhandled_error', err, { requestId: req.requestId });
  const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  res.status(statusCode).json({ error: err.message || 'Error en el servidor.' });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor listo en http://localhost:${PORT}`);
  });
}

function requestContextMiddleware(req, res, next) {
  req.requestId = crypto.randomUUID ? crypto.randomUUID() : makeId();
  const startedAt = Date.now();
  requestMetrics.totalRequests += 1;

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const routeKey = `${req.method} ${req.path}`;
    requestMetrics.byRoute[routeKey] = (requestMetrics.byRoute[routeKey] || 0) + 1;
    requestMetrics.byStatus[String(res.statusCode)] = (requestMetrics.byStatus[String(res.statusCode)] || 0) + 1;

    if (res.statusCode >= 500) requestMetrics.totalErrors += 1;

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'http.request.completed',
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip
      })
    );
  });

  next();
}

function corsOriginHandler(origin, callback, req) {
  const allowedOrigins = parseAllowedOrigins();
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  // Mismo host que la API (Vercel, dominio propio, preview): Origin y Host deben coincidir.
  if (req) {
    try {
      const host = String(req.headers.host || '')
        .split(':')[0]
        .toLowerCase();
      const originHost = new URL(origin).hostname.toLowerCase();
      if (host && originHost === host) {
        return callback(null, true);
      }
    } catch (_) {}
  }

  // Despliegues y previews en vercel.app
  if (process.env.VERCEL && /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin)) {
    return callback(null, true);
  }

  if (!allowedOrigins.length && process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }
  return callback(new Error('Origen no permitido por CORS.'));
}

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  const list = raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  // Vercel inyecta VERCEL_URL (sin protocolo). Sin esto, en prod CORS rechaza el propio frontend.
  const vercelUrl = (process.env.VERCEL_URL || '').trim();
  if (vercelUrl) {
    list.push(`https://${vercelUrl}`);
  }

  return [...new Set(list)];
}

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos inválidos.',
        details: parsed.error.issues.map(issue => issue.path.join('.') || issue.message)
      });
    }
    req.body = parsed.data;
    return next();
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
}

function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Sesión requerida.' });
  }

  try {
    req.user = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

function isTrackingRequestAuthorized(req) {
  if (!TRACKING_API_KEY) return false;
  const headerKey = req.headers['x-tracking-key'];
  const bodyToken = req.body?.token;
  return headerKey === TRACKING_API_KEY || bodyToken === TRACKING_API_KEY;
}

function getDefaultUsers() {
  const fromEnv = process.env.AUTH_INIT_USERS;
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv);
      return parsed.map(user => normalizeUserForStorage(user));
    } catch (_) {}
  }

  return [
    normalizeUserForStorage({ id: makeId(), username: 'admin', password: '123', name: 'Admin' }),
    normalizeUserForStorage({ id: makeId(), username: 'jairo@corp.prestamos.com', password: '011029', name: 'Jairo' }),
    normalizeUserForStorage({
      id: makeId(),
      username: 'jairogonzales@corp.com',
      name: 'Jairo Gonzales',
      passwordHash: '$2a$10$ZBigYUc2x9ZyuBz/eu3NMO7UqZ3vX79EYl/SviA.8NrndXncPIu86'
    })
  ];
}

function normalizeUserForStorage(user) {
  const id = user.id || makeId();
  const username = String(user.username || '').trim();
  const name = String(user.name || username || 'Usuario').trim();
  if (user.passwordHash) {
    return { id, username, name, passwordHash: user.passwordHash };
  }
  const password = String(user.password || '');
  return { id, username, name, passwordHash: bcrypt.hashSync(password, 10) };
}

async function verifyPasswordAndMigrate(user, plainPassword, allUsers) {
  if (user.passwordHash) {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }

  if (user.password && user.password === plainPassword) {
    user.passwordHash = await bcrypt.hash(plainPassword, 10);
    delete user.password;
    writeData(dataFiles.users, allUsers);
    return true;
  }

  return false;
}

function appendAuditLog(event, payload = {}) {
  const logs = readData(dataFiles.authLogs);
  logs.push({
    id: makeId(),
    event,
    timestamp: new Date().toISOString(),
    ...payload
  });
  writeData(dataFiles.authLogs, logs.slice(-1000));
}

function getDataDirHealth() {
  const result = { ok: true, read: true, write: true };
  try {
    const sanity = readData(dataFiles.users);
    if (!Array.isArray(sanity)) result.read = false;
  } catch (_) {
    result.read = false;
  }

  try {
    const probePath = path.join(DATA_DIR, '.health-check.tmp');
    fs.writeFileSync(probePath, JSON.stringify({ at: Date.now() }), 'utf8');
    fs.unlinkSync(probePath);
  } catch (_) {
    result.write = false;
  }

  result.ok = result.read && result.write;
  return result;
}

function logError(event, err, extra = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      message: err?.message || 'Unknown error',
      stack: err?.stack,
      ...extra
    })
  );
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function bootstrapSeedData() {
  if (!IS_VERCEL) return;
  const sourceDir = path.join(__dirname, 'data');
  if (!fs.existsSync(sourceDir)) return;
  const fileNames = ['clientes.json', 'prestamos.json', 'pagos.json', 'tracking.json', 'cobranzas.json', 'eventos.json', 'users.json', 'auth-logs.json'];
  fileNames.forEach(fileName => {
    const source = path.join(sourceDir, fileName);
    const target = path.join(DATA_DIR, fileName);
    if (fs.existsSync(target)) return;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, target);
    } else {
      fs.writeFileSync(target, '[]', 'utf8');
    }
  });
}

function readData(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (_) {
    return [];
  }
}

function writeData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

let supabaseClientSingleton = null;
function getSupabase() {
  if (!HAS_SUPABASE) {
    throw new Error('Supabase no configurado.');
  }
  if (!supabaseClientSingleton) {
    supabaseClientSingleton = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabaseClientSingleton;
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch (_) {
    return 'configured';
  }
}

function removeUndefined(obj) {
  const copy = { ...(obj || {}) };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined) delete copy[key];
  });
  return copy;
}

function parseDataUrl(dataUrl) {
  if (!dataUrl) return null;
  if (typeof dataUrl !== 'string') return null;
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) return null;
    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], 'base64')
    };
  }
  return {
    contentType: 'application/octet-stream',
    buffer: Buffer.from(dataUrl, 'base64')
  };
}

function getExtensionFromType(contentType) {
  if (!contentType) return '.bin';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  return '.bin';
}

function deriveStoragePathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;
  try {
    const u = new URL(publicUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    const objectIndex = parts.indexOf('object');
    if (objectIndex === -1) return null;
    const signIndex = parts.indexOf('sign');
    const publicIndex = parts.indexOf('public');
    const start = signIndex !== -1 ? signIndex + 2 : publicIndex !== -1 ? publicIndex + 2 : null;
    if (!start) return null;
    const bucket = parts[start - 1];
    if (bucket !== SUPABASE_BUCKET) return null;
    return parts.slice(start).join('/');
  } catch (_) {
    return null;
  }
}

function stripInternal(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = { ...payload };
  delete copy.__created;
  return copy;
}

function mapClienteToDb(cliente) {
  if (!cliente) return {};
  return removeUndefined({
    id: cliente.id,
    dni: cliente.dni,
    nombres: cliente.nombres,
    apellidos: cliente.apellidos,
    telefono_principal: cliente.telefonoPrincipal,
    direccion: cliente.direccion,
    ocupacion: cliente.ocupacion,
    ingresos_mensuales: cliente.ingresosMensuales !== undefined && cliente.ingresosMensuales !== '' ? Number(cliente.ingresosMensuales) : cliente.ingresosMensuales,
    observaciones: cliente.observaciones,
    foto_perfil: cliente.fotoPerfil,
    foto_documento: cliente.fotoDocumento,
    ubicacion: cliente.ubicacion ?? null,
    aval: cliente.aval ?? null,
    created_at: cliente.createdAt,
    updated_at: cliente.updatedAt
  });
}

function mapClienteFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    dni: row.dni,
    nombres: row.nombres,
    apellidos: row.apellidos,
    telefonoPrincipal: row.telefono_principal,
    direccion: row.direccion || '',
    ocupacion: row.ocupacion || '',
    ingresosMensuales: row.ingresos_mensuales,
    observaciones: row.observaciones || '',
    fotoPerfil: row.foto_perfil,
    fotoDocumento: row.foto_documento,
    ubicacion: row.ubicacion ?? null,
    aval: row.aval ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPrestamoToDb(prestamo) {
  if (!prestamo) return {};
  return removeUndefined({
    id: prestamo.id,
    cliente_id: prestamo.clienteId,
    cliente: prestamo.cliente || '',
    monto_prestado: prestamo.montoPrestado,
    interes: prestamo.interes,
    tiempo_paga: prestamo.tiempoPaga,
    frecuencia_pago: prestamo.frecuenciaPago,
    numero_cuotas: prestamo.numeroCuotas,
    fecha_inicio: prestamo.fechaInicio || null,
    cronograma_pagos: prestamo.cronogramaPagos ?? null,
    observaciones: prestamo.observaciones || '',
    monto_total: prestamo.montoTotal,
    cuota: prestamo.cuota,
    estado: prestamo.estado,
    created_at: prestamo.createdAt,
    updated_at: prestamo.updatedAt
  });
}

function mapPrestamoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    clienteId: row.cliente_id,
    cliente: row.cliente,
    montoPrestado: row.monto_prestado,
    interes: row.interes,
    tiempoPaga: row.tiempo_paga,
    frecuenciaPago: row.frecuencia_pago,
    numeroCuotas: row.numero_cuotas,
    fechaInicio: row.fecha_inicio,
    cronogramaPagos: row.cronograma_pagos || [],
    observaciones: row.observaciones || '',
    montoTotal: row.monto_total,
    cuota: row.cuota,
    estado: row.estado,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPagoToDb(pago) {
  if (!pago) return {};
  return removeUndefined({
    id: pago.id,
    cliente: pago.cliente,
    cliente_id: pago.clienteId,
    monto: pago.monto,
    fecha: pago.fecha,
    metodo: pago.metodo,
    referencia: pago.referencia,
    estado: pago.estado,
    nota: pago.nota,
    comprobante_url: pago.comprobante?.url || null,
    comprobante_name: pago.comprobante?.name || null,
    created_at: pago.createdAt,
    updated_at: pago.updatedAt
  });
}

function mapPagoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    cliente: row.cliente,
    clienteId: row.cliente_id,
    monto: row.monto,
    fecha: row.fecha,
    metodo: row.metodo,
    referencia: row.referencia || '',
    estado: row.estado || 'Registrado',
    nota: row.nota || '',
    comprobante: row.comprobante_url
      ? { url: row.comprobante_url, name: row.comprobante_name || '' }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEventoToDb(evento) {
  if (!evento) return {};
  return removeUndefined({
    id: evento.id,
    fecha: evento.fecha || null,
    cliente: evento.cliente || '',
    tipo: evento.tipo,
    detalle: evento.detalle || '',
    prioridad: evento.prioridad || 'Media',
    avisar_admin: evento.avisarAdmin,
    avisar_cliente: evento.avisarCliente,
    aviso_enviado_cliente: evento.avisoEnviadoCliente,
    created_at: evento.createdAt,
    updated_at: evento.updatedAt
  });
}

function mapEventoFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    fecha: row.fecha,
    cliente: row.cliente || '',
    tipo: row.tipo,
    detalle: row.detalle || '',
    prioridad: row.prioridad || 'Media',
    avisarAdmin: row.avisar_admin,
    avisarCliente: row.avisar_cliente,
    avisoEnviadoCliente: row.aviso_enviado_cliente,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTrackingFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: row.accuracy !== null && row.accuracy !== undefined ? Number(row.accuracy) : undefined,
    timestamp: row.timestamp || row.updated_at,
    token: row.token || '',
    updatedAt: row.updated_at
  };
}

async function upsertTrackingSupabase(payload) {
  const existing = await getSupabase()
    .from('tracking')
    .select('id')
    .eq('client_id', payload.clientId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const record = {
    id: existing.data?.id || payload.id || makeId(),
    client_id: payload.clientId,
    lat: payload.lat,
    lng: payload.lng,
    accuracy: payload.accuracy ?? null,
    timestamp: payload.timestamp || null,
    token: payload.token || '',
    updated_at: payload.updatedAt || new Date().toISOString()
  };

  if (existing.data?.id) {
    const updated = await getSupabase()
      .from('tracking')
      .update(record)
      .eq('id', existing.data.id)
      .select()
      .single();
    if (updated.error) throw updated.error;
    return { ...mapTrackingFromDb(updated.data), __created: false };
  }

  const inserted = await getSupabase().from('tracking').insert(record).select().single();
  if (inserted.error) throw inserted.error;
  return { ...mapTrackingFromDb(inserted.data), __created: true };
}

function buildSmsMessage({ prestamo, cliente }) {
  const cronograma = prestamo.cronogramaPagos || [];
  const proximaCuota = cronograma.find(c => (c.estado || '').toLowerCase() === 'pendiente');
  const montoCuota = proximaCuota ? Number(proximaCuota.monto) : Number(prestamo.cuota) || 0;
  const fechaCuota = proximaCuota && proximaCuota.fecha ? proximaCuota.fecha : '';
  const nombreCliente = (prestamo.cliente || cliente.nombres || 'Cliente').split(' ')[0];
  let mensaje = `NORSE KREDIT: Hola ${nombreCliente}, tiene un pago pendiente de S/ ${montoCuota.toFixed(2)}.`;
  if (fechaCuota) mensaje += ` Fecha: ${fechaCuota}.`;
  mensaje += ' Gracias.';
  return mensaje;
}

function sendTwilioSms({ res, prestamo, cliente, telefono, mensaje, clienteId }) {
  const message = mensaje || buildSmsMessage({ prestamo, cliente });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE;
  if (!accountSid || !authToken || !fromPhone) {
    return res.status(503).json({
      error: 'SMS no configurado. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_PHONE.',
      configured: false,
      preview: { to: telefono, message }
    });
  }

  const toPhone = telefono.length <= 9 ? `+51${telefono}` : telefono.startsWith('+') ? telefono : `+${telefono}`;
  const twilio = require('twilio')(accountSid, authToken);

  return twilio.messages
    .create({ body: message, from: fromPhone, to: toPhone })
    .then(() => {
      appendAuditLog('sms.reminder.sent', { prestamoId: prestamo.id, clienteId: clienteId || prestamo.clienteId || null, toPhone });
      res.json({ ok: true, message: 'SMS enviado correctamente.' });
    })
    .catch(err => {
      logError('twilio.send.error', err);
      res.status(500).json({ error: err.message || 'Error al enviar SMS.' });
    });
}
