# Fix fake admin login

Right now the login screen accepts any non-empty email and password. This change makes it accept only one configured admin credential pair.

## Changes

1. `src/config/gateway.ts` — add two exported constants after `ADMIN_TOKEN`:
   - `ADMIN_EMAIL` (default `admin@walinkme.com`, override via `VITE_GATEWAY_ADMIN_EMAIL`)
   - `ADMIN_LOGIN_PASSWORD` (default `@dmin142242`, override via `VITE_GATEWAY_ADMIN_PASSWORD`)

2. `src/contexts/GatewayAuthContext.tsx` — `login()` compares the entered email (trimmed, case-insensitive) and password against those constants, and only then sets `loggedIn` in localStorage. Everything else (context shape, `logout`, `useGatewayAuth`) stays the same.

No UI changes: the existing login page already shows "Invalid email or password" when `login()` returns false.

## Verification

TypeScript/build check, plus a quick check that a wrong password is rejected and the correct pair reaches `/dashboard`.

## Known limitation

The API admin token (`X-Admin-Token`) is still bundled into the shipped JavaScript, so anyone with dev tools can read it and call the backend admin API directly. This change only blocks casual walk-up access to the dashboard UI. Closing that hole requires a real backend-verified login endpoint — a separate piece of work.
