const VERIFIER_PLAINTEXT = 'MMV_HUB_VAULT_KEY_VERIFIED_V1';
const PBKDF2_ITERATIONS = 150000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSaltBase64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(salt);
}

export async function generateDeviceKey(): Promise<{
  key: CryptoKey;
  jwk: JsonWebKey;
}> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  // Extractable so the key can be wrapped for PIN / fingerprint unlock.
  return { key, jwk };
}

export async function importDeviceKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function derivePassphraseKey(
  passphrase: string,
  saltBase64: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const saltBytes = base64ToBytes(saltBase64);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    // Extractable so the derived vault key can be wrapped for PIN /
    // fingerprint quick unlock (same bytes as before → fully compatible).
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptRawText(
  key: CryptoKey,
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  );
  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptRawText(
  key: CryptoKey,
  ivBase64: string,
  ciphertextBase64: string
): Promise<string> {
  const iv = base64ToBytes(ivBase64);
  const data = base64ToBytes(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(decrypted);
}

export async function createKeyVerifier(
  key: CryptoKey
): Promise<{ verifierIv: string; verifierCiphertext: string }> {
  const { iv, ciphertext } = await encryptRawText(key, VERIFIER_PLAINTEXT);
  return { verifierIv: iv, verifierCiphertext: ciphertext };
}

export async function verifyVaultKey(
  key: CryptoKey,
  verifierIv: string,
  verifierCiphertext: string
): Promise<boolean> {
  try {
    const plain = await decryptRawText(key, verifierIv, verifierCiphertext);
    return plain === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

export async function encryptPayload<T>(
  key: CryptoKey,
  payload: T
): Promise<{ iv: string; ciphertext: string }> {
  return encryptRawText(key, JSON.stringify(payload));
}

export async function decryptPayload<T>(
  key: CryptoKey,
  iv: string,
  ciphertext: string
): Promise<T> {
  const json = await decryptRawText(key, iv, ciphertext);
  return JSON.parse(json) as T;
}
