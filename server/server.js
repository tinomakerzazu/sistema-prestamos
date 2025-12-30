const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, '..', 'sistema-corporacion-v2');

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

const dataFiles = {
  clientes: path.join(DATA_DIR, 'clientes.json'),
  prestamos: path.join(DATA_DIR, 'prestamos.json'),
  pagos: path.join(DATA_DIR, 'pagos.json')
};

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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/clientes', (req, res) => {
  res.json(readData(dataFiles.clientes));
});

app.post('/api/clientes', (req, res) => {
  const { dni, nombres, apellidos, telefonoPrincipal } = req.body;
  if (!dni || !nombres || !apellidos || !telefonoPrincipal) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  const clientes = readData(dataFiles.clientes);
  const now = new Date().toISOString();
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

app.put('/api/clientes/:id', (req, res) => {
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
  const clientes = readData(dataFiles.clientes);
  const updated = clientes.filter(item => item.id !== req.params.id);
  writeData(dataFiles.clientes, updated);
  res.json({ ok: true });
});

app.get('/api/prestamos', (req, res) => {
  res.json(readData(dataFiles.prestamos));
});

app.post('/api/prestamos', (req, res) => {
  const prestamos = readData(dataFiles.prestamos);
  const now = new Date().toISOString();
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

app.put('/api/prestamos/:id', (req, res) => {
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
  const prestamos = readData(dataFiles.prestamos);
  const updated = prestamos.filter(item => item.id !== req.params.id);
  writeData(dataFiles.prestamos, updated);
  res.json({ ok: true });
});

app.get('/api/pagos', (req, res) => {
  res.json(readData(dataFiles.pagos));
});

app.post('/api/pagos', upload.single('comprobante'), (req, res) => {
  const { cliente, monto, fecha, metodo } = req.body;
  if (!cliente || !monto || !fecha || !metodo) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  const pagos = readData(dataFiles.pagos);
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

  if (req.file) {
    nuevo.comprobante = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`
    };
  }

  pagos.push(nuevo);
  writeData(dataFiles.pagos, pagos);
  res.status(201).json(nuevo);
});

app.put('/api/pagos/:id', (req, res) => {
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

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Error en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readData(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
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
