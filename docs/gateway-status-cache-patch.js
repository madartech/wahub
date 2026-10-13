// Gateway add-on: fast bulk status for every account.
//
// GET /admin/users/statuses  ->  { ok, refreshedAt, statuses: { [id]: { status, me, updatedAt } } }
//
// A background loop refreshes every account's status (8 at a time) every 30s by
// calling this gateway's own per-user status route on localhost, and answers
// instantly from memory. A failed or timed-out check keeps the last known status,
// so one slow check no longer flips an account to "off".
//
// Install in server.js right ABOVE the `app.post("/admin/users", requireAdmin,` line:
//   require('./status-cache-patch').attachStatusCache(app, { auth: requireAdmin, listUsers: () => [...] });

const http = require('http');

function attachStatusCache(app, { auth, listUsers, port = 4000, intervalMs = 30_000, concurrency = 8 } = {}) {
  if (typeof listUsers !== 'function') throw new Error('attachStatusCache: listUsers required');
  const guard = typeof auth === 'function' ? auth : (q, s, n) => n();
  const cache = new Map(); // id -> { status, me, updatedAt }
  let adminToken = null;
  let refreshedAt = 0;
  let running = false;
  let timer = null;

  function getStatus(id) {
    return new Promise((resolve) => {
      const req = http.get({
        host: '127.0.0.1', port, path: `/admin/users/${encodeURIComponent(id)}/status`,
        headers: { 'X-Admin-Token': adminToken }, timeout: 20_000,
      }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            const d = JSON.parse(body);
            resolve({ status: (d.session && d.session.status) || d.status || 'UNKNOWN', me: d.me || null });
          } catch { resolve(null); }
        });
      });
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
    });
  }

  async function refresh() {
    if (running || !adminToken) return;
    running = true;
    try {
      const users = (await listUsers()) || [];
      const ids = new Set(users.map((u) => u.id));
      for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
      const queue = users.map((u) => u.id);
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        while (queue.length) {
          const id = queue.shift();
          const r = await getStatus(id);
          if (r) cache.set(id, { ...r, updatedAt: Date.now() });
          // r === null: keep the last known value
        }
      }));
      refreshedAt = Date.now();
    } catch (e) {
      console.error('[STATUS-CACHE] refresh failed', e);
    } finally {
      running = false;
    }
  }

  app.get('/admin/users/statuses', guard, async (req, res) => {
    adminToken = req.get('X-Admin-Token');
    if (!timer) {
      timer = setInterval(refresh, intervalMs);
      await refresh(); // first call warms the cache
    }
    const statuses = {};
    for (const [id, v] of cache) statuses[id] = v;
    res.json({ ok: true, refreshedAt, statuses });
  });

  // Let other routes push fresh results (e.g. after restart) — optional.
  return { refresh, cache };
}

module.exports = { attachStatusCache };
