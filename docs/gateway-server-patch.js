/**
 * WhatsApp Gateway Operations — Backend Patch
 * ============================================
 *
 * Drop-in patch for /opt/madar-gateway/app/server.js
 * Adds 9 new admin endpoints for the Operations admin panel.
 *
 * DEPLOY:
 *   cd /opt/madar-gateway && sudo docker compose up -d --build gateway
 *
 * REQUIREMENTS in your existing server.js:
 *   - express app `app`
 *   - middleware `requireAdmin` (validates X-Admin-Token)
 *   - helper `findUserById(id)`            -> user record or null
 *   - helper `wahaContainerName(instanceId)` -> e.g. `waha_${instanceId}`
 *   - helper `provisionUser(user)` (or equivalent) for re-provision in reset-session
 *   - persistence helpers `saveUser(user)` / `getUser(id)` for pause state
 *   - WAHA send proxy (existing /gateway/whatsapp/send logic) reusable as `wahaSend(user, {to, text})`
 *
 * SECURITY:
 *   - Container name comes ONLY from stored instanceId.
 *   - instanceId is validated against ^[a-zA-Z0-9_-]+$ before any FS/Docker call.
 *   - All shell calls use execFile with arg arrays — never shell-concatenated.
 *
 * RESPONSE CONTRACT:
 *   success: { ok: true, ... }
 *   error:   { ok: false, error: string, detail?: any }
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const pexecFile = promisify(execFile);

const SESSIONS_ROOT = '/opt/madar-gateway/waha-sessions';
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function safeInstanceId(instanceId) {
  if (!instanceId || typeof instanceId !== 'string' || !SAFE_ID_RE.test(instanceId)) {
    const err = new Error('invalid_instance_id');
    err.status = 400;
    throw err;
  }
  return instanceId;
}

async function dockerExists(container) {
  try {
    const { stdout } = await pexecFile('docker', ['ps', '-a', '--filter', `name=^${container}$`, '--format', '{{.Names}}']);
    return stdout.trim() === container;
  } catch {
    return false;
  }
}

function attachOperationRoutes({ app, requireAdmin, findUserById, wahaContainerName, provisionUser, saveUser, wahaSend }) {

  // ---- helper to load user + container safely ----
  async function loadCtx(req) {
    const user = await findUserById(req.params.id);
    if (!user) {
      const err = new Error('user_not_found');
      err.status = 404;
      throw err;
    }
    const instanceId = safeInstanceId(user.instanceId);
    const container = wahaContainerName(instanceId);
    return { user, instanceId, container };
  }

  function sendErr(res, err) {
    const status = err.status || 500;
    res.status(status).json({
      ok: false,
      error: err.code || err.message || 'internal_error',
      detail: err.stderr || err.stdout || String(err),
    });
  }

  // 1. RESTART
  app.post('/admin/users/:id/restart', requireAdmin, async (req, res) => {
    try {
      const { container } = await loadCtx(req);
      const { stdout, stderr } = await pexecFile('docker', ['restart', container]);
      res.json({ ok: true, container, stdout, stderr });
    } catch (e) { sendErr(res, e); }
  });

  // 2. STOP
  app.post('/admin/users/:id/stop', requireAdmin, async (req, res) => {
    try {
      const { container } = await loadCtx(req);
      const { stdout, stderr } = await pexecFile('docker', ['stop', container]);
      res.json({ ok: true, container, stdout, stderr });
    } catch (e) { sendErr(res, e); }
  });

  // 3. START
  app.post('/admin/users/:id/start', requireAdmin, async (req, res) => {
    try {
      const { container } = await loadCtx(req);
      const { stdout, stderr } = await pexecFile('docker', ['start', container]);
      res.json({ ok: true, container, stdout, stderr });
    } catch (e) { sendErr(res, e); }
  });

  // 4. REMOVE CONTAINER (keeps user record + session folder)
  app.post('/admin/users/:id/remove-container', requireAdmin, async (req, res) => {
    try {
      const { container } = await loadCtx(req);
      const { stdout, stderr } = await pexecFile('docker', ['rm', '-f', container]);
      res.json({ ok: true, container, stdout, stderr });
    } catch (e) { sendErr(res, e); }
  });

  // 5. RESET SESSION (rm container + delete session folder + reprovision)
  app.post('/admin/users/:id/reset-session', requireAdmin, async (req, res) => {
    try {
      const { user, instanceId, container } = await loadCtx(req);
      // Step 1: force-remove container (ignore if already gone)
      try { await pexecFile('docker', ['rm', '-f', container]); } catch (_) {}

      // Step 2: delete the session folder for THIS instance only
      const sessionDir = path.join(SESSIONS_ROOT, instanceId);
      // Validate path stays inside SESSIONS_ROOT
      const resolved = path.resolve(sessionDir);
      if (!resolved.startsWith(path.resolve(SESSIONS_ROOT) + path.sep)) {
        return res.status(400).json({ ok: false, error: 'invalid_session_path' });
      }
      try { await fs.rm(resolved, { recursive: true, force: true }); } catch (_) {}

      // Step 3: re-provision
      let provision = null;
      if (typeof provisionUser === 'function') {
        try { provision = await provisionUser(user); } catch (e) {
          return res.status(500).json({ ok: false, error: 'reprovision_failed', detail: String(e) });
        }
      }
      res.json({ ok: true, container, sessionDir: resolved, reprovisioned: !!provision, provision });
    } catch (e) { sendErr(res, e); }
  });

  // 6. PAUSE SENDING { minutes }
  app.post('/admin/users/:id/pause', requireAdmin, async (req, res) => {
    try {
      const { user } = await loadCtx(req);
      const minutes = Number(req.body && req.body.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60 * 24 * 30) {
        return res.status(400).json({ ok: false, error: 'invalid_minutes' });
      }
      user.pausedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
      if (typeof saveUser === 'function') await saveUser(user);
      res.json({ ok: true, pausedUntil: user.pausedUntil });
    } catch (e) { sendErr(res, e); }
  });

  // 7. RESUME
  app.post('/admin/users/:id/resume', requireAdmin, async (req, res) => {
    try {
      const { user } = await loadCtx(req);
      user.pausedUntil = null;
      if (typeof saveUser === 'function') await saveUser(user);
      res.json({ ok: true });
    } catch (e) { sendErr(res, e); }
  });

  // 8. TEST SEND { to, text }
  app.post('/admin/users/:id/test-send', requireAdmin, async (req, res) => {
    try {
      const { user } = await loadCtx(req);
      const to = String(req.body?.to || '').replace(/\D/g, '');
      const text = String(req.body?.text || '');
      if (!to || !text) return res.status(400).json({ ok: false, error: 'missing_to_or_text' });
      if (typeof wahaSend !== 'function') {
        return res.status(501).json({ ok: false, error: 'wahaSend_helper_missing' });
      }
      const result = await wahaSend(user, { to, text });
      res.json({ ok: true, waha: result });
    } catch (e) { sendErr(res, e); }
  });

  // 9. LOGS ?lines=100 (cap 300)
  app.get('/admin/users/:id/logs', requireAdmin, async (req, res) => {
    try {
      const { container } = await loadCtx(req);
      const requested = Number(req.query.lines || 100);
      const lines = Math.max(1, Math.min(300, Number.isFinite(requested) ? requested : 100));
      // Combine stdout+stderr from `docker logs`
      const child = execFile('docker', ['logs', '--tail', String(lines), container], { maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err && !stdout && !stderr) return sendErr(res, err);
        const raw = (stdout || '') + (stderr || '');
        res.json({ ok: true, container, lines: raw.split('\n'), raw });
      });
    } catch (e) { sendErr(res, e); }
  });
}

module.exports = { attachOperationRoutes };

/* ============================================================
 * USAGE in server.js:
 * ------------------------------------------------------------
 * const { attachOperationRoutes } = require('./gateway-server-patch');
 * attachOperationRoutes({
 *   app,
 *   requireAdmin,
 *   findUserById,
 *   wahaContainerName,
 *   provisionUser,        // existing reprovision logic
 *   saveUser,             // persists user record (for pause)
 *   wahaSend,             // (user, {to,text}) => Promise<wahaResult>
 * });
 * ============================================================
 */
