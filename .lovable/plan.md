# Replace QR preparation flow

## Implementation
- Replace `useQrPreparation` with one generation-based lifecycle: provision and poll immediately, poll every 3 seconds, and reprovision every 12 seconds while active and unresolved.
- Ignore stale asynchronous results after refresh, close, user change, or unmount; stop both intervals immediately when a valid `data:image/` QR or `WORKING`/`READY` status arrives.
- Keep transient responses and request failures in the waiting state, with console-only diagnostic logging.
- Make Refresh QR clear the current result, start a new generation, provision immediately, and restart both intervals; make reset clear timers and state.
- Remove `QrDebugSummary` imports and rendering from QrDialog, UserDetails, and EmergencyResetDialog. Preserve only the calm waiting message and attempt count before the QR appears.

## Technical details
- Preserve the hook’s current public return shape where useful so consumers require minimal changes, but remove deadline/error behavior from the active flow.
- Keep RowActions using QrDialog; opening that dialog activates the shared hook automatically.
- Verify TypeScript and the preview build signal after edits.
