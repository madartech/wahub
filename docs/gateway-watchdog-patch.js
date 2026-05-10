/**
 * WhatsApp Gateway — Auto-Healing Watchdog Patch
 * ==============================================
 *
 * Drop-in patch for /opt/madar-gateway/app/server.js
 * Adds 5 admin endpoints + a periodic watchdog that monitors every WAHA
 * instance and recovers stuck/failed sessions safely.
 *
 * DEPLOY:
 *   cd /opt/madar-gateway && sudo docker compose up -d --build gateway
 *
 * REQUIREMENTS in your existing server.js:
 *   - express app `app`
 *   - middleware `requireAdmin` (validates X-Admin-Token)
 *   - helper `listUsers()`               -> all user records (or use storage object)
 *   - helper `findUserById(id)`          -> user record or null
 *   - helper `wahaContainerName(instId)` -> container name from instanceId
 *   - helper `getInternalStatus(user)`   -> { status: 'WORKING'|'STARTING'|... , statusChangedAt }
 *   - helper `provisionUser(user)`       -> reprovision after reset
 *   - helper `wahaSend(user,{to,text})`  -> for admin WhatsApp alerts
 *   - persistence: a JSON store (`store`) you read/write to /opt/madar-gateway/store.json
 *
 * SAFETY GUARANTEES:
 *   - Never touches WORKING/READY instances.
 *   - Never deletes user record or token. Reset only removes container + that
 *     instance's session folder.
 *   - All Docker/FS calls use execFile arg arrays — no shell concatenation.
 *   - Auto-reset is opt-in per instance (default OFF). Global enabled default OFF.
 *   - No bulk operations: per-instance loop with try/catch isolation.
 *
 * RESPONSE CONTRACT:
 *   success: { ok: true, ... }
 *   error:   { ok: false, error: string, detail?: any }
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const pexecFile = promisify(execFile);
const SESSIONS_ROOT = '/opt/madar-gateway/waha-sessions';
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const LOG_RING_MAX = 500;

const DEFAULT_CONFIG = {
  enabled: false,
  autoRestart: true,
  autoReset: false,
  stuckStartingMinutes: 3,
  repeatedFailureWindowMinutes: 15,
  intervalMinutes: 2,
  adminAlertUserId: null,
};

function attachWatchdog({
  app,
  requireAdmin,
  listUsers,
  findUserById,
  wahaContainerName,
  getInternalStatus,
  provisionUser,
  wahaSend,
  store,        // mutable object persisted to store.json
  saveStore,    // () => Promise<void>
}) {
  // ---- bootstrap state in store ----
  store.watchdog = { ...DEFAULT_CONFIG, ...(store.watchdog || {}) };
  store.watchdogUsers = store.watchdogUsers || {};
  store.watchdogLogs = store.watchdogLogs || [];
  let lastRunAt = null;
  let timer = null;

  function getUserCfg(userId) {
    if (!store.watchdogUsers[userId]) {
      store.watchdogUsers[userId] = { autoHeal: true, autoReset: false, failures: [], lastAction: null };
    }
    return store.watchdogUsers[userId];
  }

  async function appendLog(entry) {
    const e = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    store.watchdogLogs.push(e);
    if (store.watchdogLogs.length > LOG_RING_MAX) {
      store.watchdogLogs.splice(0, store.watchdogLogs.length - LOG_RING_MAX);
    }
    try { await saveStore(); } catch (_) {}
    return e;
  }

  function safeInstanceId(instanceId) {
    if (!instanceId || typeof instanceId !== 'string' || !SAFE_ID_RE.test(instanceId)) {
      throw Object.assign(new Error('invalid_instance_id'), { status: 400 });
    }
    return instanceId;
  }

  async function dockerRestart(container) {
    return pexecFile('docker', ['restart', container]);
  }
  async function dockerRm(container) {
    return pexecFile('docker', ['rm', '-f', container]);
  }
  async function rmSessionDir(instanceId) {
    const dir = path.join(SESSIONS_ROOT, instanceId);
    const resolved = path.resolve(dir);
    if (!resolved.startsWith(path.resolve(SESSIONS_ROOT) + path.sep)) {
      throw new Error('invalid_session_path');
    }
    await fs.rm(resolved, { recursive: true, force: true });
    return resolved;
  }

  // ---- the watchdog tick ----
  async function runOnce({ manual = false } = {}) {
    lastRunAt = new Date().toISOString();
    const cfg = store.watchdog;
    const users = await listUsers();

    for (const user of users) {
      try {
        if (!user.instanceId) continue;
        const ucfg = getUserCfg(user.id);
        if (ucfg.autoHeal === false) continue;

        const instanceId = safeInstanceId(user.instanceId);
        const container = wahaContainerName(instanceId);

        let s;
        try {
          s = await getInternalStatus(user);
        } catch (e) {
          await appendLog({
            instanceId, userId: user.id, action: 'check_error',
            reason: 'status_check_failed', result: 'error', details: String(e),
          });
          continue;
        }

        const status = (s && s.status) || 'UNKNOWN';
        const statusChangedAt = s && s.statusChangedAt
          ? new Date(s.statusChangedAt).getTime() : 0;

        // Never touch healthy sessions; clear failure history
        if (status === 'WORKING' || status === 'READY') {
          if (ucfg.failures && ucfg.failures.length) {
            ucfg.failures = [];
            await saveStore();
          }
          continue;
        }

        if (status !== 'STARTING') continue;

        const stuckForMs = statusChangedAt ? Date.now() - statusChangedAt : 0;
        if (stuckForMs <= cfg.stuckStartingMinutes * 60_000) continue;

        // Prune old failures outside repeated-failure window
        const windowMs = cfg.repeatedFailureWindowMinutes * 60_000;
        ucfg.failures = (ucfg.failures || [])
          .filter(f => Date.now() - new Date(f.at).getTime() <= windowMs);

        if (ucfg.failures.length === 0) {
          if (!cfg.autoRestart) continue;
          try {
            await dockerRestart(container);
            ucfg.failures.push({ at: new Date().toISOString(), reason: 'stuck_starting' });
            ucfg.lastAction = { action: 'auto_restart_stuck_starting', at: new Date().toISOString() };
            await saveStore();
            await appendLog({
              instanceId, userId: user.id,
              action: 'auto_restart_stuck_starting',
              reason: `stuck_for_${Math.round(stuckForMs/60000)}m`,
              oldStatus: 'STARTING', newStatus: 'RESTARTING', result: 'ok',
            });
          } catch (e) {
            await appendLog({
              instanceId, userId: user.id, action: 'auto_restart_stuck_starting',
              reason: 'docker_restart_failed', result: 'error', details: String(e),
            });
          }
        } else {
          // Repeated failure
          if (ucfg.autoReset === true) {
            try {
              try { await dockerRm(container); } catch (_) {}
              const sessionDir = await rmSessionDir(instanceId);
              ucfg.lastAction = { action: 'auto_reset_repeated_failure', at: new Date().toISOString() };
              ucfg.failures = [];
              await saveStore();
              await appendLog({
                instanceId, userId: user.id,
                action: 'auto_reset_repeated_failure',
                reason: 'repeated_starting_within_window',
                oldStatus: 'STARTING', newStatus: 'NEEDS_QR',
                result: 'ok', details: { sessionDir },
              });
              if (cfg.adminAlertUserId && typeof wahaSend === 'function') {
                try {
                  const admin = await findUserById(cfg.adminAlertUserId);
                  if (admin) {
                    await wahaSend(admin, {
                      to: '', // caller-side default to admin's own phone if needed
                      text: `⚠ Watchdog auto-reset: ${user.name || user.id} needs QR reconnect.`,
                    });
                  }
                } catch (_) {}
              }
            } catch (e) {
              await appendLog({
                instanceId, userId: user.id, action: 'auto_reset_repeated_failure',
                reason: 'reset_failed', result: 'error', details: String(e),
              });
            }
          } else {
            await appendLog({
              instanceId, userId: user.id,
              action: 'repeated_failure_no_action',
              reason: 'auto_reset_off',
              oldStatus: 'STARTING', newStatus: 'STARTING', result: 'noop',
            });
          }
        }
      } catch (e) {
        await appendLog({
          userId: user && user.id, action: 'check_error',
          reason: 'unexpected', result: 'error', details: String(e),
        });
      }
    }

    if (manual) {
      await appendLog({ action: 'manual_run', result: 'ok' });
    }
  }

  function reschedule() {
    if (timer) { clearInterval(timer); timer = null; }
    if (!store.watchdog.enabled) return;
    const ms = Math.max(30_000, (store.watchdog.intervalMinutes || 2) * 60_000);
    timer = setInterval(() => { runOnce().catch(() => {}); }, ms);
  }
  reschedule();

  // ---- routes ----
  app.get('/admin/watchdog/status', requireAdmin, (req, res) => {
    res.json({
      ok: true,
      config: store.watchdog,
      lastRunAt,
      users: store.watchdogUsers,
    });
  });

  app.post('/admin/watchdog/config', requireAdmin, async (req, res) => {
    const allowed = ['enabled','autoRestart','autoReset','stuckStartingMinutes','repeatedFailureWindowMinutes','intervalMinutes','adminAlertUserId'];
    const patch = {};
    for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
    // Coerce/validate
    if ('stuckStartingMinutes' in patch) patch.stuckStartingMinutes = Math.max(1, Math.min(60, Number(patch.stuckStartingMinutes) || 3));
    if ('repeatedFailureWindowMinutes' in patch) patch.repeatedFailureWindowMinutes = Math.max(1, Math.min(720, Number(patch.repeatedFailureWindowMinutes) || 15));
    if ('intervalMinutes' in patch) patch.intervalMinutes = Math.max(1, Math.min(60, Number(patch.intervalMinutes) || 2));
    store.watchdog = { ...store.watchdog, ...patch };
    await saveStore();
    reschedule();
    res.json({ ok: true, config: store.watchdog });
  });

  app.post('/admin/users/:id/watchdog-config', requireAdmin, async (req, res) => {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'user_not_found' });
    const ucfg = getUserCfg(user.id);
    if (typeof req.body?.autoHeal === 'boolean') ucfg.autoHeal = req.body.autoHeal;
    if (typeof req.body?.autoReset === 'boolean') ucfg.autoReset = req.body.autoReset;
    await saveStore();
    res.json({ ok: true, config: ucfg });
  });

  app.post('/admin/watchdog/run-once', requireAdmin, async (req, res) => {
    try {
      await runOnce({ manual: true });
      res.json({ ok: true, lastRunAt });
    } catch (e) {
      res.status(500).json({ ok: false, error: 'run_failed', detail: String(e) });
    }
  });

  app.get('/admin/watchdog/logs', requireAdmin, (req, res) => {
    const limit = Math.max(1, Math.min(LOG_RING_MAX, Number(req.query.limit) || 100));
    const logs = store.watchdogLogs.slice(-limit).reverse();
    res.json({ ok: true, logs });
  });
}

module.exports = { attachWatchdog };

/* ============================================================
 * USAGE in server.js:
 * ------------------------------------------------------------
 * const { attachWatchdog } = require('./gateway-watchdog-patch');
 * attachWatchdog({
 *   app, requireAdmin, listUsers, findUserById,
 *   wahaContainerName, getInternalStatus,
 *   provisionUser, wahaSend,
 *   store,          // your in-memory store backed by store.json
 *   saveStore,      // async () => fs.writeFile('/opt/madar-gateway/store.json', JSON.stringify(store))
 * });
 * ============================================================
 */
