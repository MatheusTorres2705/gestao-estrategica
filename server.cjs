// server.cjs — Gestão Estratégica (CommonJS para compatibilidade com dotenv/jwt)
require('dotenv').config({ path: '.env.server' });
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();

const SANKHYA_URL = process.env.SANKHYA_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3201;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5174';

app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(cookieParser());

const sankhya = axios.create({
  baseURL: SANKHYA_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true
});

/** sessions[jti] = { jsessionid, usuario, codusu, name, createdAt } */
const sessions = Object.create(null);

async function sankhyaLogin(usuario, senha) {
  const payload = {
    serviceName: 'MobileLoginSP.login',
    requestBody: {
      NOMUSU: { $: usuario },
      INTERNO: { $: senha },
      KEEPCONNECTED: { $: 'S' }
    }
  };
  const url = '/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json';
  const r = await sankhya.post(url, payload);
  if (r.status >= 400) throw new Error(`Falha HTTP ${r.status} no login`);
  const jsessionid = r.data?.responseBody?.jsessionid?.['$'];
  if (!jsessionid) throw new Error('JSESSIONID ausente (login inválido)');
  return jsessionid;
}

async function sankhyaQuery(jsessionid, sql) {
  const payload = {
    serviceName: 'DbExplorerSP.executeQuery',
    requestBody: { sql, outputType: 'json' }
  };
  const url = '/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
  const r = await sankhya.post(url, payload, {
    headers: { Cookie: `JSESSIONID=${jsessionid}` }
  });
  if (r.status >= 400) throw new Error(`Falha HTTP ${r.status} na query`);
  return r.data?.responseBody?.rows || [];
}

async function sankhyaSave(jsessionid, entity, fields) {
  const payload = {
    serviceName: 'CRUDServiceProvider.saveRecord',
    requestBody: {
      dataSet: {
        rootEntity: entity,
        includePresentationFields: 'S',
        dataRow: {
          field: Object.entries(fields)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([name, value]) => ({ name, $: String(value) }))
        }
      }
    }
  };
  const url = '/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json';
  const r = await sankhya.post(url, payload, {
    headers: { Cookie: `JSESSIONID=${jsessionid}` }
  });
  if (r.status >= 400) throw new Error(`Falha HTTP ${r.status} ao salvar`);
  const status = r.data?.status;
  if (status && status !== '1') {
    throw new Error(r.data?.statusMessage || 'Erro retornado pelo Sankhya');
  }
  return r.data;
}

async function sankhyaLogout(jsessionid) {
  const payload = { serviceName: 'LogoutSP.logout', requestBody: {} };
  const url = '/mge/service.sbr?serviceName=LogoutSP.logout&outputType=json';
  try {
    await sankhya.post(url, payload, { headers: { Cookie: `JSESSIONID=${jsessionid}` } });
  } catch (_) {}
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const sess = sessions[data.jti];
    if (!sess) return res.status(401).json({ erro: 'Sessão expirada' });
    req.user = data;
    req.sankhya = sess;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body || {};
    if (!usuario || !senha) return res.status(400).json({ erro: 'Usuário e senha são obrigatórios.' });
    const usuarioUpper = String(usuario).trim().toUpperCase();
    const safeUser = usuarioUpper.replace(/'/g, "''");
    const jsessionid = await sankhyaLogin(usuarioUpper, senha);
    const sqlUser = `SELECT CODUSU, NVL(CODVEND,0) AS CODVEND, NOMEUSU FROM TSIUSU WHERE UPPER(NOMEUSU) = '${safeUser}'`;
    const rows = await sankhyaQuery(jsessionid, sqlUser);
    const [codusu, codvend, nomeusu] = rows[0] || [];
    const name = nomeusu || usuarioUpper;
    const jti = uuidv4();
    sessions[jti] = { jsessionid, usuario: usuarioUpper, codusu: codusu ?? null, codvend: codvend ?? null, name, createdAt: new Date().toISOString() };
    const token = jwt.sign({ sub: usuarioUpper, name, codusu, codvend, jti }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, name, codusu, codvend });
  } catch (err) {
    console.error('Erro /api/auth/login:', err?.response?.data || err.message);
    return res.status(401).json({ erro: 'Falha no login. Verifique suas credenciais.' });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });
  try {
    const data = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && now - data.exp > 7 * 24 * 3600) return res.status(401).json({ erro: 'Sessão expirada' });
    const sess = sessions[data.jti];
    if (!sess) return res.status(401).json({ erro: 'Sessão expirada' });
    const newJti = uuidv4();
    sessions[newJti] = { ...sess, createdAt: new Date().toISOString() };
    delete sessions[data.jti];
    const newToken = jwt.sign({ sub: data.sub, name: data.name, codusu: data.codusu, codvend: data.codvend, jti: newJti }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token: newToken });
  } catch {
    return res.status(401).json({ erro: 'Token inválido' });
  }
});

app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    const { jti } = req.user || {};
    const sess = jti ? sessions[jti] : null;
    if (sess?.jsessionid) await sankhyaLogout(sess.jsessionid);
    if (jti) delete sessions[jti];
    res.json({ sucesso: true });
  } catch {
    res.json({ sucesso: true });
  }
});

app.get('/api/whoami', auth, (req, res) => {
  res.json({ user: req.user, sankhyaSession: !!req.sankhya?.jsessionid });
});

app.post('/api/obter-reg', auth, async (req, res) => {
  try {
    const { consulta } = req.body || {};
    if (!consulta) return res.status(400).json({ erro: 'Parâmetro "consulta" é obrigatório.' });
    const rows = await sankhyaQuery(req.sankhya.jsessionid, consulta);
    return res.json({ rows });
  } catch (err) {
    console.error('Erro /api/obter-reg:', err?.response?.data || err.message);
    return res.status(500).json({ erro: 'Falha ao executar consulta no Sankhya', det: err.message });
  }
});

app.post('/api/data-save', auth, async (req, res) => {
  try {
    const { entity, fields } = req.body || {};
    if (!entity || !fields) return res.status(400).json({ erro: 'Parâmetros "entity" e "fields" são obrigatórios.' });
    const result = await sankhyaSave(req.sankhya.jsessionid, entity, fields);
    return res.json({ sucesso: true, data: result });
  } catch (err) {
    console.error('Erro /api/data-save:', err?.response?.data || err.message);
    return res.status(500).json({ erro: err.message || 'Falha ao salvar no Sankhya' });
  }
});

app.get('/api/ping-sankhya', auth, async (req, res) => {
  try {
    const rows = await sankhyaQuery(req.sankhya.jsessionid, 'SELECT 1 FROM DUAL');
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar Sankhya', det: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\x1b[32m✓\x1b[0m Gestão Estratégica — servidor na porta ${PORT}`);
});
