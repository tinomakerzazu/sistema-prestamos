const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');
const authLogsFile = path.join(dataDir, 'auth-logs.json');

let usersBackup = null;
let authLogsBackup = null;
let app = null;

test.before(() => {
  usersBackup = fs.existsSync(usersFile) ? fs.readFileSync(usersFile, 'utf8') : null;
  authLogsBackup = fs.existsSync(authLogsFile) ? fs.readFileSync(authLogsFile, 'utf8') : null;

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.AUTH_INIT_USERS = JSON.stringify([
    { username: 'admin', password: '123', name: 'Admin' }
  ]);
  process.env.ALLOWED_ORIGINS = 'http://localhost:3000';

  fs.writeFileSync(usersFile, '[]', 'utf8');
  if (fs.existsSync(authLogsFile)) {
    fs.unlinkSync(authLogsFile);
  }

  app = require('../server');
});

test.after(() => {
  if (usersBackup === null) {
    if (fs.existsSync(usersFile)) fs.unlinkSync(usersFile);
  } else {
    fs.writeFileSync(usersFile, usersBackup, 'utf8');
  }

  if (authLogsBackup === null) {
    if (fs.existsSync(authLogsFile)) fs.unlinkSync(authLogsFile);
  } else {
    fs.writeFileSync(authLogsFile, authLogsBackup, 'utf8');
  }
});

test('health endpoint returns ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});

test('protected endpoint requires session', async () => {
  const res = await request(app).get('/api/clientes');
  assert.equal(res.statusCode, 401);
});

test('login sets cookie and allows protected access', async () => {
  const agent = request.agent(app);
  const loginRes = await agent
    .post('/api/auth/login')
    .send({ username: 'admin', password: '123' });
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.ok, true);

  const clientesRes = await agent.get('/api/clientes');
  assert.equal(clientesRes.statusCode, 200);
  assert.ok(Array.isArray(clientesRes.body));
});
