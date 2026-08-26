/**
 * Gateway QR preparation coordinator
 * ==================================
 *
 * Copy to /opt/madar-gateway/app/gateway-qr-preparation-patch.js and attach
 * these routes INSTEAD OF the old blocking /provision and /qr-base64 routes.
 * Mount before the 404 handler.
 *
 * The injected helpers are the existing gateway internals:
 *   findUserById(id)          -> stored user or null
 *   ensureUserReady(user)     -> create/start/reuse container and start session
 *   fetchQrFromWaha(user)     -> one fast WAHA QR attempt; returns JSON
 *
 * Example:
 *   const { attachQrPreparationRoutes } = require('./gateway-qr-preparation-patch');
 *   const qrPreparation = attachQrPreparationRoutes({
 *     app,
 *     requireAdmin,
 *     findUserById,
 *     ensureUserReady,
 *     fetchQrFromWaha,
 *   });
 *
 * reset-session should call qrPreparation.invalidate(user.id), perform its
 * destructive reset, then qrPreparation.start(user). It must not wait for QR.
 */

const QR_ATTEMPT_INTERVAL_MS = 3_000;
const QR_JOB_MAX_MS = 120_000;
const QR_CACHE_TTL_MS = 120_000;

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
}

function normalizeDataUrl(result) {
  if (!result || typeof result !== 'object') return null;
  const value =
    result.dataUrl ||
    (result.qr && result.qr.dataUrl) ||
    (result.data ? `data:${result.mimetype || 'image/png'};base64,${result.data}` : null) ||
    (result.base64 ? `data:${result.mimetype || 'image/png'};base64,${result.base64}` : null) ||
    (typeof result.qr === 'string'
      ? (result.qr.startsWith('data:') ? result.qr : `data:image/png;base64,${result.qr}`)
      : null);
  return typeof value === 'string' && value.startsWith('data:image/') ? value : null;
}

function attachQrPreparationRoutes(options) {
  const {
    app,
    requireAdmin,
    findUserById,
    ensureUserReady,
    fetchQrFromWaha,
  } = options || {};

  if (!app || !findUserById || !ensureUserReady || !fetchQrFromWaha) {
    throw new Error('qr_preparation_helpers_missing');
  }

  const auth = requireAdmin || ((req, res, next) => next());
  const jobs = new Map();
  const cache = new Map();
  const generations = new Map();

  function getGeneration(userId) {
    return generations.get(userId) || 0;
  }

  function getCached(userId) {
    const entry = cache.get(userId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      cache.delete(userId);
      return null;
    }
    return entry;
  }

  function invalidate(userId) {
    cache.delete(userId);
    generations.set(userId, getGeneration(userId) + 1);
  }

  function start(user) {
    const userId = String(user.id);
    const existing = jobs.get(userId);
    const generation = getGeneration(userId);
    if (existing && existing.generation === generation) return existing;
    const state = {
      userId,
      startedAt: Date.now(),
      attempts: 0,
      lastError: null,
      generation,
      promise: null,
    };

    state.promise = Promise.resolve().then(async () => {
      while (
        getGeneration(userId) === generation &&
        Date.now() - state.startedAt < QR_JOB_MAX_MS
      ) {
        state.attempts += 1;
        try {
          await ensureUserReady(user);
          const result = await fetchQrFromWaha(user);
          const dataUrl = normalizeDataUrl(result);

          if (dataUrl) {
            cache.set(userId, {
              dataUrl,
              status: 'SCAN_QR_CODE',
              cachedAt: Date.now(),
              expiresAt: Date.now() + QR_CACHE_TTL_MS,
            });
            state.lastError = null;
            return;
          }

          const status = result && (result.status || (result.session && result.session.status));
          if (result && (result.alreadyConnected || status === 'WORKING' || status === 'READY')) {
            state.lastError = null;
            return;
          }
          state.lastError = result && (result.error || result.detail) || 'qr_starting';
        } catch (error) {
          state.lastError = error instanceof Error ? error.message : String(error);
        }

        const remaining = QR_JOB_MAX_MS - (Date.now() - state.startedAt);
        if (remaining > 0) await sleep(Math.min(QR_ATTEMPT_INTERVAL_MS, remaining));
      }
    }).catch((error) => {
      state.lastError = error instanceof Error ? error.message : String(error);
      console.error('[qr-preparation] job failed', { userId, error: state.lastError });
    }).finally(() => {
      if (jobs.get(userId) === state) jobs.delete(userId);
    });

    jobs.set(userId, state);
    return state;
  }

  async function loadUser(req, res) {
    try {
      const user = await findUserById(req.params.id);
      if (!user) {
        res.status(404).json({ ok: false, error: 'user_not_found' });
        return null;
      }
      return user;
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'user_lookup_failed',
      });
      return null;
    }
  }

  app.post('/admin/users/:id/provision', auth, async (req, res) => {
    const user = await loadUser(req, res);
    if (!user) return;
    invalidate(String(user.id));
    start(user);
    res.json({ ok: true, status: 'STARTING', qrPreparing: true });
  });

  app.get('/admin/users/:id/qr-base64', auth, async (req, res) => {
    const user = await loadUser(req, res);
    if (!user) return;
    const userId = String(user.id);
    const cached = getCached(userId);
    if (cached) {
      return res.json({
        ok: true,
        status: 'SCAN_QR_CODE',
        dataUrl: cached.dataUrl,
        cached: true,
      });
    }

    start(user);
    return res.json({
      ok: false,
      status: 'STARTING',
      error: 'qr_starting',
      retryAfterMs: QR_ATTEMPT_INTERVAL_MS,
    });
  });

  console.log('[qr-preparation] fast provision and cached QR routes attached');
  return { start, invalidate, getCached };
}

module.exports = {
  attachQrPreparationRoutes,
  QR_ATTEMPT_INTERVAL_MS,
  QR_JOB_MAX_MS,
  QR_CACHE_TTL_MS,
};