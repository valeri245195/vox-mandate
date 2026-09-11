const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const allowOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(server, { cors: { origin: allowOrigin } });

app.use(cors({ origin: allowOrigin }));
app.use(express.json({ limit: '1mb' }));

// Prototype storage. Render's filesystem is ephemeral, so the browser recovery
// token below recreates the current account after a deploy/restart.
const dataDir = path.join(__dirname, '..', 'data');
const usersPath = path.join(dataDir, 'users.json');
fs.mkdirSync(dataDir, { recursive: true });

function readJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const users = readJson(usersPath, {});
const sessions = new Map();
const friendRequests = [];
const directMessages = [];

function normalizeHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 32);
}
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function hashValue(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function sanitizeProfile(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, recoveryHash, ...safe } = user;
  return safe;
}
function sanitizePublicProfile(user) {
  if (!user) return null;
  return {
    id: user.id, name: user.name, handle: user.handle, type: user.type,
    city: user.city || '', province: user.province || '', role: user.role || '', district: user.district || '', bio: user.bio || ''
  };
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'), passwordSalt: salt };
}
function verifyPassword(password, user) {
  try {
    const computed = hashPassword(password, user.passwordSalt).passwordHash;
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(user.passwordHash, 'hex'));
  } catch { return false; }
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}
function userForToken(token) {
  const session = sessions.get(token);
  return session ? users[session.userId] || null : null;
}
function getToken(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function requireAuth(req, res, next) {
  const user = userForToken(getToken(req));
  if (!user) return res.status(401).json({ error: 'Invalid or expired session.' });
  req.user = user;
  next();
}

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'vox-mandate' }));

app.post('/api/auth/register', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const handle = normalizeHandle(body.handle);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const type = String(body.type || 'Voter').trim();
  if (!name || !handle || !email || !password) return res.status(400).json({ error: 'Name, username, email and password are required.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['Voter', 'Candidate', 'Serving Politician'].includes(type)) return res.status(400).json({ error: 'Invalid account type.' });
  const duplicate = Object.values(users).find(u => u.handle === handle || u.email === email);
  if (duplicate) return res.status(409).json({ error: duplicate.handle === handle ? 'That username is already taken.' : 'An account with that email already exists.' });

  const id = crypto.randomUUID();
  const { passwordHash, passwordSalt } = hashPassword(password);
  const recoveryToken = String(body.recoveryToken || crypto.randomBytes(32).toString('hex'));
  users[id] = {
    id, name, handle, email, type,
    city: String(body.city || '').trim().slice(0, 80),
    province: String(body.province || '').trim().slice(0, 80),
    role: String(body.role || '').trim().slice(0, 100),
    district: String(body.district || '').trim().slice(0, 100),
    bio: String(body.bio || '').trim().slice(0, 240),
    messaging: 'everyone', friendRequests: 'qr', readReceipts: true,
    typingIndicators: true, messageNotifications: true,
    createdAt: new Date().toISOString(), passwordHash, passwordSalt,
    recoveryHash: hashValue(recoveryToken)
  };
  writeJson(usersPath, users);
  const token = createSession(id);
  res.status(201).json({ token, recoveryToken, profile: sanitizeProfile(users[id]) });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const recoveryToken = String(req.body?.recoveryToken || crypto.randomBytes(32).toString('hex'));
  const user = Object.values(users).find(u => u.handle === normalizeHandle(identifier) || u.email === identifier);
  if (!user || !verifyPassword(password, user)) return res.status(401).json({ error: 'Incorrect username/email or password.' });
  user.recoveryHash = hashValue(recoveryToken);
  writeJson(usersPath, users);
  const token = createSession(user.id);
  res.json({ token, recoveryToken, profile: sanitizeProfile(user) });
});

// Recreates the local prototype identity after a Render deploy/restart.
// This is intentionally a prototype-only recovery mechanism; production should use a real database.
app.post('/api/auth/restore', (req, res) => {
  const recoveryToken = String(req.body?.recoveryToken || '');
  const profile = req.body?.profile || {};
  if (!recoveryToken || !profile.handle || !profile.name) return res.status(400).json({ error: 'Missing recovery information.' });

  let user = Object.values(users).find(u => u.recoveryHash && u.recoveryHash === hashValue(recoveryToken));
  if (!user) {
    user = Object.values(users).find(u => u.handle === normalizeHandle(profile.handle));
  }
  if (!user) {
    const id = String(profile.id || crypto.randomUUID());
    user = {
      id,
      name: String(profile.name).trim().slice(0, 80),
      handle: normalizeHandle(profile.handle),
      email: normalizeEmail(profile.email || `${normalizeHandle(profile.handle)}@local.vox`),
      type: ['Voter', 'Candidate', 'Serving Politician'].includes(profile.type) ? profile.type : 'Voter',
      city: String(profile.city || '').slice(0, 80),
      province: String(profile.province || '').slice(0, 80),
      role: String(profile.role || '').slice(0, 100),
      district: String(profile.district || '').slice(0, 100),
      bio: String(profile.bio || '').slice(0, 240),
      messaging: profile.messaging || 'everyone', friendRequests: profile.friendRequests || 'qr',
      readReceipts: profile.readReceipts !== false, typingIndicators: profile.typingIndicators !== false,
      messageNotifications: profile.messageNotifications !== false,
      createdAt: new Date().toISOString(),
      passwordHash: '', passwordSalt: '', recoveryHash: hashValue(recoveryToken)
    };
  } else {
    Object.assign(user, {
      name: String(profile.name || user.name).slice(0, 80),
      city: String(profile.city || user.city || '').slice(0, 80),
      province: String(profile.province || user.province || '').slice(0, 80),
      role: String(profile.role || user.role || '').slice(0, 100),
      district: String(profile.district || user.district || '').slice(0, 100),
      bio: String(profile.bio || user.bio || '').slice(0, 240),
      type: ['Voter', 'Candidate', 'Serving Politician'].includes(profile.type) ? profile.type : user.type,
      recoveryHash: hashValue(recoveryToken)
    });
  }
  users[user.id] = user;
  writeJson(usersPath, users);
  const token = createSession(user.id);
  res.json({ token, recoveryToken, profile: sanitizeProfile(user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  sessions.delete(getToken(req));
  res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ profile: sanitizeProfile(req.user) }));
app.get('/api/profile/me', requireAuth, (req, res) => res.json({ profile: sanitizeProfile(req.user) }));
app.put('/api/profile/me', requireAuth, (req, res) => {
  const user = req.user;
  const nextHandle = normalizeHandle(req.body?.handle || user.handle);
  const duplicate = Object.values(users).find(u => u.id !== user.id && u.handle === nextHandle);
  if (duplicate) return res.status(409).json({ error: 'That username is already taken.' });
  Object.assign(user, {
    name: String(req.body?.name || user.name).trim().slice(0, 80),
    handle: nextHandle,
    city: String(req.body?.city || user.city || '').slice(0, 80),
    province: String(req.body?.province || user.province || '').slice(0, 80),
    role: String(req.body?.role || user.role || '').slice(0, 100),
    district: String(req.body?.district || user.district || '').slice(0, 100),
    bio: String(req.body?.bio || '').slice(0, 240),
    messaging: req.body?.messaging || user.messaging,
    friendRequests: req.body?.friendRequests || user.friendRequests,
    readReceipts: req.body?.readReceipts !== undefined ? Boolean(req.body.readReceipts) : user.readReceipts,
    typingIndicators: req.body?.typingIndicators !== undefined ? Boolean(req.body.typingIndicators) : user.typingIndicators,
    messageNotifications: req.body?.messageNotifications !== undefined ? Boolean(req.body.messageNotifications) : user.messageNotifications
  });
  writeJson(usersPath, users);
  res.json({ profile: sanitizeProfile(user) });
});

app.get('/api/people/search', requireAuth, (req, res) => {
  const raw = String(req.query?.q || '').trim();
  const query = normalizeHandle(raw);
  if (query.length < 2) return res.json({ people: [] });
  const lower = raw.toLowerCase();
  const people = Object.values(users)
    .filter(u => u.id !== req.user.id)
    .filter(u => u.handle.includes(query) || u.name.toLowerCase().includes(lower))
    .slice(0, 20)
    .map(sanitizePublicProfile);
  res.json({ people });
});

app.post('/api/people/friends/request', requireAuth, (req, res) => {
  const target = Object.values(users).find(u => u.id === String(req.body?.userId || '') || u.handle === normalizeHandle(req.body?.handle || ''));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself.' });
  const duplicate = friendRequests.find(r => r.fromUserId === req.user.id && r.toUserId === target.id && r.status === 'pending');
  if (duplicate) return res.status(409).json({ error: 'Friend request already sent.' });
  friendRequests.push({ id: crypto.randomUUID(), fromUserId: req.user.id, toUserId: target.id, status: 'pending', createdAt: new Date().toISOString() });
  io.to(`user:${target.id}`).emit('friend:request', { from: sanitizePublicProfile(req.user) });
  res.status(201).json({ ok: true, message: `Friend request sent to @${target.handle}.` });
});

app.get('/api/people/inbox', requireAuth, (req, res) => {
  const mine = directMessages.filter(m => m.fromUserId === req.user.id || m.toUserId === req.user.id);
  const byUser = new Map();
  mine.forEach(m => {
    const otherId = m.fromUserId === req.user.id ? m.toUserId : m.fromUserId;
    byUser.set(otherId, m);
  });
  const result = [...byUser.entries()].map(([otherId, m]) => {
    const other = users[otherId];
    return other ? { person: sanitizePublicProfile(other), lastMessage: { text: m.text, createdAt: m.createdAt, mine: m.fromUserId === req.user.id } } : null;
  }).filter(Boolean);
  res.json({ conversations: result });
});

app.get('/api/people/messages/:handle', requireAuth, (req, res) => {
  const target = Object.values(users).find(u => u.handle === normalizeHandle(req.params.handle));
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const history = directMessages.filter(m => (m.fromUserId === req.user.id && m.toUserId === target.id) || (m.fromUserId === target.id && m.toUserId === req.user.id)).map(m => ({
    id: m.id, text: m.text, mine: m.fromUserId === req.user.id, createdAt: m.createdAt, from: sanitizePublicProfile(users[m.fromUserId])
  }));
  res.json({ person: sanitizePublicProfile(target), messages: history });
});

app.post('/api/people/message', requireAuth, (req, res) => {
  const target = Object.values(users).find(u => u.id === String(req.body?.userId || '') || u.handle === normalizeHandle(req.body?.handle || ''));
  const text = String(req.body?.text || '').trim().slice(0, 4000);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself.' });
  const message = { id: crypto.randomUUID(), fromUserId: req.user.id, toUserId: target.id, text, createdAt: new Date().toISOString() };
  directMessages.push(message);
  io.to(`user:${target.id}`).emit('people:message', { id: message.id, from: sanitizePublicProfile(req.user), to: sanitizePublicProfile(target), text, createdAt: message.createdAt });
  res.status(201).json({ ok: true, message: 'Message sent.', item: message });
});

io.on('connection', socket => {
  socket.on('identify', ({ userId }) => {
    if (!userId || !users[userId]) return;
    socket.join(`user:${userId}`);
    const pending = directMessages.filter(m => m.toUserId === userId).slice(-30);
    pending.forEach(m => socket.emit('people:message', { id: m.id, from: sanitizePublicProfile(users[m.fromUserId]), to: sanitizePublicProfile(users[userId]), text: m.text, createdAt: m.createdAt }));
  });

  socket.on('join', ({ conversationId }) => { if (conversationId) socket.join(`conversation:${conversationId}`); });
  socket.on('message:send', payload => {
    if (!payload?.conversationId || !payload?.text) return;
    const message = { id: payload.id || crypto.randomUUID(), conversationId: payload.conversationId, from: payload.from || 'me', text: String(payload.text).slice(0, 4000), time: payload.time || new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
    socket.to(`conversation:${message.conversationId}`).emit('message:new', message);
  });
});

if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 3001);
server.listen(PORT, '0.0.0.0', () => console.log(`Vox Mandate server running on http://0.0.0.0:${PORT}`));
