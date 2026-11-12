const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

/**
 * FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 random bytes) -
 * generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
 * Losing this key makes every encrypted field permanently unreadable, and
 * rotating it requires decrypting every row with the old key first - there
 * is no automatic re-encryption on rotation.
 */
function getKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  return key;
}

/**
 * Encrypts a plaintext string for storage (passport numbers, visa share
 * codes). Stored as `iv.authTag.ciphertext`, each base64 - a fresh random
 * IV per write, per AES-GCM's own requirement. Null/empty input stays null
 * so optional fields stay optional rather than encrypting an empty string.
 */
function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString('base64')).join('.');
}

/** Reverses encryptField(). Returns null for null input or anything not in our stored format. */
function decryptField(stored) {
  if (stored == null) return null;
  const parts = stored.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encryptField, decryptField };
