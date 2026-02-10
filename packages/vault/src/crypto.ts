import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const KEY_FILE = path.join(os.homedir(), '.cairn', 'vault.key');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
    if (fs.existsSync(KEY_FILE)) {
        return fs.readFileSync(KEY_FILE);
    }

    // Generate new key
    const key = crypto.randomBytes(KEY_LENGTH);
    const dir = path.dirname(KEY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
    return key;
}

export interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
}

export function encrypt(text: string): EncryptedData {
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag
    };
}

export function decrypt(data: EncryptedData): string {
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
