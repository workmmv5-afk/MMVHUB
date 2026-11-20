import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createKeyVerifier,
  decryptPayload,
  derivePassphraseKey,
  encryptPayload,
  generateDeviceKey,
  generateSaltBase64,
  verifyVaultKey,
} from '../src/lib/crypto';
import {
  createPinWrapper,
  isValidPin,
  masterKeyToRecoveryCode,
  pinCooldownMs,
  recoveryCodeToMasterKey,
  rewrapPin,
  unwrapWithPin,
} from '../src/lib/quickUnlock';

test('PIN wraps and unwraps the vault key', async () => {
  const { key } = await generateDeviceKey();
  const v = await createKeyVerifier(key);
  const rec = await encryptPayload(key, { title: 'secret' });
  const { meta, pinKey } = await createPinWrapper('482915', key);
  assert.equal(JSON.stringify(meta).includes('"k"'), false, 'raw key must not be stored');

  const ok = await unwrapWithPin('482915', meta);
  assert.ok(ok && (await verifyVaultKey(ok.master, v.verifierIv, v.verifierCiphertext)));
  assert.equal((await decryptPayload<{ title: string }>(ok!.master, rec.iv, rec.ciphertext)).title, 'secret');
  assert.equal(await unwrapWithPin('482916', meta), null);

  // Passphrase change: new master key re-wrapped with the same PIN key
  const next = await derivePassphraseKey('correct horse battery', generateSaltBase64());
  const back = await unwrapWithPin('482915', await rewrapPin(meta, pinKey, next));
  const v2 = await createKeyVerifier(next);
  assert.ok(back && (await verifyVaultKey(back.master, v2.verifierIv, v2.verifierCiphertext)));
});

test('PIN rules and cooldown', () => {
  assert.ok(isValidPin('1234') && isValidPin('123456'));
  assert.ok(!isValidPin('123') && !isValidPin('1234567') && !isValidPin('12a4'));
  assert.equal(pinCooldownMs(4), 0);
  assert.equal(pinCooldownMs(5), 30_000);
  assert.equal(pinCooldownMs(6), 60_000);
  assert.equal(pinCooldownMs(50), 3_600_000);
});

test('recovery code round-trips and rejects typos', async () => {
  const { key } = await generateDeviceKey();
  const v = await createKeyVerifier(key);
  const code = await masterKeyToRecoveryCode(key);
  assert.equal(code.split('-').length, 14);
  const back = await recoveryCodeToMasterKey(code.toLowerCase().replace(/-/g, ' '));
  assert.ok(back && (await verifyVaultKey(back, v.verifierIv, v.verifierCiphertext)));
  const typo = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A') + code.slice(6);
  assert.equal(await recoveryCodeToMasterKey(typo), null);
  assert.equal(await recoveryCodeToMasterKey('hello'), null);
});
