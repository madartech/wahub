---
name: User last-known phone cache
description: Persist last-known WhatsApp phone per gateway user in localStorage so search-by-phone still finds disconnected users
type: feature
---
- Stored under localStorage key `gateway_user_last_phones` as `{ [userId]: digitsOnly }`.
- Populated from initial `/admin/users` list and from each `/admin/users/:id/status` enrichment (uses `phoneNumber` or `me.id`).
- Users page search normalizes the query to digits and matches against current phone OR cached last phone, so a disconnected user (no live phoneNumber) is still findable by their previous number for re-provisioning.
