const http = require('http');
const { Pool } = require('pg');

const DELETE_KEY = 'VoxDelete-7mQ4-2026';
const originalCreateServer = http.createServer;
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 })
  : null;

http.createServer = function (listener) {
  const wrapped = async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/admin/delete-account') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          if (req.headers['x-delete-key'] !== DELETE_KEY) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Forbidden.' }));
          }
          if (!db) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Database is not configured.' }));
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const email = String(body.email || '').trim().toLowerCase();
          const handle = String(body.handle || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 32);
          if (!email && !handle) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Email or username is required.' }));
          }
          const found = (await db.query('SELECT id, handle, email FROM users WHERE handle=$1 OR email=$2 LIMIT 1', [handle, email])).rows[0];
          if (!found) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Account not found.' }));
          }
          await db.query('DELETE FROM users WHERE id=$1', [found.id]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, deleted: { handle: found.handle, email: found.email } }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message || 'Unable to delete account.' }));
        }
      });
      return;
    }
    return listener(req, res);
  };
  return originalCreateServer.call(http, wrapped);
};
