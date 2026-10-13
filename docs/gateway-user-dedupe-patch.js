// Gateway add-on: block duplicate accounts at the server (idempotent create).
// Any client (this dashboard, onboarding bots, other apps) calling
// POST /admin/users with a name that already exists gets the EXISTING account
// back (same id/token) instead of a new one. Concurrent requests for the same
// name are serialized so double-submits/retries cannot race.
//
// Install in /opt/madar-gateway/app/server.js BEFORE the existing
// `app.post('/admin/users', ...)` route:
//
//   const { attachUserDedupe } = require('./user-dedupe-patch');
//   attachUserDedupe(app, { auth: requireAdmin, listUsers: () => <your function returning the users array> });
//
// `listUsers` may be sync or async and must return [{ id, name, token, instanceId }].

function norm(s) {
  return String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function attachUserDedupe(app, { listUsers, gatewayUrl, auth } = {}) {
  if (typeof listUsers !== 'function') throw new Error('attachUserDedupe: listUsers required');
  const pending = new Map(); // name -> Promise that resolves when the in-flight create finishes

  const guard = typeof auth === 'function' ? auth : (req, res, next) => next();
  app.post('/admin/users', guard, async (req, res, next) => {
    const key = norm(req.body && req.body.name);
    if (!key) return next();

    // Wait for any in-flight create of the same name, then re-check.
    while (pending.has(key)) {
      try { await pending.get(key); } catch { /* ignore */ }
    }

    try {
      const users = (await listUsers()) || [];
      const existing = users.find((u) => norm(u.name) === key);
      if (existing) {
        console.info('[DEDUPE] returning existing user for', key, existing.id);
        // Same shape as a normal create ({ ok, user, token }) so existing clients
        // (e.g. CardPro) read it the same way; flat fields kept for compatibility.
        return res.status(200).json({
          ok: true,
          duplicate: true,
          user: { id: existing.id, name: existing.name, instanceId: existing.instanceId },
          token: existing.token,
          id: existing.id,
          name: existing.name,
          instanceId: existing.instanceId,
          gatewayUrl: gatewayUrl || undefined,
        });
      }
    } catch (e) {
      console.error('[DEDUPE] lookup failed, allowing create', e);
      return next();
    }

    let done;
    pending.set(key, new Promise((r) => { done = r; }));
    const release = () => { if (pending.get(key)) { pending.delete(key); done(); } };
    res.on('finish', release);
    res.on('close', release);
    next();
  });
}

module.exports = { attachUserDedupe };
