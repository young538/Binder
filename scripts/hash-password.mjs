#!/usr/bin/env node
import argon2 from 'argon2';
import crypto from 'node:crypto';

const [, , passwordArg] = process.argv;

if (!passwordArg) {
  console.error('Usage: node scripts/hash-password.mjs <your-password>');
  console.error('');
  console.error('Outputs values to copy into .env:');
  console.error('  APP_PASSWORD_HASH=...');
  console.error('  SESSION_SECRET=...');
  process.exit(1);
}

const hash = await argon2.hash(passwordArg, {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB (OWASP recommended minimum)
  timeCost: 2,
  parallelism: 1,
});

const secret = crypto.randomBytes(32).toString('hex');

console.log('# Add these to your .env.local (or .env on the server):');
console.log(`APP_USERNAME=admin`);
// argon2 hash contains $ chars → escape each $ so dotenv doesn't expand as variable
const escapedHash = hash.replace(/\$/g, '\\$');
console.log(`APP_PASSWORD_HASH=${escapedHash}`);
console.log(`SESSION_SECRET=${secret}`);
console.log(`DB_PATH=./data/binder.sqlite`);
