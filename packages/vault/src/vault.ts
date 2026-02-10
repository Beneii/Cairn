import Database from 'better-sqlite3';
import { join } from 'node:path';
import os from 'node:os';
import { fsyncSync, mkdirSync, existsSync } from 'node:fs';
import { encrypt, decrypt, EncryptedData } from './crypto.js';

const VAULT_DIR = join(os.homedir(), '.cairn');
const DB_PATH = join(VAULT_DIR, 'vault.db');

if (!existsSync(VAULT_DIR)) {
    mkdirSync(VAULT_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS secrets (
        key TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        metadata TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
        domain TEXT,
        username TEXT,
        secret_ref TEXT,
        roles TEXT,
        metadata TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (domain, username)
    );

    CREATE TABLE IF NOT EXISTS leases (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        purpose TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

export interface SecretMetadata {
    description?: string;
    tags?: string[];
    [key: string]: any;
}

export function putSecret(key: string, value: string, metadata: SecretMetadata = {}): void {
    const encrypted = encrypt(value);
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO secrets (key, encrypted_value, iv, auth_tag, metadata)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(key, encrypted.encrypted, encrypted.iv, encrypted.authTag, JSON.stringify(metadata));
}

export function getSecret(key: string): string | null {
    const stmt = db.prepare('SELECT * FROM secrets WHERE key = ?');
    const row = stmt.get(key) as any;
    if (!row) return null;

    return decrypt({
        encrypted: row.encrypted_value,
        iv: row.iv,
        authTag: row.auth_tag
    });
}

export function listSecrets(): string[] {
    const stmt = db.prepare('SELECT key FROM secrets');
    const rows = stmt.all() as any[];
    return rows.map(r => r.key);
}

export function deleteSecret(key: string): void {
    const stmt = db.prepare('DELETE FROM secrets WHERE key = ?');
    stmt.run(key);
}

export function leaseSecret(domain: string, purpose: string, secretKey: string, ttlSeconds: number): string | null {
    const secret = getSecret(secretKey);
    if (!secret) return null;

    const leaseId = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const stmt = db.prepare(`
        INSERT INTO leases (id, domain, purpose, secret_key, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(leaseId, domain, purpose, secretKey, expiresAt);

    return secret;
}
