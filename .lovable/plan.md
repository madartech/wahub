## WhatsApp Gateway Operations — Admin Panel

A new Super Admin page at `/admin/operations` for managing WAHA user instances, plus a ready-to-deploy Node.js patch for the gateway server.

### 1. Frontend — new page

Route: `/admin/operations` (protected via existing `GatewayAuthContext`; current admin = Super Admin).

**Page layout**
- Header: title, global "Refresh now" button, auto-refresh indicator (every 30s, paused while QR/Logs modal open).
- Toolbar: search (name / instanceId / phone), filter chips (All • Healthy • Needs QR • Stuck • Offline • Paused).
- Desktop: dense table. Mobile (<768px): card list.

**Columns**
| Name | Instance | Container | Phone / Push name | Status | Health | Last activity | Sent (1m / 1h / 1d) | Paused until | Actions |

**Health badge logic (derived client-side)**
- `WORKING` → green Healthy
- `SCAN_QR_CODE` → blue Needs QR
- `STARTING` >3 min → orange Stuck starting
- container missing → red Container missing
- `FAILED` / `STOPPED` / `UNKNOWN` → gray Offline
- `pausedUntil` in future → purple Paused

**Row actions dropdown** (with confirmation modals where dangerous):
1. Health Check → `GET /admin/users/:id/status`
2. Get QR / Reconnect → `GET /admin/users/:id/qr-base64` (modal with refresh)
3. Provision → `POST /admin/users/:id/provision`
4. Restart → `POST /admin/users/:id/restart`
5. Stop → `POST /admin/users/:id/stop`
6. Start → `POST /admin/users/:id/start`
7. Remove Container → `POST /admin/users/:id/remove-container` (type `REMOVE`)
8. Reset Session → `POST /admin/users/:id/reset-session` (type `RESET`)
9. Pause Sending → `POST /admin/users/:id/pause` (minutes input)
10. Resume Sending → `POST /admin/users/:id/resume`
11. Test Send → `POST /admin/users/:id/test-send` ({to,text} modal)
12. Logs → `GET /admin/users/:id/logs?lines=100` (modal, copy button, capped 300)

**Smart hints (toast suggestions)**
- 422 + status `STARTING` → "Try Restart Instance".
- 2 consecutive failures on same instance → "Try Reset Session".

**Error handling** — every action shows a toast, plus a `<Collapsible>` "Show error detail" with raw JSON for admin debugging. 404 from new endpoints will display "Endpoint not deployed yet — apply backend patch" so the UI stays usable until the gateway is rebuilt.

**Safety**
- No bulk restart/reset (no multi-select).
- Tokens stay masked; admin token never rendered.
- Destructive actions require typed confirmation.

### 2. Files to add / change

**New**
- `src/pages/gateway/Operations.tsx` — page shell, search, filters, polling.
- `src/components/operations/OperationsTable.tsx` — desktop table.
- `src/components/operations/OperationsCard.tsx` — mobile card.
- `src/components/operations/HealthBadge.tsx`
- `src/components/operations/RowActions.tsx` — dropdown wiring all 12 actions.
- `src/components/operations/dialogs/` — `QrDialog`, `LogsDialog`, `TestSendDialog`, `PauseDialog`, `ConfirmTypedDialog` (REMOVE/RESET).
- `src/hooks/useGatewayPolling.ts` — 30s polling, pauseable.
- `docs/gateway-server-patch.js` — **reference-only** patch for `/opt/madar-gateway/app/server.js` (see §3). Not executed by Lovable.

**Edit**
- `src/services/gateway.ts` — add: `restart, stop, start, removeContainer, resetSession, pause, resume, testSend (admin), getLogs`. All include `X-Admin-Token`, return `{ok, error, detail}` shape.
- `src/types/gateway.ts` — extend `GatewayUser` with `containerName, pushName, lastActivityAt, pausedUntil, sendStats:{minute,hour,day}`; add `LogsResponse`, `OperationResponse`.
- `src/App.tsx` — add `/admin/operations` route under `ProtectedRoute`.
- `src/components/layout/GatewayLayout.tsx` — add "Operations" nav link.

### 3. Backend patch (`docs/gateway-server-patch.js`) — reference only

Drop-in file with all 9 new Express routes for `/opt/madar-gateway/app/server.js`. All use `requireAdmin`, derive container name only from stored `instanceId` via `wahaContainerName(instanceId)`, and use `child_process.execFile` with arg arrays — never shell concatenation.

```text
POST /admin/users/:id/restart           docker restart <container>
POST /admin/users/:id/stop              docker stop <container>
POST /admin/users/:id/start             docker start <container>
POST /admin/users/:id/remove-container  docker rm -f <container>
POST /admin/users/:id/reset-session     rm -f container → rm -rf /opt/madar-gateway/waha-sessions/<instanceId> → re-provision
POST /admin/users/:id/pause   {minutes} sets user.pausedUntil = now + minutes
POST /admin/users/:id/resume            clears user.pausedUntil
POST /admin/users/:id/test-send {to,text}  proxies through WAHA send
GET  /admin/users/:id/logs?lines=N      docker logs --tail min(N,300) <container>
```

Response contract for all: `{ok:true, ...}` or `{ok:false, error, detail}`. Session folder path hardcoded to `/opt/madar-gateway/waha-sessions/<instanceId>` and validated against `^[a-zA-Z0-9_-]+$` before any FS/Docker call.

Frontend will consume the additional fields (`containerName, pushName, lastActivityAt, pausedUntil, sendStats`) you confirmed `GET /admin/users` already returns.

### 4. Out of scope (per your answers)
- Audit logging (`gateway_action_logs` table) — skipped.
- Lovable Cloud / role tables — not added; existing admin login is treated as Super Admin.

### 5. Deployment note (Docker)
The gateway runs via Docker Compose, not PM2. After pasting `docs/gateway-server-patch.js` into your `server.js`, deploy with:

```bash
cd /opt/madar-gateway && sudo docker compose up -d --build gateway
```

Frontend ships immediately; the new endpoints will return 404 until you run the rebuild — the UI will show that gracefully so existing functionality keeps working.