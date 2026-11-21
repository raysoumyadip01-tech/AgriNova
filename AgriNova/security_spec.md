# AgriNova Firestore Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **Master Deny Safety Net**: Every path not explicitly matched is denied (`allow read, write: if false`).
2. **Verified Identity**: All authenticated writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Self-Assigned Privileges**: Users registering in `/user_profiles/{userId}` can only choose public roles (`farmer`, `transporter`, `warehouse`, `retailer`) and cannot set or escalate to `admin`. Role updates post-creation are locked to verified admins only.
4. **PII Isolation**: `email`, `phone`, and `location` are stored separately under `/user_profiles/{userId}/private/contact` with strict owner-or-admin single-document `get`/write checks (never exposed via blanket `list` or unauthenticated `get`).
5. **Path Variable Hardening & Strict Blueprint Keys**: Every single-document operation validates document IDs via `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `<= 128` chars), and every create/update calls its standalone `isValid*()` helper checking exact keys (`hasAll` + `hasOnly`), field types, string `.size()` bounds, numeric bounds, immutable `uid`/`ownerId`/`createdAt`, and server timestamp `request.time`.
6. **Query Enforcer**: `allow list` rules explicitly enforce `resource.data.ownerId == request.auth.uid` without calling `get()` or `exists()`.

## 2. Adversarial "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read**: `get(/user_profiles/u1)` with `auth = null`.
2. **Blanket list scraping**: `list(/user_profiles)` with signed-in user trying to enumerate other users.
3. **Cross-user PII peek**: `get(/user_profiles/u2/private/contact)` signed in as `u1` (`u1 != u2`, non-admin).
4. **Privilege escalation on create**: `create(/user_profiles/u1)` with `{ role: "admin", ... }`.
5. **Privilege escalation on update**: `update(/user_profiles/u1)` changing `role` from `"farmer"` to `"admin"`.
6. **Shadow/Ghost field injection**: `create(/user_profiles/u1)` adding `{ isVerified: true }` not in `hasOnly(...)`.
7. **Spoofed timestamp**: `create(/crop_batches/b1)` supplying a backdated `createdAt` (`!= request.time`).
8. **ID poisoning (Denial of Wallet)**: `create(/crop_batches/<1500-char-id>)` failing `isValidId()`.
9. **String payload exhaustion**: `create(/crop_batches/b1)` with a 50KB `name` string exceeding `.size() <= 120`.
10. **Owner spoofing**: `create(/crop_batches/b1)` signed in as `u1` with `ownerId: "u2"`.
11. **Immutable owner mutation**: `update(/crop_batches/b1)` attempting to change `ownerId` or `createdAt`.
12. **Terminal state bypass**: `update(/shipments/s1)` attempting to mutate a shipment after `status == "Delivered"` as a non-admin.
