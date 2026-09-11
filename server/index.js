const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { Pool } = require('pg');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const allowOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(server, { cors: { origin: allowOrigin } });
app.use(cors({ origin: allowOrigin }));
app.use(express.json({ limit: '1mb' }));

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }) : null;
const sessions = new Map();

function normalizeHandle(value) { return String(value || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 32); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function hashValue(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { passwordHash: crypto.scryptSync(password, salt, 64).toString('hex'), passwordSalt: salt }; }
function verifyPassword(password, user) { try { const computed = hashPassword(password, user.password_salt).passwordHash; return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(user.password_hash, 'hex')); } catch { return false; } }
function sanitizePublicProfile(user) { return user ? { id:user.id, name:user.name, handle:user.handle, type:user.type, city:user.city||'', province:user.province||'', role:user.role||'', district:user.district||'', bio:user.bio||'' } : null; }
function sanitizeProfile(user) {
  return user ? { ...sanitizePublicProfile(user), email:user.email, messaging:user.messaging, friendRequests:user.friend_requests, readReceipts:user.read_receipts, typingIndicators:user.typing_indicators, messageNotifications:user.message_notifications } : null;
}
function createSession(userId) { const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId, createdAt: Date.now() }); return token; }
async function getUserById(id) { const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]); return rows[0] || null; }
async function userForToken(token) { const s = sessions.get(token); return s ? getUserById(s.userId) : null; }
function getToken(req) { const h = String(req.headers.authorization || ''); return h.startsWith('Bearer ') ? h.slice(7).trim() : ''; }
async function requireAuth(req,res,next) { if(!pool) return res.status(503).json({error:'Database is not configured.'}); const user=await userForToken(getToken(req)); if(!user) return res.status(401).json({error:'Invalid or expired session.'}); req.user=user; next(); }

async function initDb() {
  if(!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
      city TEXT DEFAULT '', province TEXT DEFAULT '', role TEXT DEFAULT '', district TEXT DEFAULT '', bio TEXT DEFAULT '',
      messaging TEXT DEFAULT 'everyone', friend_requests TEXT DEFAULT 'qr', read_receipts BOOLEAN DEFAULT TRUE,
      typing_indicators BOOLEAN DEFAULT TRUE, message_notifications BOOLEAN DEFAULT TRUE,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, recovery_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS users_handle_idx ON users(handle);
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_unique_pending ON friend_requests(from_user_id,to_user_id,status);
    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS direct_messages_pair_idx ON direct_messages(from_user_id,to_user_id,created_at);
    CREATE INDEX IF NOT EXISTS direct_messages_to_idx ON direct_messages(to_user_id,created_at);
  `);
}

const distPath = path.join(__dirname,'..','dist');
if(fs.existsSync(distPath)) app.use(express.static(distPath));
app.get('/api/health', async (_req,res)=>{ try { if(!pool) return res.status(503).json({ok:false,database:false}); await pool.query('SELECT 1'); res.json({ok:true,database:true,service:'vox-mandate'}); } catch { res.status(503).json({ok:false,database:false}); } });

app.post('/api/auth/register', async (req,res)=>{
  try {
    if(!pool) return res.status(503).json({error:'Database is not configured.'});
    const body=req.body||{}, name=String(body.name||'').trim(), handle=normalizeHandle(body.handle), email=normalizeEmail(body.email), password=String(body.password||''), type=String(body.type||'Voter').trim();
    if(!name||!handle||!email||!password) return res.status(400).json({error:'Name, username, email and password are required.'});
    if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Enter a valid email address.'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
    if(!['Voter','Candidate','Serving Politician'].includes(type)) return res.status(400).json({error:'Invalid account type.'});
    const dup=await pool.query('SELECT handle,email FROM users WHERE handle=$1 OR email=$2 LIMIT 1',[handle,email]);
    if(dup.rows[0]) return res.status(409).json({error:dup.rows[0].handle===handle?'That username is already taken.':'An account with that email already exists.'});
    const id=crypto.randomUUID(), recoveryToken=String(body.recoveryToken||crypto.randomBytes(32).toString('hex')), hp=hashPassword(password);
    const {rows}=await pool.query(`INSERT INTO users (id,name,handle,email,type,city,province,role,district,bio,password_hash,password_salt,recovery_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[id,name,handle,email,type,String(body.city||'').slice(0,80),String(body.province||'').slice(0,80),String(body.role||'').slice(0,100),String(body.district||'').slice(0,100),String(body.bio||'').slice(0,240),hp.passwordHash,hp.passwordSalt,hashValue(recoveryToken)]);
    res.status(201).json({token:createSession(id),recoveryToken,profile:sanitizeProfile(rows[0])});
  } catch(e){ res.status(500).json({error:e.message||'Unable to create account.'}); }
});

app.post('/api/auth/login', async (req,res)=>{
  try {
    if(!pool) return res.status(503).json({error:'Database is not configured.'});
    const identifier=String(req.body?.identifier||'').trim().toLowerCase(), password=String(req.body?.password||'');
    const {rows}=await pool.query('SELECT * FROM users WHERE handle=$1 OR email=$2 LIMIT 1',[normalizeHandle(identifier),identifier]);
    const user=rows[0];
    if(!user||!verifyPassword(password,user)) return res.status(401).json({error:'Incorrect username/email or password.'});
    const recoveryToken=crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE users SET recovery_hash=$1 WHERE id=$2',[hashValue(recoveryToken),user.id]);
    res.json({token:createSession(user.id),recoveryToken,profile:sanitizeProfile(await getUserById(user.id))});
  } catch(e){ res.status(500).json({error:e.message||'Unable to log in.'}); }
});

app.post('/api/auth/restore', async (req,res)=>{
  try {
    if(!pool) return res.status(503).json({error:'Database is not configured.'});
    const recoveryToken=String(req.body?.recoveryToken||''), profile=req.body?.profile||{}, suppliedPassword=String(req.body?.password||'');
    if(!recoveryToken||!profile.handle||!profile.name) return res.status(400).json({error:'Missing recovery information.'});
    let user=(await pool.query('SELECT * FROM users WHERE recovery_hash=$1 LIMIT 1',[hashValue(recoveryToken)])).rows[0]||null;
    if(!user) user=(await pool.query('SELECT * FROM users WHERE handle=$1 LIMIT 1',[normalizeHandle(profile.handle)])).rows[0]||null;
    if(!user){
      const id=String(profile.id||crypto.randomUUID()), handle=normalizeHandle(profile.handle), email=normalizeEmail(profile.email||`${handle}@local.vox`), type=['Voter','Candidate','Serving Politician'].includes(profile.type)?profile.type:'Voter';
      const hp=hashPassword(suppliedPassword.length>=8?suppliedPassword:crypto.randomBytes(24).toString('base64url'));
      const inserted=await pool.query(`INSERT INTO users (id,name,handle,email,type,city,province,role,district,bio,messaging,friend_requests,read_receipts,typing_indicators,message_notifications,password_hash,password_salt,recovery_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,[id,String(profile.name).slice(0,80),handle,email,type,String(profile.city||'').slice(0,80),String(profile.province||'').slice(0,80),String(profile.role||'').slice(0,100),String(profile.district||'').slice(0,100),String(profile.bio||'').slice(0,240),profile.messaging||'everyone',profile.friendRequests||'qr',profile.readReceipts!==false,profile.typingIndicators!==false,profile.messageNotifications!==false,hp.passwordHash,hp.passwordSalt,hashValue(recoveryToken)]);
      user=inserted.rows[0];
    }else{
      if(suppliedPassword.length>=8 && !verifyPassword(suppliedPassword,user)){ const hp=hashPassword(suppliedPassword); await pool.query('UPDATE users SET password_hash=$1,password_salt=$2,recovery_hash=$3 WHERE id=$4',[hp.passwordHash,hp.passwordSalt,hashValue(recoveryToken),user.id]); }
      else await pool.query('UPDATE users SET recovery_hash=$1,name=$2,city=$3,province=$4,role=$5,district=$6,bio=$7 WHERE id=$8',[hashValue(recoveryToken),String(profile.name||user.name).slice(0,80),String(profile.city||user.city||'').slice(0,80),String(profile.province||user.province||'').slice(0,80),String(profile.role||user.role||'').slice(0,100),String(profile.district||user.district||'').slice(0,100),String(profile.bio||user.bio||'').slice(0,240),user.id]);
      user=await getUserById(user.id);
    }
    const token=createSession(user.id); res.json({token,recoveryToken,profile:sanitizeProfile(user)});
  } catch(e){ res.status(500).json({error:e.message||'Unable to restore account.'}); }
});

app.post('/api/auth/logout', requireAuth, (req,res)=>{ sessions.delete(getToken(req)); res.json({ok:true}); });
app.get('/api/auth/me', requireAuth, (req,res)=>res.json({profile:sanitizeProfile(req.user)}));
app.get('/api/profile/me', requireAuth, (req,res)=>res.json({profile:sanitizeProfile(req.user)}));
app.put('/api/profile/me', requireAuth, async (req,res)=>{
  try{
    const u=req.user, nextHandle=normalizeHandle(req.body?.handle||u.handle), dup=await pool.query('SELECT id FROM users WHERE handle=$1 AND id<>$2 LIMIT 1',[nextHandle,u.id]);
    if(dup.rows[0]) return res.status(409).json({error:'That username is already taken.'});
    await pool.query(`UPDATE users SET name=$1,handle=$2,city=$3,province=$4,role=$5,district=$6,bio=$7,messaging=$8,friend_requests=$9,read_receipts=$10,typing_indicators=$11,message_notifications=$12 WHERE id=$13`,[String(req.body?.name||u.name).trim().slice(0,80),nextHandle,String(req.body?.city||u.city||'').slice(0,80),String(req.body?.province||u.province||'').slice(0,80),String(req.body?.role||u.role||'').slice(0,100),String(req.body?.district||u.district||'').slice(0,100),String(req.body?.bio||'').slice(0,240),req.body?.messaging||u.messaging,req.body?.friendRequests||u.friend_requests,req.body?.readReceipts!==undefined?Boolean(req.body.readReceipts):u.read_receipts,req.body?.typingIndicators!==undefined?Boolean(req.body.typingIndicators):u.typing_indicators,req.body?.messageNotifications!==undefined?Boolean(req.body.messageNotifications):u.message_notifications,u.id]);
    res.json({profile:sanitizeProfile(await getUserById(u.id))});
  }catch(e){res.status(500).json({error:e.message||'Unable to save profile.'});}
});

app.get('/api/people/search', requireAuth, async (req,res)=>{ const raw=String(req.query?.q||'').trim(), q=normalizeHandle(raw); if(q.length<2) return res.json({people:[]}); const {rows}=await pool.query('SELECT * FROM users WHERE id<>$1 AND (handle ILIKE $2 OR name ILIKE $3) ORDER BY handle LIMIT 20',[req.user.id,`%${q}%`,`%${raw.toLowerCase()}%`]); res.json({people:rows.map(sanitizePublicProfile)}); });
app.post('/api/people/friends/request', requireAuth, async (req,res)=>{ const target=(await pool.query('SELECT * FROM users WHERE id=$1 OR handle=$2 LIMIT 1',[String(req.body?.userId||''),normalizeHandle(req.body?.handle||'')])).rows[0]; if(!target) return res.status(404).json({error:'User not found.'}); if(target.id===req.user.id) return res.status(400).json({error:'You cannot add yourself.'}); const existing=(await pool.query('SELECT id FROM friend_requests WHERE from_user_id=$1 AND to_user_id=$2 AND status=$3 LIMIT 1',[req.user.id,target.id,'pending'])).rows[0]; if(existing) return res.status(409).json({error:'Friend request already sent.'}); await pool.query('INSERT INTO friend_requests (id,from_user_id,to_user_id,status) VALUES ($1,$2,$3,$4)',[crypto.randomUUID(),req.user.id,target.id,'pending']); io.to(`user:${target.id}`).emit('friend:request',{from:sanitizePublicProfile(req.user)}); res.status(201).json({ok:true,message:`Friend request sent to @${target.handle}.`}); });

app.get('/api/people/inbox', requireAuth, async (req,res)=>{
  const {rows}=await pool.query(`SELECT DISTINCT ON (other_id) other_id,id,text,created_at,from_user_id,to_user_id FROM (SELECT CASE WHEN from_user_id=$1 THEN to_user_id ELSE from_user_id END AS other_id,* FROM direct_messages WHERE from_user_id=$1 OR to_user_id=$1) q ORDER BY other_id,created_at DESC`,[req.user.id]);
  const conversations=[]; for(const row of rows){const other=await getUserById(row.other_id); if(other) conversations.push({person:sanitizePublicProfile(other),lastMessage:{text:row.text,createdAt:row.created_at,mine:row.from_user_id===req.user.id}});} conversations.sort((a,b)=>new Date(b.lastMessage.createdAt)-new Date(a.lastMessage.createdAt)); res.json({conversations});
});
app.get('/api/people/messages/:handle', requireAuth, async (req,res)=>{ const target=(await pool.query('SELECT * FROM users WHERE handle=$1 LIMIT 1',[normalizeHandle(req.params.handle)])).rows[0]; if(!target) return res.status(404).json({error:'User not found.'}); const {rows}=await pool.query('SELECT * FROM direct_messages WHERE (from_user_id=$1 AND to_user_id=$2) OR (from_user_id=$2 AND to_user_id=$1) ORDER BY created_at ASC',[req.user.id,target.id]); res.json({person:sanitizePublicProfile(target),messages:rows.map(m=>({id:m.id,text:m.text,mine:m.from_user_id===req.user.id,createdAt:m.created_at}))}); });
app.post('/api/people/message', requireAuth, async (req,res)=>{ const target=(await pool.query('SELECT * FROM users WHERE id=$1 OR handle=$2 LIMIT 1',[String(req.body?.userId||''),normalizeHandle(req.body?.handle||'')])).rows[0], text=String(req.body?.text||'').trim().slice(0,4000); if(!target)return res.status(404).json({error:'User not found.'}); if(!text)return res.status(400).json({error:'Message cannot be empty.'}); if(target.id===req.user.id)return res.status(400).json({error:'You cannot message yourself.'}); const message={id:crypto.randomUUID(),fromUserId:req.user.id,toUserId:target.id,text,createdAt:new Date().toISOString()}; await pool.query('INSERT INTO direct_messages (id,from_user_id,to_user_id,text,created_at) VALUES ($1,$2,$3,$4,$5)',[message.id,message.fromUserId,message.toUserId,message.text,message.createdAt]); io.to(`user:${target.id}`).emit('people:message',{id:message.id,from:sanitizePublicProfile(req.user),to:sanitizePublicProfile(target),text,createdAt:message.createdAt}); res.status(201).json({ok:true,message:'Message sent.',item:message}); });

io.on('connection', socket=>{ socket.on('identify', async ({userId})=>{ if(!pool||!userId)return; const u=await getUserById(userId); if(u) socket.join(`user:${userId}`); }); });
if(fs.existsSync(distPath)) app.use((req,res,next)=>{ if(req.path.startsWith('/api/')||req.path.startsWith('/socket.io/')) return next(); res.sendFile(path.join(distPath,'index.html')); });
const PORT=Number(process.env.PORT||3001), HOST=process.env.HOST||'0.0.0.0';
(async()=>{ try{ if(pool) await initDb(); else console.warn('DATABASE_URL is not set.'); server.listen(PORT,HOST,()=>console.log(`Vox Mandate server running on http://${HOST}:${PORT}`)); }catch(e){ console.error('Database initialization failed:',e); process.exit(1); } })();
