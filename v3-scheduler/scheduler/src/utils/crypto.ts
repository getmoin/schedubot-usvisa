import * as crypto from 'crypto';
import { config } from '../config/env';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = Buffer.from(config.security.encryptionKey, 'utf8'); // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt a string using AES-256-CBC
 * @param text Plain text to encrypt
 * @returns Encrypted text in format: iv:encryptedData
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return IV and encrypted data separated by colon
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt()
 * @param text Encrypted text in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash a string using SHA-256 (for non-reversible hashing)
 * @param text Text to hash
 * @returns Hex string of hash
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a random string (useful for tokens, IDs, etc.)
 * @param length Length of random string
 * @returns Random hex string
 */
export function generateRandom(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
