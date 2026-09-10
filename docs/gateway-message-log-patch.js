/**
 * Gateway patch: per-message send log (metadata only, no message text)
 * --------------------------------------------------------------------
 * Records one row per successful send: user, sender phone, recipient
 * phone, timestamp. Message CONTENT is never stored.
 *
 * Exposes:
 *   GET /admin/messages/log?page=1&pageSize=15&sort=at&dir=desc&q=<search>
 *     -> { ok:true, rows:[{id,userId,userName,from,to,at}], total, page, pageSize }
 *
 * Storage: JSON file on disk (default /data/message-log.json inside the
 * container, falls back to ./message-log.json), capped at MAX_ROWS.
 *
 * INSTALL (on the VPS):
 *   1) sudo tee /opt/madar-gateway/app/message-log-patch.js  <<'EOF' ... EOF
 *      (paste this whole file)
 *   2) In /opt/madar-gateway/app/server.js, BEFORE the catch-all
 *      `app.use((req, res) => jsonFail(res, 404, "not_found"));` line add:
 *
 *        const { attachMessageLogRoutes, recordMessage } = require('./message-log-patch');
 *        attachMessageLogRoutes(app, { adminToken: process.env.ADMIN_TOKEN });
 *        global.recordMessage = recordMessage;
 *
 *   3) In the send handler (POST /gateway/whatsapp/send and the admin
 *      test-send), after the upstream WAHA call succeeds add:
 *
 *        global.recordMessage?.({
 *          userId: user.id,
 *          userName: user.name,
 *          from: user.phone || session?.me?.id,
 *          to: req.body.to,
 *        });
 *
 *   4) cd /opt/madar-gateway && sudo docker compose up -d --build
 */

const fs = require('fs');
const path = require('path');

const MAX_ROWS = 20000;
const FILE = fs.existsSync('/data')
  ? '/data/message-log.json'
  : path.join(__dirname, 'message-log.json');

let rows = [];
try {
  rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(rows)) rows = [];
} catch (_) {
  rows = [];
}

let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      fs.writeFileSync(FILE, JSON.stringify(rows));
    } catch (_) {
      /* disk issues must never break sending */
    }
  }, 1500);
}

function normalizePhone(v) {
  if (!v) return '';
  return String(v).replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/[^\d+]/g, '');
}

/** Record one successful send. Never stores message body. */
function recordMessage(entry) {
  if (!entry) return;
  rows.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: entry.userId || '',
    userName: entry.userName || '',
    from: normalizePhone(entry.from),
    to: normalizePhone(entry.to),
    at: new Date().toISOString(),
  });
  if (rows.length > MAX_ROWS) rows.splice(0, rows.length - MAX_ROWS);
  scheduleFlush();
}

function attachMessageLogRoutes(app, opts = {}) {
  const adminToken = opts.adminToken;

  const auth = (req, res, next) => {
    if (adminToken && req.get('X-Admin-Token') !== adminToken) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    next();
  };

  app.get('/admin/messages/log', auth, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 15));
    const sort = ['at', 'from', 'to', 'userName'].includes(req.query.sort)
      ? req.query.sort
      : 'at';
    const dir = req.query.dir === 'asc' ? 1 : -1;
    const q = String(req.query.q || '').trim().toLowerCase();

    let list = rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.from.includes(q) ||
          r.to.includes(q) ||
          (r.userName || '').toLowerCase().includes(q),
      );
    }
    list = list.slice().sort((a, b) => {
      const av = String(a[sort] || '');
      const bv = String(b[sort] || '');
      return av < bv ? -dir : av > bv ? dir : 0;
    });

    const total = list.length;
    const start = (page - 1) * pageSize;
    res.json({
      ok: true,
      rows: list.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    });
  });
}

module.exports = { attachMessageLogRoutes, recordMessage };
