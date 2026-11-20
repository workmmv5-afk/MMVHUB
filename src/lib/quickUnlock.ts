/**
 * Quick unlock: a 4–6 digit PIN and/or fingerprint that unwrap the vault's
 * master AES key on this device. The master key itself never changes, so
 * records, cloud sync and the passphrase flow are unaffected.
 *
 *  PIN          → PBKDF2-SHA256 (400k) → AES-GCM wrap of the raw master key
 *  Fingerprint  → web: WebAuthn passkey PRF output → HKDF → AES-GCM wrap
 *               → app: random secret in Android Keystore (biometric-gated)
 */
import { base64ToBytes, bytesToBase64 } from './crypto';

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const PIN_ITERATIONS = 400_000;
export const PIN_FREE_ATTEMPTS = 5;

export interface WrappedKey {
  iv: string;
  ct: string;
}

export interface PinUnlockMeta {
  salt: string;
  iterations: number;
  length: number;
  wrapped: WrappedKey;
}

export interface BioUnlockMeta {
  kind: 'webauthn' | 'native';
  credentialId?: string; // webauthn
  prfSalt?: string; // webauthn
  wrapped: WrappedKey;
  createdAt: number;
}

export interface QuickUnlockMeta {
  pin?: PinUnlockMeta;
  bio?: BioUnlockMeta;
  failedAttempts?: number;
  lockedUntil?: number;
}

export const isValidPin = (pin: string) =>
  new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

/** Cooldown after too many wrong PINs: 30s, 60s, 2m, 4m … capped at 1h. */
export function pinCooldownMs(failedAttempts: number): number {
  const over = failedAttempts - PIN_FREE_ATTEMPTS;
  if (over < 0) return 0;
  return Math.min(60 * 60_000, 30_000 * 2 ** over);
}

// ---------------------------------------------------------------------------
// Key wrapping
// ---------------------------------------------------------------------------

async function aesWrap(wrapKey: CryptoKey, master: CryptoKey): Promise<WrappedKey> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', master));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
  raw.fill(0);
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

async function aesUnwrap(wrapKey: CryptoKey, w: WrappedKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(w.iv) },
    wrapKey,
    base64ToBytes(w.ct)
  );
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

async function keyFromSecret(
  secret: Uint8Array<ArrayBuffer>,
  info: string
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('mmv-hub-quick-unlock'),
      info: new TextEncoder().encode(info),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// PIN
// ---------------------------------------------------------------------------

export async function derivePinKey(
  pin: string,
  saltB64: string,
  iterations = PIN_ITERATIONS
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`mmv-pin:${pin}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltB64), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createPinWrapper(
  pin: string,
  master: CryptoKey
): Promise<{ meta: PinUnlockMeta; pinKey: CryptoKey }> {
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const pinKey = await derivePinKey(pin, salt);
  return {
    meta: {
      salt,
      iterations: PIN_ITERATIONS,
      length: pin.length,
      wrapped: await aesWrap(pinKey, master),
    },
    pinKey,
  };
}

/** Re-wrap a (new) master key with an already-derived PIN key. */
export async function rewrapPin(
  pinMeta: PinUnlockMeta,
  pinKey: CryptoKey,
  master: CryptoKey
): Promise<PinUnlockMeta> {
  return { ...pinMeta, wrapped: await aesWrap(pinKey, master) };
}

export async function unwrapWithPin(
  pin: string,
  pinMeta: PinUnlockMeta
): Promise<{ master: CryptoKey; pinKey: CryptoKey } | null> {
  const pinKey = await derivePinKey(pin, pinMeta.salt, pinMeta.iterations);
  try {
    return { master: await aesUnwrap(pinKey, pinMeta.wrapped), pinKey };
  } catch {
    return null; // wrong PIN → GCM tag check fails
  }
}

// ---------------------------------------------------------------------------
// Fingerprint — platform detection
// ---------------------------------------------------------------------------

interface NativeBiometricPlugin {
  isAvailable(): Promise<{ isAvailable: boolean; biometryType?: number }>;
  verifyIdentity(opts: {
    reason?: string;
    title?: string;
    subtitle?: string;
    negativeButtonText?: string;
  }): Promise<void>;
  setCredentials(opts: { username: string; password: string; server: string }): Promise<void>;
  getCredentials(opts: { server: string }): Promise<{ username: string; password: string }>;
  deleteCredentials(opts: { server: string }): Promise<void>;
}

const NATIVE_SERVER = 'mmv-hub-vault';

function getNativeBiometric(): NativeBiometricPlugin | null {
  const cap = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: Record<string, unknown>;
    };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.NativeBiometric as NativeBiometricPlugin) ?? null;
}

export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export type BiometricSupport = 'native' | 'webauthn' | 'none';

export async function detectBiometricSupport(): Promise<BiometricSupport> {
  const native = getNativeBiometric();
  if (native) {
    try {
      return (await native.isAvailable()).isAvailable ? 'native' : 'none';
    } catch {
      return 'none';
    }
  }
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'PublicKeyCredential' in window &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
        ? 'webauthn'
        : 'none';
    } catch {
      return 'none';
    }
  }
  return 'none';
}

// ---------------------------------------------------------------------------
// Fingerprint — WebAuthn PRF (browser / installed PWA)
// ---------------------------------------------------------------------------

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

async function webauthnGetPrf(
  credentialId: string,
  prfSalt: string
): Promise<Uint8Array<ArrayBuffer>> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: base64ToBytes(credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: { prf: { eval: { first: base64ToBytes(prfSalt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const first = (cred?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results
    ?.first;
  if (!first) throw new Error('This device’s fingerprint key does not support vault unlock.');
  return new Uint8Array(first);
}

async function enrollWebAuthn(master: CryptoKey): Promise<{ meta: BioUnlockMeta; key: CryptoKey }> {
  const prfSalt = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'MMV-HUB', id: location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'MMV-HUB vault',
        displayName: 'MMV-HUB',
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      extensions: { prf: { eval: { first: base64ToBytes(prfSalt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Fingerprint setup was cancelled.');
  const credentialId = bytesToBase64(new Uint8Array(cred.rawId));
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (ext.prf?.enabled === false) {
    throw new Error('This browser can’t use fingerprint for vault unlock. Try Chrome on Android.');
  }
  // Some authenticators only return PRF output on get(), not create().
  const secret = ext.prf?.results?.first
    ? new Uint8Array(ext.prf.results.first)
    : await webauthnGetPrf(credentialId, prfSalt);
  const key = await keyFromSecret(secret, 'webauthn');
  secret.fill(0);
  return {
    meta: { kind: 'webauthn', credentialId, prfSalt, wrapped: await aesWrap(key, master), createdAt: Date.now() },
    key,
  };
}

// ---------------------------------------------------------------------------
// Fingerprint — native Android (Capacitor NativeBiometric plugin)
// ---------------------------------------------------------------------------

async function enrollNative(
  plugin: NativeBiometricPlugin,
  master: CryptoKey
): Promise<{ meta: BioUnlockMeta; key: CryptoKey }> {
  await plugin.verifyIdentity({
    title: 'Enable fingerprint',
    reason: 'Unlock MMV-HUB with your fingerprint',
    negativeButtonText: 'Cancel',
  });
  const secret = crypto.getRandomValues(new Uint8Array(32));
  await plugin.setCredentials({
    username: 'vault',
    password: bytesToBase64(secret),
    server: NATIVE_SERVER,
  });
  const key = await keyFromSecret(secret, 'native');
  secret.fill(0);
  return {
    meta: { kind: 'native', wrapped: await aesWrap(key, master), createdAt: Date.now() },
    key,
  };
}

// ---------------------------------------------------------------------------
// Fingerprint — public API
// ---------------------------------------------------------------------------

export async function enrollBiometric(
  master: CryptoKey
): Promise<{ meta: BioUnlockMeta; key: CryptoKey }> {
  const native = getNativeBiometric();
  if (native) return enrollNative(native, master);
  return enrollWebAuthn(master);
}

export async function unlockWithBiometricMeta(
  meta: BioUnlockMeta
): Promise<{ master: CryptoKey; key: CryptoKey }> {
  let secret: Uint8Array<ArrayBuffer>;
  if (meta.kind === 'native') {
    const plugin = getNativeBiometric();
    if (!plugin) throw new Error('Fingerprint unlock is only available in the app.');
    await plugin.verifyIdentity({
      title: 'Unlock MMV-HUB',
      reason: 'Confirm your fingerprint',
      negativeButtonText: 'Use PIN',
    });
    const creds = await plugin.getCredentials({ server: NATIVE_SERVER });
    secret = base64ToBytes(creds.password);
  } else {
    if (!meta.credentialId || !meta.prfSalt) throw new Error('Fingerprint data is incomplete.');
    secret = await webauthnGetPrf(meta.credentialId, meta.prfSalt);
  }
  const key = await keyFromSecret(secret, meta.kind);
  secret.fill(0);
  try {
    return { master: await aesUnwrap(key, meta.wrapped), key };
  } catch {
    throw new Error('Fingerprint key no longer matches. Unlock with PIN and set it up again.');
  }
}

export async function rewrapBio(
  meta: BioUnlockMeta,
  key: CryptoKey,
  master: CryptoKey
): Promise<BioUnlockMeta> {
  return { ...meta, wrapped: await aesWrap(key, master) };
}

export async function removeNativeBiometricSecret(): Promise<void> {
  try {
    await getNativeBiometric()?.deleteCredentials({ server: NATIVE_SERVER });
  } catch {
    // ignore
  }
}
