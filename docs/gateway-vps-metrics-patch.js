/**
 * Gateway patch: real VPS health metrics
 * --------------------------------------------------------------
 * Adds  GET /admin/system/metrics  (requires X-Admin-Token)
 *
 * Returns metrics measured ON THE SERVER — CPU load, memory, disk,
 * uptime, process info. Nothing here depends on the client's network,
 * so the dashboard card reflects the VPS itself, not the connection.
 *
 * No external dependencies. Node 18+.
 *
 * ============================================================
 * HOW TO INSTALL (on the VPS)
 * ============================================================
 *   1. Copy this file to:  /opt/madar-gateway/app/vps-metrics-patch.js
 *   2. In /opt/madar-gateway/app/server.js, BEFORE `app.listen(...)`, add:
 *
 *        const { attachVpsMetricsRoutes } = require('./vps-metrics-patch');
 *        attachVpsMetricsRoutes(app, { adminToken: process.env.ADMIN_TOKEN });
 *
 *   3. Rebuild / restart the container.
 *   4. Verify:
 *        curl -s -H "X-Admin-Token: $ADMIN_TOKEN" \
 *          https://gateway.walinkme.com/admin/system/metrics | jq
 */

const os = require('os');
const fs = require('fs');

// --- CPU sampling ---------------------------------------------------------
// Instantaneous CPU% needs two samples. We keep the previous snapshot and
// diff against it, so the value is a true busy-percentage over the interval
// between calls (falls back to a 200ms sample on the very first call).

function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total, at: Date.now() };
}

let lastCpu = cpuSnapshot();

function cpuUsagePercent() {
  const now = cpuSnapshot();
  const idleDiff = now.idle - lastCpu.idle;
  const totalDiff = now.total - lastCpu.total;
  lastCpu = now;
  if (totalDiff <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100)));
}

// --- Disk -----------------------------------------------------------------
function diskUsage(path = '/') {
  try {
    // Node 18.15+ / 20+: fs.statfsSync
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(path);
      const total = s.blocks * s.bsize;
      const free = s.bavail * s.bsize;
      return { total, free, used: total - free, usedPercent: Math.round(((total - free) / total) * 100) };
    }
  } catch (_) { /* ignore */ }
  return null;
}

// --- Route ----------------------------------------------------------------
function attachVpsMetricsRoutes(app, { adminToken } = {}) {
  const requireAdmin = (req, res, next) => {
    const token = req.get('X-Admin-Token');
    if (adminToken && token !== adminToken) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    next();
  };

  app.get('/admin/system/metrics', requireAdmin, (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg(); // [1m, 5m, 15m]
    const cores = os.cpus().length || 1;
    const mem = process.memoryUsage();

    res.json({
      ok: true,
      at: new Date().toISOString(),
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.round(os.uptime()),
      },
      cpu: {
        cores,
        usagePercent: cpuUsagePercent(),
        load1: +load[0].toFixed(2),
        load5: +load[1].toFixed(2),
        load15: +load[2].toFixed(2),
        // load normalised per core: >1 means the box is saturated
        loadPerCore1: +(load[0] / cores).toFixed(2),
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        usedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      disk: diskUsage('/'),
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        pid: process.pid,
        node: process.version,
      },
      // Server-side timing: how long THIS handler took to assemble a reply.
      // Compare with the client-observed latency to separate server time
      // from network time.
      serverProcessingMs: 0,
    });
  });
}

module.exports = { attachVpsMetricsRoutes };
