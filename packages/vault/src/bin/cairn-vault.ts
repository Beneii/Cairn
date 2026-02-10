#!/usr/bin/env node
import { putSecret, getSecret, listSecrets, deleteSecret } from '../vault.js';

const [, , command, ...args] = process.argv;

async function main() {
    switch (command) {
        case 'set': {
            const [key, value] = args;
            if (!key || !value) {
                console.error('Usage: cairn-vault set <key> <value>');
                process.exit(1);
            }
            putSecret(key, value);
            console.log(`Secret "${key}" stored successfully.`);
            break;
        }
        case 'get': {
            const [key] = args;
            if (!key) {
                console.error('Usage: cairn-vault get <key>');
                process.exit(1);
            }
            const value = getSecret(key);
            if (value) {
                console.log(value);
            } else {
                console.error(`Secret "${key}" not found.`);
                process.exit(1);
            }
            break;
        }
        case 'list': {
            const secrets = listSecrets();
            if (secrets.length === 0) {
                console.log('No secrets stored.');
            } else {
                console.log('Stored secrets:');
                secrets.forEach(s => console.log(`- ${s}`));
            }
            break;
        }
        case 'delete': {
            const [key] = args;
            if (!key) {
                console.error('Usage: cairn-vault delete <key>');
                process.exit(1);
            }
            deleteSecret(key);
            console.log(`Secret "${key}" deleted.`);
            break;
        }
        default: {
            console.log(`
Cairn Vault CLI
Usage:
  cairn-vault set <key> <value>
  cairn-vault get <key>
  cairn-vault list
  cairn-vault delete <key>
            `);
        }
    }
}

main().catch(console.error);
