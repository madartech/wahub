# Fix platform-wide QR retry flow

## Implementation
- Add one shared QR preparation hook that owns the instance-agnostic 3-second polling loop, a 120-second minimum retry window, request cancellation, authoritative `data:image/` handling, and refresh-by-provision behavior.
- Treat every response without a valid QR image as retryable during the active window, including startup/unknown states, aborts, timeouts, and HTTP 502/524 responses.
- Update User Details, Operations QR dialog, and Emergency Reset dialog to consume the shared flow so status polling cannot replace an active or loaded QR state.
- Make every QR surface show “Preparing QR... retrying automatically,” keep diagnostics secondary, and expose an enabled Refresh QR action that provisions again and restarts polling from zero.
- Preserve Emergency Reset’s destructive reset confirmation while using the shared QR preparation flow after reset.

## Technical details
- Extend normalized QR responses with HTTP status where needed for diagnostics/retry classification.
- Stop polling immediately when any valid `data:image/` URL is returned, regardless of other response metadata.
- Invalidate stale in-flight responses with generation tokens when refreshing, closing, changing users, or unmounting.

## Verification
- Run focused TypeScript checks/tests available in the project.
- Confirm the preview build log reports a successful build.
