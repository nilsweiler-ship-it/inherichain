import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  encryptionKey: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

export interface DecryptionParams {
  encryptedBuffer: Buffer;
  encryptionKey: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

/**
 * Encrypt a file buffer using AES-256-GCM.
 * Generates a random key and IV per document.
 */
export function encryptDocument(fileBuffer: Buffer): EncryptionResult {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    encryptionKey: key.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt a file buffer using AES-256-GCM.
 */
export function decryptDocument(params: DecryptionParams): Buffer {
  const key = Buffer.from(params.encryptionKey, "hex");
  const iv = Buffer.from(params.iv, "hex");
  const authTag = Buffer.from(params.authTag, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(params.encryptedBuffer),
    decipher.final(),
  ]);
}
