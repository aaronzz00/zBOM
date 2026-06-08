import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';

const deriveKey = (secret: string) => createHash('sha256').update(secret).digest();

export const encryptCredential = (plainText: string, secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
};

export const decryptCredential = (encryptedValue: string, secret: string) => {
  const [version, ivValue, tagValue, encryptedText] = encryptedValue.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedText) {
    throw new Error('Unsupported encrypted credential format.');
  }

  const decipher = createDecipheriv(
    algorithm,
    deriveKey(secret),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const lastFour = (value: string) => value.slice(-4);
