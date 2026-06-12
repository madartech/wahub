/**
 * Gateway patch: per-user send counters (minute / hour / day)
 * --------------------------------------------------------------
 * Adds `sendStats: { minute, hour, day }` to every user object
 * returned by `GET /admin/users`. The numbers are rolling windows
 * computed from an in-memory timestamp log.
 *
 * Paste these snippets into your gateway server (waha admin
 * Node process). They have no external deps.
 *
 * Frontend consumes:
 *   - Dashboard "Sent Messages" card  (sum of sendStats.day)
 *   - Operations row detail            (sendStats.minute/hour/day)
 *
 * Persistence: in-memory only. A process restart resets counters.
 * If you want persistence, swap `sendLog` for a tiny JSON file
 * flushed on a debounce; the shape stays the same.
 */

// ============================================================
// 1) Add this near the top of your gateway server file
// ============================================================
const sendLog = new Map(); // userId -> number[] (epoch ms of each send)
const MINUTE = 60_000;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

function recordSend(userId) {
  if (!userId) return;
  const now = Date.now();
  const arr = sendLog.get(userId) || [];
  arr.push(now);
  // prune anything older than 1 day to keep memory bounded
  const cutoff = now - DAY;
  while (arr.length && arr[0] < cutoff) arr.shift();
  sendLog.set(userId, arr);
}

function getSendStats(userId) {
  const arr = sendLog.get(userId) || [];
  const now = Date.now();
  let m = 0, h = 0, d = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    const t = arr[i];
    if (t >= now - MINUTE) m++;
    if (t >= now - HOUR)   h++;
    if (t >= now - DAY)    d++;
    else break; // arr is ordered oldest -> newest
  }
  return { minute: m, hour: h, day: d };
}

// ============================================================
// 2) Inside your existing POST /gateway/whatsapp/send handler,
//    AFTER the upstream WAHA call succeeds, add:
// ============================================================
//
//    recordSend(user.id);
//
// Example (adapt variable names to your code):
//
//   app.post('/gateway/whatsapp/send', async (req, res) => {
//     const user = await resolveUserFromToken(req); // your existing logic
//     // ... call WAHA to send the message ...
//     if (wahaResponse.ok) {
//       recordSend(user.id);          // <-- add this line
//     }
//     res.json({ ok: true, ... });
//   });

// ============================================================
// 3) In your GET /admin/users handler, enrich each user with stats
// ============================================================
//
// Wherever you build the `users` array returned to the admin UI:
//
//   const users = rawUsers.map(u => ({
//     ...u,
//     sendStats: getSendStats(u.id),   // <-- add this line
//   }));
//   res.json({ ok: true, users });

// ============================================================
// 4) (Optional) Expose a single-user stats endpoint for live polling
// ============================================================
//
//   app.get('/admin/users/:id/send-stats', requireAdmin, (req, res) => {
//     res.json({ ok: true, stats: getSendStats(req.params.id) });
//   });

module.exports = { recordSend, getSendStats };
