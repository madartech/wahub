## Auto-Healing Watchdog for WhatsApp Gateway

Adds an automated monitor that detects stuck/unhealthy WAHA instances and recovers them safely, with strict safety defaults (auto-restart allowed once; auto-reset opt-in per instance).

---

### 1. Backend patch (`docs/gateway-watchdog-patch.js` — reference, not executed)

A new drop-in module to attach to `/opt/madar-gateway/app/server.js` alongside the existing operations patch.

**Persisted config in `store.json` (created if missing):**
```json
{
  "watchdog": {
    "enabled": false,
    "autoRestart": true,
    "autoReset": false,
    "stuckStartingMinutes": 3,
    "repeatedFailureWindowMinutes": 15,
    "intervalMinutes": 2,
    "adminAlertUserId": null
  },
  "watchdogUsers": {
    "<userId>": { "autoHeal": true, "autoReset": false, "failures": [], "lastAction": null }
  },
  "watchdogLogs": [ /* capped ring buffer, max 500 */ ]
}
```

**New endpoints (all `requireAdmin`):**

| Method | Path | Purpose |
|---|---|---|
| GET  | `/admin/watchdog/status` | global config + last run + per-user state |
| POST | `/admin/watchdog/config` | update global config (partial) |
| POST | `/admin/users/:id/watchdog-config` | `{autoHeal, autoReset}` per instance |
| POST | `/admin/watchdog/run-once` | force one watchdog tick now (testing) |
| GET  | `/admin/watchdog/logs?limit=100` | last N entries from ring buffer |

**Watchdog tick (every `intervalMinutes`, only if `enabled`):**

```text
for each user with instanceId and watchdogUsers[id].autoHeal !== false:
  status = await getInternalStatus(user)        // reuse existing status helper
  if status === 'WORKING' or 'READY': clear failures; continue
  if status === 'STARTING':
     stuckFor = now - statusChangedAt
     if stuckFor > stuckStartingMinutes:
        recentFail = failures within repeatedFailureWindowMinutes
        if recentFail.length === 0 and autoRestart:
           docker restart <container>     // reuse internal restart
           log('auto_restart_stuck_starting', WORKING_BEFORE→STARTING)
           failures.push({at:now, reason:'stuck_starting'})
        else if recentFail.length >= 1:
           if user.autoReset === true:
              docker rm -f <container>
              rm -rf /opt/madar-gateway/waha-sessions/<instanceId>
              log('auto_reset_repeated_failure')
              if adminAlertUserId: wahaSend(adminUser, "...needs QR")
           else:
              log('repeated_failure_no_action', reason='auto_reset_off')
```

**Safety guarantees enforced in code:**
- Never touches `WORKING` / `READY` instances.
- Never deletes user record or token (only container + that one session folder).
- Path validated to stay inside `SESSIONS_ROOT/<instanceId>` with `^[a-zA-Z0-9_-]+$`.
- All Docker calls via `execFile` arg arrays — no shell concatenation.
- No bulk operations: loop is per-instance, sequential, with try/catch isolation.
- `autoReset` defaults `false`. Global `enabled` defaults `false`.

**Log entry shape (`watchdogLogs[]`):**
```ts
{ id, instanceId, userId, action, reason, oldStatus, newStatus, result, details, createdAt }
```
Actions: `auto_restart_stuck_starting | auto_reset_repeated_failure | repeated_failure_no_action | skipped_working | check_error | manual_run`.

---

### 2. Frontend changes

**Types (`src/types/gateway.ts`)**
Add `WatchdogConfig`, `WatchdogUserConfig`, `WatchdogLogEntry`, `WatchdogStatusResponse`.

**Service (`src/services/gateway.ts`)**
Add (all via existing `_adminOp` so 404 → notDeployed):
- `getWatchdogStatus()`
- `updateWatchdogConfig(partial)`
- `setUserWatchdogConfig(userId, {autoHeal, autoReset})`
- `runWatchdogOnce()`
- `getWatchdogLogs(limit)`

**New page section in `src/pages/gateway/Operations.tsx`**

Add a collapsible "Watchdog" panel at the top of the page (above filters):

```text
┌─ Watchdog ──────────────────────────────────────────┐
│ [○ Enabled]  Interval: 2 min   Last run: 12:04:11   │
│ Defaults: auto-restart ON · auto-reset OFF          │
│ ⚠ Auto-reset disconnects WhatsApp and requires      │
│   scanning the QR again.                            │
│ [Run watchdog now]   [View logs]                    │
└─────────────────────────────────────────────────────┘
```

**New components:**
- `src/components/operations/WatchdogPanel.tsx` — global toggle, interval display, run-now, last run, link to logs. Shows the warning banner.
- `src/components/operations/WatchdogLogsDialog.tsx` — table of recent log entries (action, reason, instance, time, result). Refreshes on open.
- `src/components/operations/WatchdogBadges.tsx` — small badges:
  - `Auto-heal enabled` (slate)
  - `Restarted by watchdog` (amber, shown for 10 min after last auto restart)
  - `Repeated failure` (orange)
  - `Needs QR` (blue)
  - `Auto-reset disabled` (muted, only when repeated failure + autoReset off)

**Per-instance UI (extend `OperationsTable.tsx` and `OperationsCards.tsx`):**
Add a new column / card row "Watchdog" with two switches and live state:
```
Auto-heal  [●]
Auto-reset [○]   ⚠ destructive
Failures: 1  ·  Last action: auto_restart 12:02
```
Wired to `setUserWatchdogConfig`. Auto-reset switch shows a typed-confirm ("ENABLE") on first turn-on.

**Integration:**
- `Operations.tsx` polls `/admin/watchdog/status` alongside its existing 30s tick and merges `watchdogUsers[id]` into each row.
- Filter chips gain "Watchdog: failure" option.
- All watchdog fetches gracefully handle `notDeployed` and show "Watchdog backend not deployed yet — apply patch" inline (UI stays usable).

---

### 3. Files

**New**
- `docs/gateway-watchdog-patch.js`
- `src/components/operations/WatchdogPanel.tsx`
- `src/components/operations/WatchdogBadges.tsx`
- `src/components/operations/dialogs/WatchdogLogsDialog.tsx`

**Edited**
- `src/types/gateway.ts` — watchdog types
- `src/services/gateway.ts` — 5 new methods
- `src/pages/gateway/Operations.tsx` — render panel + merge state
- `src/components/operations/OperationsTable.tsx` — Watchdog column + badges
- `src/components/operations/OperationsCards.tsx` — Watchdog row + badges

No database, no Lovable Cloud, no audit table — config and logs live in `store.json` ring buffer (matches existing gateway storage pattern). No changes to existing operations endpoints or to user record schema.

---

### 4. Defaults shipped

```
global enabled: false      ← admin must turn on
autoRestart:    true       ← restart-once is safe
autoReset:      false      ← destructive, opt-in per instance
stuckStartingMinutes: 3
repeatedFailureWindowMinutes: 15
intervalMinutes: 2
```

After deploy: admin opens Operations → toggles watchdog ON → optionally enables auto-reset on selected instances after typed confirm.