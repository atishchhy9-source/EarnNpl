# Earn Npl - Security Specification & Dirty Dozen Audit

## 1. Data Invariants

1. **User Balance Integrity**: Regular users CANNOT modify `balance`, `role`, or `status` fields directly. Only system transactions or admin operations can adjust balances.
2. **Deposit Immutability**: Once a deposit request status transitions to `approved` or `rejected`, it is terminal and cannot be modified again by any user or non-admin process.
3. **Identity Verification**: A user can only submit deposit requests and task submissions with `userId` strictly matching their authenticated `request.auth.uid`.
4. **Transaction Ledger Integrity**: `walletTransactions` documents can only be created by authorized operations (admin approval or verified system actions), never by regular clients.
5. **No Negative Balances**: User balance must always remain >= 0.
6. **Task Proof Ownership**: Users can only create or view their own task submissions.
7. **Bootstrapped Admin Access**: Admin privileges require either an entry in the `/admins/{uid}` collection or verified user token matching runtime admin `atishchhy9@gmail.com`.

---

## 2. The "Dirty Dozen" Payloads (Adversarial Tests)

1. **Self-Balance Injection Attack**: Regular user attempts `users/{uid}.update({ balance: 99999 })`. Expected: `PERMISSION_DENIED`.
2. **Role Escalation Attack**: User attempts `users/{uid}.update({ role: 'admin' })`. Expected: `PERMISSION_DENIED`.
3. **Spoofed Deposit Approval**: Non-admin attempts `depositRequests/{id}.update({ status: 'approved' })`. Expected: `PERMISSION_DENIED`.
4. **Terminal State Re-Approval Attack**: User or malicious script attempts to re-approve an already approved deposit to get double credit. Expected: `PERMISSION_DENIED`.
5. **Impersonated Deposit Creation**: User A attempts to submit a deposit request under User B's `userId`. Expected: `PERMISSION_DENIED`.
6. **Negative Amount Deposit**: Malicious user submits `{ amount: -500 }`. Expected: `PERMISSION_DENIED`.
7. **Direct Ledger Credit Injection**: User creates a document in `walletTransactions` directly. Expected: `PERMISSION_DENIED`.
8. **Unverified Email Admin Spoofing**: Attacker sends admin email without `email_verified: true`. Expected: `PERMISSION_DENIED`.
9. **Junk ID Poisoning Attack**: User passes 2KB junk character string as document ID. Expected: `PERMISSION_DENIED`.
10. **Ghost Field Poisoning Attack**: Submitting deposit with `{ shadowRole: 'superadmin' }`. Expected: `PERMISSION_DENIED`.
11. **Cross-User Submission Snoop**: User A attempts to list or read User B's deposit requests or task proofs. Expected: `PERMISSION_DENIED`.
12. **Settings Hijacking Attack**: Regular user attempts to modify `appSettings/global` with attacker's eSewa or bank numbers. Expected: `PERMISSION_DENIED`.

---

## 3. Test Runner Specification
All 12 attacks are guaranteed to yield `PERMISSION_DENIED` under the hardened `firestore.rules`.
