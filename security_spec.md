# MMV-HUB Firestore Security Specification

## 1. Data Invariants
1. **Strict Personal Isolation**: Every document under `/users/{userId}` and `/users/{userId}/vaultItems/{itemId}` is accessible only when `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
2. **No Directory Enumeration**: `list` operations on `/users` are strictly denied (`allow list: if false`).
3. **Immutable Ownership & Kind**: `UserProfile.uid`, `UserProfile.createdAt`, `VaultItem.ownerId`, `VaultItem.kind`, and `VaultItem.createdAt` cannot change after creation.
4. **Master Gate Parent Integrity**: A `VaultItem` cannot be created unless the parent `/users/{userId}` document exists.
5. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
6. **Terminal Tombstone Locking**: Once `VaultItem.deleted` transitions to `true`, further updates to that document are denied.
7. **Volumetric Bounds**: Every string field enforces strict `.size()` bounds (`ciphertext <= 32768`, `iv <= 64`, `vaultSalt <= 128`, `email <= 254`, `displayName <= 100`) and all IDs must match `^[a-zA-Z0-9_\-]+$` with max length 128.
8. **Zero-Knowledge Query Enforcement**: `list` on `/users/{userId}/vaultItems` enforces `isOwner(userId) && resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-User Read/Write**: Authenticated User B attempts to read or create `/users/userA/vaultItems/pur_1`.
2. **Unverified Email Bypass**: Authenticated user with `email_verified: false` attempts to write `/users/userA`.
3. **User Collection Enumeration**: Authenticated user attempts `list` on `/users`.
4. **Shadow Field Injection**: Create `VaultItem` with extra field `isAdmin: true`.
5. **Owner Spoofing**: User A creates `/users/userA/vaultItems/pur_1` with `ownerId: "userB"`.
6. **Orphaned Subcollection Write**: User A creates `VaultItem` before `/users/userA` exists.
7. **ID Poisoning**: Create `VaultItem` with `itemId` containing `../` or >128 characters.
8. **Denial-of-Wallet Payload**: Create `VaultItem` with `ciphertext` > 32768 bytes.
9. **Client Timestamp Forgery**: Create or update `VaultItem` with backdated `createdAt` or `updatedAt != request.time`.
10. **Immutable Kind Mutation**: Update `VaultItem` changing `kind` from `"purchase"` to `"task"`.
11. **Resurrecting Deleted Tombstone**: Update `VaultItem` where `existing().deleted == true` back to `deleted: false`.
12. **Type Poisoning on Update**: Update `VaultItem` setting `version` to a string or `ciphertext` to a number.
