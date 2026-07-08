// FiloPro Senkronizasyon Sunucusu (Çok Kiracılı / Multi-Tenant)
// ----------------------------------------------------------------
// Her şirket (tenant) kendi izole verisine sahiptir. Bir şirket birden fazla
// kullanıcıya sahip olabilir (admin + ekip üyeleri); aynı şirketteki tüm
// kullanıcılar aynı veriyi görür ve senkronize eder. Farklı şirketler
// birbirinin verisini asla göremez.
//
// Depolama: veritabanı gerektirmez, düz JSON dosyalarında tutulur:
//   data/users.json              -> tüm kullanıcılar (hangi şirkete ait, rolü, şifre hash'i)
//   data/tenants/<tenantId>.json -> o şirkete ait tüm FiloPro tabloları

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const GROQ_API_KEY = process.env.GROQ_API_KEY; // opsiyonel: yoksa sadece AI modülü çalışmaz, senkron etkilenmez. Ücretsiz anahtar: console.groq.com

const DATA_DIR = path.join(__dirname, 'data');
const TENANTS_DIR = path.join(DATA_DIR, 'tenants');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!JWT_SECRET) {
  console.error('HATA: JWT_SECRET tanımlı değil. .env dosyasında JWT_SECRET ayarlayın (README.md).');
  process.exit(1);
}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TENANTS_DIR)) fs.mkdirSync(TENANTS_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }));

// ── Dosya yardımcıları (atomic write: yarıda kesilen yazmalarda veri bozulmaz) ─
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}
function tenantFile(tenantId) {
  return path.join(TENANTS_DIR, `${tenantId}.json`);
}
function readTenantStore(tenantId) {
  return readJson(tenantFile(tenantId), {});
}
function writeTenantStore(tenantId, store) {
  writeJsonAtomic(tenantFile(tenantId), store);
}
function aiConfigFile(tenantId) {
  return path.join(TENANTS_DIR, `${tenantId}.ai.json`);
}
function readAiConfig(tenantId) {
  return readJson(aiConfigFile(tenantId), {});
}
function writeAiConfig(tenantId, cfg) {
  writeJsonAtomic(aiConfigFile(tenantId), cfg);
}
function readUsers() {
  return readJson(USERS_FILE, { users: [] }).users;
}
function writeUsers(users) {
  writeJsonAtomic(USERS_FILE, { users });
}

// ── Kimlik doğrulama ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token gerekli.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // {sub, tenantId, role}
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekli.' });
  next();
}

// ── Kaba brute-force koruması ───────────────────────────────────────────────────
const attempts = new Map();
function rateLimit(bucket, max) {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const rec = attempts.get(key) || { count: 0, windowStart: now };
    if (now - rec.windowStart > 15 * 60 * 1000) {
      rec.count = 0;
      rec.windowStart = now;
    }
    if (rec.count >= max) {
      return res.status(429).json({ error: 'Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.' });
    }
    rec.count++;
    attempts.set(key, rec);
    next();
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.username, tenantId: user.tenantId, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// ── Yeni şirket kaydı (ilk kullanıcı = admin) ───────────────────────────────────
app.post('/api/auth/register', rateLimit('register', 10), async (req, res) => {
  const { companyName, username, password } = req.body || {};
  if (!companyName || !username || !password) {
    return res.status(400).json({ error: 'Şirket adı, kullanıcı adı ve şifre gerekli.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  }
  const users = readUsers();
  const uname = String(username).trim().toLowerCase();
  if (users.some((u) => u.username === uname)) {
    return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
  }
  const tenantId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: crypto.randomUUID(),
    tenantId,
    companyName: String(companyName).trim(),
    username: uname,
    passwordHash,
    role: 'admin',
    createdAt: Date.now(),
  };
  users.push(user);
  writeUsers(users);
  writeTenantStore(tenantId, {}); // boş şirket veri deposu oluştur
  res.json({ token: signToken(user), companyName: user.companyName, role: user.role });
});

// ── Giriş ────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', rateLimit('login', 15), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
  const uname = String(username).trim().toLowerCase();
  const users = readUsers();
  const user = users.find((u) => u.username === uname);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  res.json({ token: signToken(user), companyName: user.companyName, role: user.role });
});

// ── Ekip yönetimi (sadece admin) ────────────────────────────────────────────────
// Aynı şirkete (tenant) yeni bir kullanıcı ekler.
app.post('/api/users', authMiddleware, adminOnly, rateLimit('adduser', 20), async (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  const finalRole = role === 'admin' ? 'admin' : 'kullanici';
  const users = readUsers();
  const uname = String(username).trim().toLowerCase();
  if (users.some((u) => u.username === uname)) {
    return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
  }
  const requester = users.find((u) => u.username === req.user.sub);
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    id: crypto.randomUUID(),
    tenantId: req.user.tenantId,
    companyName: requester ? requester.companyName : '',
    username: uname,
    passwordHash,
    role: finalRole,
    createdAt: Date.now(),
  };
  users.push(newUser);
  writeUsers(users);
  res.json({ username: newUser.username, role: newUser.role, createdAt: newUser.createdAt });
});

// Aynı şirketteki kullanıcıları listeler (şifre hash'leri asla dönülmez).
app.get('/api/users', authMiddleware, (req, res) => {
  const users = readUsers()
    .filter((u) => u.tenantId === req.user.tenantId)
    .map((u) => ({ username: u.username, role: u.role, createdAt: u.createdAt }));
  res.json({ users });
});

// Bir kullanıcıyı şirketten kaldırır (sadece admin; kendini veya son admini silemez).
app.delete('/api/users/:username', authMiddleware, adminOnly, (req, res) => {
  const target = String(req.params.username).trim().toLowerCase();
  if (target === req.user.sub) return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
  const users = readUsers();
  const tenantUsers = users.filter((u) => u.tenantId === req.user.tenantId);
  const victim = tenantUsers.find((u) => u.username === target);
  if (!victim) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  const remainingAdmins = tenantUsers.filter((u) => u.role === 'admin' && u.username !== target);
  if (victim.role === 'admin' && remainingAdmins.length === 0) {
    return res.status(400).json({ error: 'Şirketin son yöneticisi silinemez.' });
  }
  writeUsers(users.filter((u) => !(u.tenantId === req.user.tenantId && u.username === target)));
  res.json({ ok: true });
});

// ── Senkronizasyon (şirket bazında izole) ────────────────────────────────────────
app.get('/api/sync/pull', authMiddleware, (req, res) => {
  const since = parseInt(req.query.since || '0', 10) || 0;
  const store = readTenantStore(req.user.tenantId);
  const changed = {};
  Object.keys(store).forEach((key) => {
    const entry = store[key];
    if (entry && entry.updatedAt > since) {
      changed[key] = { data: entry.data, updatedAt: entry.updatedAt };
    }
  });
  res.json({ changed, serverTime: Date.now() });
});

// "Son yazan kazanır" (last-write-wins): gelen kaydın updatedAt'i sunucudakinden
// yeni veya eşitse uygulanır. Kayıt bazlı değil, tablo (modül) bazlıdır.
app.post('/api/sync/push', authMiddleware, (req, res) => {
  const { changes } = req.body || {};
  if (!Array.isArray(changes)) return res.status(400).json({ error: 'changes dizisi gerekli.' });
  const store = readTenantStore(req.user.tenantId);
  let applied = 0;
  let rejected = 0;
  const now = Date.now();
  changes.forEach((ch) => {
    if (!ch || !ch.key) return;
    const existing = store[ch.key];
    if (!existing || (ch.updatedAt || 0) >= existing.updatedAt) {
      store[ch.key] = { data: ch.data, updatedAt: ch.updatedAt || now };
      applied++;
    } else {
      rejected++;
    }
  });
  writeTenantStore(req.user.tenantId, store);
  res.json({ applied, rejected, serverTime: Date.now() });
});

// ── Yapay Zeka Vekili (Proxy) ────────────────────────────────────────────────
// FiloPro'nun AI Asistan modülü, API anahtarını tarayıcıda gizli tutamayacağı
// için bu uca istek atar; anahtar sadece burada, sunucuda kalır. Her şirket
// (tenant) kendi Groq API anahtarını Ayarlar ekranından girebilir; girilmezse
// sunucudaki ortak GROQ_API_KEY (varsa) yedek olarak kullanılır.
const GLOBAL_AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '200', 10);
const AI_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B — en yetenekli (önerilen)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B — en hızlı, daha yüksek kotayla' },
];
const DEFAULT_AI_MODEL = AI_MODELS[0].id;

const aiUsage = new Map(); // tenantId -> {count, day}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getAiUsage(tenantId) {
  const day = todayStr();
  const rec = aiUsage.get(tenantId) || { count: 0, day };
  if (rec.day !== day) {
    rec.count = 0;
    rec.day = day;
  }
  return rec;
}
function effectiveAiConfig(tenantId) {
  const cfg = readAiConfig(tenantId);
  return {
    apiKey: cfg.groqApiKey || GROQ_API_KEY || '',
    usingOwnKey: !!cfg.groqApiKey,
    usingServerDefault: !cfg.groqApiKey && !!GROQ_API_KEY,
    model: cfg.model || DEFAULT_AI_MODEL,
    dailyLimit: cfg.dailyLimit || GLOBAL_AI_DAILY_LIMIT,
  };
}

// Mevcut AI yapılandırmasını ve bugünkü kullanımı döner (anahtar asla geri dönülmez).
app.get('/api/ai/config', authMiddleware, (req, res) => {
  const eff = effectiveAiConfig(req.user.tenantId);
  const usage = getAiUsage(req.user.tenantId);
  res.json({
    configured: !!eff.apiKey,
    usingOwnKey: eff.usingOwnKey,
    usingServerDefault: eff.usingServerDefault,
    model: eff.model,
    dailyLimit: eff.dailyLimit,
    usageToday: usage.count,
    availableModels: AI_MODELS,
  });
});

// Şirketin kendi Groq API anahtarını, modelini ve günlük limitini kaydeder (sadece yönetici).
app.post('/api/ai/config', authMiddleware, adminOnly, (req, res) => {
  const { groqApiKey, model, dailyLimit } = req.body || {};
  const current = readAiConfig(req.user.tenantId);
  const next = { ...current };
  if (typeof groqApiKey === 'string' && groqApiKey.trim()) next.groqApiKey = groqApiKey.trim();
  if (typeof model === 'string' && AI_MODELS.some((m) => m.id === model)) next.model = model;
  if (dailyLimit !== undefined && dailyLimit !== null && dailyLimit !== '') {
    const n = parseInt(dailyLimit, 10);
    if (!Number.isFinite(n) || n < 1 || n > 5000) {
      return res.status(400).json({ error: 'Günlük limit 1 ile 5000 arasında olmalı.' });
    }
    next.dailyLimit = n;
  }
  writeAiConfig(req.user.tenantId, next);
  const eff = effectiveAiConfig(req.user.tenantId);
  res.json({ ok: true, configured: !!eff.apiKey, usingOwnKey: eff.usingOwnKey, model: eff.model, dailyLimit: eff.dailyLimit });
});

// Şirketin kendi API anahtarını kaldırır; sunucudaki ortak anahtar varsa ona döner.
app.delete('/api/ai/config', authMiddleware, adminOnly, (req, res) => {
  const current = readAiConfig(req.user.tenantId);
  delete current.groqApiKey;
  writeAiConfig(req.user.tenantId, current);
  const eff = effectiveAiConfig(req.user.tenantId);
  res.json({ ok: true, configured: !!eff.apiKey, usingServerDefault: eff.usingServerDefault });
});

function aiRateLimit(req, res, next) {
  const eff = effectiveAiConfig(req.user.tenantId);
  const usage = getAiUsage(req.user.tenantId);
  if (usage.count >= eff.dailyLimit) {
    return res.status(429).json({ error: 'Günlük yapay zeka kullanım sınırına ulaşıldı. Yarın tekrar deneyin (Ayarlar\'dan limiti artırabilirsiniz).' });
  }
  usage.count++;
  aiUsage.set(req.user.tenantId, usage);
  next();
}

app.post('/api/ai/chat', authMiddleware, aiRateLimit, async (req, res) => {
  const eff = effectiveAiConfig(req.user.tenantId);
  if (!eff.apiKey) {
    return res.status(503).json({ error: 'Yapay zeka anahtarı yapılandırılmamış. Ayarlar → Senkronizasyon → Yapay Zeka bölümünden bir Groq API anahtarı girin (ücretsiz: console.groq.com).' });
  }
  const { prompt, maxTokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (metin) gerekli.' });
  }
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${eff.apiKey}`,
      },
      body: JSON.stringify({
        model: eff.model,
        max_tokens: Math.min(Math.max(parseInt(maxTokens, 10) || 1000, 1), 4096),
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error?.message || 'Yapay zeka servisi hata döndürdü.' });
    }
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: 'Yapay zeka servisine ulaşılamadı: ' + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`FiloPro senkron sunucusu (çok kiracılı) http://localhost:${PORT} adresinde çalışıyor.`);
});
