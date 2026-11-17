import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { LocalVaultMeta, LocalVaultRecord, VaultRecordKind } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  getAllLocalRecords,
  putLocalRecord,
  putLocalRecordsBatch,
} from './indexeddb';

export interface CloudVaultProfile {
  uid: string;
  email: string;
  displayName: string;
  vaultSalt: string;
  verifierIv: string;
  verifierCiphertext: string;
}

export async function fetchCloudVaultProfile(
  uid: string
): Promise<CloudVaultProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as CloudVaultProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createCloudVaultProfile(
  uid: string,
  email: string,
  displayName: string,
  meta: LocalVaultMeta
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: email.slice(0, 254),
      displayName: (displayName || 'Personal Vault').slice(0, 100),
      vaultSalt: meta.salt,
      verifierIv: meta.verifierIv,
      verifierCiphertext: meta.verifierCiphertext,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function rotateCloudVaultProfileKey(
  uid: string,
  salt: string,
  verifierIv: string,
  verifierCiphertext: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      vaultSalt: salt,
      verifierIv,
      verifierCiphertext,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function pushPendingVaultRecords(uid: string): Promise<number> {
  const allLocal = await getAllLocalRecords();
  const pending = allLocal.filter((r) => r.syncState === 'pending');
  if (pending.length === 0) return 0;

  let syncedCount = 0;

  for (const record of pending) {
    const path = `users/${uid}/vaultItems/${record.id}`;
    const ref = doc(db, 'users', uid, 'vaultItems', record.id);

    if (!record.syncedToCloud && record.deleted) {
      await putLocalRecord({
        ...record,
        syncState: 'synced',
      });
      syncedCount++;
      continue;
    }

    if (!record.syncedToCloud) {
      try {
        await setDoc(ref, {
          ownerId: uid,
          kind: record.kind,
          iv: record.iv,
          ciphertext: record.ciphertext,
          version: record.version,
          deleted: false,
          clientUpdatedAt: record.clientUpdatedAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await putLocalRecord({
          ...record,
          syncState: 'synced',
          syncedToCloud: true,
        });
        syncedCount++;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    } else {
      try {
        const updatePayload: Record<string, unknown> = {
          iv: record.iv,
          ciphertext: record.ciphertext,
          version: record.version,
          clientUpdatedAt: record.clientUpdatedAt,
          updatedAt: serverTimestamp(),
        };
        if (record.deleted) {
          updatePayload.deleted = true;
        }
        await updateDoc(ref, updatePayload);
        await putLocalRecord({
          ...record,
          syncState: 'synced',
          syncedToCloud: true,
        });
        syncedCount++;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  }

  return syncedCount;
}

export function subscribeToCloudVault(
  uid: string,
  onMerged: () => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/vaultItems`;
  const q = query(
    collection(db, 'users', uid, 'vaultItems'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      try {
        const localRecords = await getAllLocalRecords();
        const localById = new Map(localRecords.map((r) => [r.id, r]));
        const toSave: LocalVaultRecord[] = [];

        for (const docSnap of snapshot.docs) {
          const remote = docSnap.data() as {
            kind: VaultRecordKind;
            iv: string;
            ciphertext: string;
            version: number;
            deleted: boolean;
            clientUpdatedAt: number;
          };
          const local = localById.get(docSnap.id);

          if (
            !local ||
            remote.clientUpdatedAt > local.clientUpdatedAt ||
            (remote.clientUpdatedAt === local.clientUpdatedAt &&
              remote.version > local.version)
          ) {
            toSave.push({
              id: docSnap.id,
              kind: remote.kind,
              iv: remote.iv,
              ciphertext: remote.ciphertext,
              version: remote.version,
              deleted: remote.deleted,
              clientUpdatedAt: remote.clientUpdatedAt,
              syncState: 'synced',
              syncedToCloud: true,
            });
          } else if (
            local.syncState === 'pending' &&
            local.clientUpdatedAt === remote.clientUpdatedAt
          ) {
            toSave.push({
              ...local,
              syncState: 'synced',
              syncedToCloud: true,
            });
          } else if (!local.syncedToCloud) {
            toSave.push({
              ...local,
              syncedToCloud: true,
            });
          }
        }

        if (toSave.length > 0) {
          await putLocalRecordsBatch(toSave);
        }
        onMerged();
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
