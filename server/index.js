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

const dataDir = path.join(__dirname, '..', 'data');
const usersPath = path.join(dataDir, 'users.json');
const sessionsPath = path.join(dataDir, 'sessions.json');
const friendRequestsPath = path.join(dataDir, 'friend_requests.json');
const directMessagesPath = path.join(dataDir, 'direct_messages.json');
fs.mkdirSync(dataDir, { recursive: true });

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

const users = readJson(usersPath, {});
const sessions = readJson(sessionsPath, {});
const friendRequests = readJson(friendRequestsPath, []);
const directMessages = readJson(directMessagesPath, []);
const messages = [];

function normalizeHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 32);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeProfile(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

function sanitizePublicProfile(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    type: user.type,
    city: user.city || '',
    province: user.province || '',
    role: user.role || '',
    district: user.district || '',
    bio: user.bio || '',
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password, user) {
  const { passwordHash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId, createdAt: Date.now() };
  writeJson(sessionsPath, sessions);
  return token;
}

function getUserFromRequest(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  const session = sessions[token];
  if (!session) return null;
  return users[session.userId] || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session.' });
  req.user = user;
  next();
}

const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'vox-mandate-messaging' }));

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
  users[id] = {
    id, name, handle, email, type,
    city: String(body.city || '').trim().slice(0, 80),
    province: String(body.province || '').trim().slice(0, 80),
    role: String(body.role || '').trim().slice(0, 100),
    district: String(body.district || '').trim().slice(0, 100),
    bio: String(body.bio || '').trim().slice(0, 240),
    messaging: 'everyone', friendRequests: 'qr', readReceipts: true,
    typingIndicators: true, messageNotifications: true,
    createdAt: new Date().toISOString(), passwordHash, passwordSalt
  };
  writeJson(usersPath, users);

  const token = createSession(id);
  res.status(201).json({ token, profile: sanitizeProfile(users[id]) });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return res.status(400).json({ error: 'Enter your username or email and password.' });
  const user = Object.values(users).find(u => u.handle === normalizeHandle(identifier) || u.email === identifier);
  if (!user || !verifyPassword(password, user)) return res.status(401).json({ error: 'Incorrect username/email or password.' });
  const token = createSession(user.id);
  res.json({ token, profile: sanitizeProfile(user) });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const header = String(req.headers.authorization || '');
  const token = header.slice(7).trim();
  delete sessions[token];
  writeJson(sessionsPath, sessions);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ profile: sanitizeProfile(req.user) }));
app.get('/api/profile/me', requireAuth, (req, res) => res.json({ profile: sanitizeProfile(req.user) }));

app.put('/api/profile/me', requireAuth, (req, res) => {
  const current = req.user;
  const next = {
    ...current,
    ...req.body,
    id: current.id,
    email: current.email,
    type: current.type,
    handle: normalizeHandle(req.body?.handle || current.handle),
    name: String(req.body?.name || current.name).trim().slice(0, 80),
    bio: String(req.body?.bio || '').slice(0, 240),
    passwordHash: current.passwordHash,
    passwordSalt: current.passwordSalt,
  };
  const conflict = Object.values(users).find(u => u.id !== current.id && u.handle === next.handle);
  if (conflict) return res.status(409).json({ error: 'That username is already taken.' });
  users[current.id] = next;
  writeJson(usersPath, users);
  res.json({ profile: sanitizeProfile(next) });
});

// Temporary username discovery for the Contacts > Friends area.
app.get('/api/people/search', requireAuth, (req, res) => {
  const query = normalizeHandle(req.query?.q || '');
  if (query.length < 2) return res.json({ people: [] });
  const people = Object.values(users)
    .filter(user => user.id !== req.user.id)
    .filter(user => user.handle.includes(query) || user.name.toLowerCase().includes(String(req.query?.q || '').trim().toLowerCase()))
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .slice(0, 20)
    .map(sanitizePublicProfile);
  res.json({ people });
});

app.post('/api/people/friends/request', requireAuth, (req, res) => {
  const targetId = String(req.body?.userId || '');
  const targetHandle = normalizeHandle(req.body?.handle || '');
  const target = Object.values(users).find(user => user.id === targetId || user.handle === targetHandle);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself.' });

  const duplicate = friendRequests.find(r => r.fromUserId === req.user.id && r.toUserId === target.id && r.status === 'pending');
  if (duplicate) return res.status(409).json({ error: 'Friend request already sent.' });

  const reverse = friendRequests.find(r => r.fromUserId === target.id && r.toUserId === req.user.id && r.status === 'pending');
  if (reverse) return res.status(409).json({ error: 'This person already sent you a friend request.' });

  friendRequests.push({
    id: crypto.randomUUID(),
    fromUserId: req.user.id,
    toUserId: target.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  writeJson(friendRequestsPath, friendRequests);
  res.status(201).json({ ok: true, message: `Friend request sent to @${target.handle}.` });
});

app.post('/api/people/message', requireAuth, (req, res) => {
  const targetId = String(req.body?.userId || '');
  const targetHandle = normalizeHandle(req.body?.handle || '');
  const text = String(req.body?.text || '').trim().slice(0, 4000);
  const target = Object.values(users).find(user => user.id === targetId || user.handle === targetHandle);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself.' });

  const message = {
    id: crypto.randomUUID(),
    fromUserId: req.user.id,
    toUserId: target.id,
    text,
    createdAt: new Date().toISOString(),
  };
  directMessages.push(message);
  writeJson(directMessagesPath, directMessages);

  io.to(`user:${target.id}`).emit('people:message', {
    id: message.id,
    from: sanitizePublicProfile(req.user),
    text: message.text,
    createdAt: message.createdAt,
  });

  res.status(201).json({ ok: true, message: 'Message sent.' });
});

app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
  res.json(messages.filter(m => m.conversationId === req.params.id));
});

io.on('connection', socket => {
  socket.on('identify', ({ userId }) => {
    if (userId) socket.join(`user:${userId}`);
  });

  socket.on('join', ({ conversationId }) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('message:send', payload => {
    if (!payload?.conversationId || !payload?.text) return;
    const message = {
      id: payload.id || crypto.randomUUID(),
      conversationId: payload.conversationId,
      from: payload.from || 'me',
      text: String(payload.text).slice(0, 4000),
      time: payload.time || new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    };
    messages.push(message);
    socket.to(`conversation:${message.conversationId}`).emit('message:new', message);
  });
});

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

server.listen(PORT, HOST, () => console.log(`Vox Mandate server running on http://${HOST}:${PORT}`));
