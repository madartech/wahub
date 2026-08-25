/**
 * gateway-proxy-patch.js
 * ----------------------------------------------------------------------------
 * Per-instance residential proxy support for the WAHA gateway.
 *
 * WHY: 56 WhatsApp sessions behind a single datacenter IP gets that IP flagged
 * and reset at the socket edge (g.whatsapp.net). Routing each WAHA container
 * through its own sticky residential IP spreads egress and removes the density
 * signal.
 *
 * SECURITY: the proxy password is NEVER stored in the panel or in this file.
 * It is read from the environment variable THORDATA_PROXY_PASSWORD on the host.
 *
 * ---------------------------------------------------------------------------
 * INSTALL (on the VPS)
 * ---------------------------------------------------------------------------
 * 1) Copy this file to /opt/madar-gateway/app/gateway-proxy-patch.js
 *
 * 2) Put the proxy password in the gateway environment. In
 *    /opt/madar-gateway/docker-compose.yml under the gateway service:
 *
 *      environment:
 *        - THORDATA_PROXY_PASSWORD=your_real_password_here
 *
 *    (or add it to a .env file next to docker-compose.yml)
 *
 * 3) In /opt/madar-gateway/app/server.js, near the other requires:
 *
 *      const { attachProxyRoutes, getProxyEnvForUser } = require('./gateway-proxy-patch');
 *
 * 4) After your body parsers, before app.listen(...):
 *
 *      attachProxyRoutes(app, {
 *        adminAuth,          // your existing X-Admin-Token middleware
 *        listUsers,          // () => array of user records
 *        getUser,            // (userId) => user record
 *        dataDir: DATA_DIR,  // where gateway persists json state
 *        containerNameFor,   // (user) => docker container name
 *      });
 *
 * 5) In the function that CREATES the WAHA container (provision), merge the
 *    proxy env vars into the container environment:
 *
 *      const proxyEnv = getProxyEnvForUser(user);
 *      // then when building docker run / compose args:
 *      Object.entries(proxyEnv).forEach(([k, v]) => args.push('-e', `${k}=${v}`));
 *
 *    WAHA reads these:
 *      WHATSAPP_PROXY_SERVER          host:port
 *      WHATSAPP_PROXY_SERVER_USERNAME username (with sessid segment)
 *      WHATSAPP_PROXY_SERVER_PASSWORD password
 *
 * 6) Rebuild:
 *      cd /opt/madar-gateway && sudo docker compose up -d --build gateway
 *
 * NOTE: changing an instance's proxy only takes effect after the container is
 * recreated. The panel calls /restart for you, but a full re-provision is the
 * reliable path.
 * ---------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const STORE_FILE = 'proxy-config.json';

/* ------------------------------- store ---------------------------------- */

function storePath(dataDir) {
  return path.join(dataDir || '/data', STORE_FILE);
}

function readStore(dataDir) {
  try {
    const raw = fs.readFileSync(storePath(dataDir), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      defaults: parsed.defaults || null,
      users: parsed.users || {},
    };
  } catch {
    return { defaults: null, users: {} };
  }
}

function writeStore(dataDir, store) {
  const p = storePath(dataDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
}

// module-level cache so getProxyEnvForUser() works without async plumbing
let CACHED_DATA_DIR = '/data';

/* ---------------------------- username build ---------------------------- */

function deriveSessId(user) {
  const raw = String((user && (user.instanceId || user.id)) || '');
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return ('wa' + (clean || 'x')).slice(0, 24);
}

function buildUsername(cfg, sessId) {
  const parts = [cfg.usernameBase];
  if (cfg.country) parts.push('country-' + String(cfg.country).toUpperCase());
  if (cfg.extraSegments) parts.push(String(cfg.extraSegments).replace(/^-+|-+$/g, ''));
  parts.push('sessid-' + sessId);
  parts.push('sesstime-' + (cfg.sessTime || 90));
  return parts.join('-');
}

/**
 * Resolve the effective proxy config for a user:
 * per-user override -> global defaults -> disabled.
 */
function resolveConfig(user, dataDir) {
  const store = readStore(dataDir || CACHED_DATA_DIR);
  const perUser = store.users[user.id];
  if (perUser && perUser.enabled === false) return null; // explicit opt-out
  const base = perUser && perUser.host ? perUser : store.defaults;
  if (!base || !base.enabled) return null;
  const sessId = (perUser && perUser.sessId) || deriveSessId(user);
  return {
    host: base.host,
    port: base.port || 9999,
    sessId,
    username: buildUsername(base, sessId),
  };
}

/**
 * Env vars to inject into the WAHA container. Returns {} when no proxy is set,
 * so it is always safe to spread into the container environment.
 */
function getProxyEnvForUser(user, dataDir) {
  const cfg = resolveConfig(user, dataDir);
  if (!cfg) return {};
  const password = process.env.THORDATA_PROXY_PASSWORD || '';
  if (!password) {
    console.warn('[proxy] THORDATA_PROXY_PASSWORD not set — skipping proxy for', user.id);
    return {};
  }
  return {
    WHATSAPP_PROXY_SERVER: `${cfg.host}:${cfg.port}`,
    WHATSAPP_PROXY_SERVER_USERNAME: cfg.username,
    WHATSAPP_PROXY_SERVER_PASSWORD: password,
  };
}

/* ------------------------------- egress IP ------------------------------ */

// Native HTTP request through the proxy (no `curl` binary in the container).
function curlThroughProxy(cfg, cb) {
  const password = process.env.THORDATA_PROXY_PASSWORD || '';
  if (!password) return cb(new Error('THORDATA_PROXY_PASSWORD not set'));
  const auth = Buffer.from(`${cfg.username}:${password}`).toString('base64');
  const req = http.request(
    {
      host: cfg.host,
      port: cfg.port,
      method: 'GET',
      path: 'http://ip-api.com/json',
      headers: {
        Host: 'ip-api.com',
        'Proxy-Authorization': 'Basic ' + auth,
        'User-Agent': 'madar-gateway',
      },
      timeout: 25000,
    },
    (resp) => {
      let body = '';
      resp.on('data', (d) => {
        body += d;
      });
      resp.on('end', () => {
        if (resp.statusCode !== 200) {
          return cb(new Error(`proxy responded ${resp.statusCode}: ${body.slice(0, 200)}`));
        }
        try {
          cb(null, JSON.parse(body));
        } catch {
          cb(null, { raw: String(body).slice(0, 500) });
        }
      });
    },
  );
  req.on('timeout', () => req.destroy(new Error('proxy request timed out')));
  req.on('error', (e) => cb(e));
  req.end();
}


/* -------------------------------- routes -------------------------------- */

function attachProxyRoutes(app, opts) {
  const {
    adminAuth,
    listUsers,
    getUser,
    dataDir = '/data',
  } = opts || {};

  CACHED_DATA_DIR = dataDir;

  const auth = adminAuth || ((req, res, next) => next());
  const noPass = (o) => o; // config never contains a password

  // --- global defaults -----------------------------------------------------
  app.get('/admin/proxy/defaults', auth, (req, res) => {
    const store = readStore(dataDir);
    res.json({
      ok: true,
      defaults: noPass(store.defaults),
      passwordConfigured: Boolean(process.env.THORDATA_PROXY_PASSWORD),
    });
  });

  app.post('/admin/proxy/defaults', auth, (req, res) => {
    const b = req.body || {};
    if (b.enabled && (!b.host || !b.usernameBase)) {
      return res.status(400).json({ ok: false, error: 'host and usernameBase are required' });
    }
    const store = readStore(dataDir);
    store.defaults = {
      enabled: Boolean(b.enabled),
      host: String(b.host || ''),
      port: Number(b.port) || 9999,
      usernameBase: String(b.usernameBase || ''),
      country: String(b.country || ''),
      sessTime: Math.min(90, Math.max(1, Number(b.sessTime) || 90)),
      extraSegments: String(b.extraSegments || ''),
    };
    writeStore(dataDir, store);
    res.json({ ok: true, defaults: store.defaults });
  });

  // --- per-user config -----------------------------------------------------
  app.get('/admin/users/:id/proxy', auth, (req, res) => {
    const user = getUser ? getUser(req.params.id) : { id: req.params.id };
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    const store = readStore(dataDir);
    const resolved = resolveConfig(user, dataDir);
    res.json({
      ok: true,
      override: store.users[user.id] || null,
      effective: resolved
        ? { host: resolved.host, port: resolved.port, sessId: resolved.sessId, username: resolved.username }
        : null,
    });
  });

  app.post('/admin/users/:id/proxy', auth, (req, res) => {
    const user = getUser ? getUser(req.params.id) : { id: req.params.id };
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    const b = req.body || {};
    const store = readStore(dataDir);

    if (b.clear) {
      delete store.users[user.id];
      writeStore(dataDir, store);
      return res.json({ ok: true, cleared: true });
    }

    store.users[user.id] = {
      enabled: b.enabled !== false,
      host: b.host ? String(b.host) : undefined,
      port: b.port ? Number(b.port) : undefined,
      usernameBase: b.usernameBase ? String(b.usernameBase) : undefined,
      country: b.country !== undefined ? String(b.country) : undefined,
      sessTime: b.sessTime ? Math.min(90, Math.max(1, Number(b.sessTime))) : undefined,
      extraSegments: b.extraSegments !== undefined ? String(b.extraSegments) : undefined,
      sessId: b.sessId ? String(b.sessId).replace(/[^a-zA-Z0-9]/g, '') : undefined,
    };
    Object.keys(store.users[user.id]).forEach(
      (k) => store.users[user.id][k] === undefined && delete store.users[user.id][k],
    );
    writeStore(dataDir, store);
    res.json({
      ok: true,
      override: store.users[user.id],
      note: 'Recreate or restart the container for this to take effect.',
    });
  });

  // --- egress IP readout ---------------------------------------------------
  app.get('/admin/users/:id/egress-ip', auth, (req, res) => {
    const user = getUser ? getUser(req.params.id) : { id: req.params.id };
    if (!user) return res.status(404).json({ ok: false, error: 'user not found' });
    const cfg = resolveConfig(user, dataDir);
    if (!cfg) return res.json({ ok: true, proxied: false, ip: null });
    curlThroughProxy(cfg, (err, info) => {
      if (err) return res.status(502).json({ ok: false, error: err.message });
      res.json({ ok: true, proxied: true, sessId: cfg.sessId, info });
    });
  });

  // --- bulk assign: give every user a stable sessid ------------------------
  app.post('/admin/proxy/bulk-assign', auth, (req, res) => {
    if (!listUsers) return res.status(500).json({ ok: false, error: 'listUsers not wired' });
    const store = readStore(dataDir);
    if (!store.defaults || !store.defaults.enabled) {
      return res.status(400).json({ ok: false, error: 'Set and enable global proxy defaults first' });
    }
    const users = listUsers() || [];
    const assigned = [];
    users.forEach((u) => {
      const sessId = deriveSessId(u);
      store.users[u.id] = Object.assign({}, store.users[u.id], { enabled: true, sessId });
      assigned.push({ id: u.id, sessId });
    });
    writeStore(dataDir, store);
    res.json({ ok: true, count: assigned.length, assigned });
  });

  console.log('[proxy] routes attached');
}

module.exports = { attachProxyRoutes, getProxyEnvForUser, deriveSessId, buildUsername };
