#!/usr/bin/env node
import argon2 from 'argon2';
import Database from 'better-sqlite3';
import { ulid } from 'ulid';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite');
const DEFAULT_CATEGORIES = [
  { name: '주원씽', color: '#f4cccc' },
  { name: '부원씽', color: '#fce5cd' },
  { name: '강의',   color: '#fff2cc' },
  { name: '개인',   color: '#d9ead3' },
  { name: '성장',   color: '#c9daf8' },
  { name: '사람',   color: '#d9d2e9' },
  { name: '재미',   color: '#ead1dc' },
  { name: '낭비',   color: '#d9d9d9' },
];

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const [, , cmd, ...args] = process.argv;

const usage = () => {
  console.error('Usage:');
  console.error('  node scripts/users.mjs add <username> <password>');
  console.error('  node scripts/users.mjs list');
  console.error('  node scripts/users.mjs passwd <username> <new-password>');
  console.error('  node scripts/users.mjs delete <username>');
  process.exit(1);
};

if (cmd === 'add') {
  const [username, password] = args;
  if (!username || !password) usage();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) { console.error(`User '${username}' already exists`); process.exit(2); }
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const id = ulid();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?,?,?,?,?)')
    .run(id, username, hash, now, now);
  // seed default categories
  const insertCat = db.prepare('INSERT INTO categories (id, user_id, name, color, "order") VALUES (?,?,?,?,?)');
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    insertCat.run(ulid(), id, DEFAULT_CATEGORIES[i].name, DEFAULT_CATEGORIES[i].color, i);
  }
  console.log(`Added user '${username}' (id=${id}) with 8 default categories`);
} else if (cmd === 'list') {
  const rows = db.prepare('SELECT id, username, created_at FROM users ORDER BY created_at').all();
  for (const r of rows) console.log(`${r.id}\t${r.username}\t${r.created_at}`);
} else if (cmd === 'passwd') {
  const [username, newPassword] = args;
  if (!username || !newPassword) usage();
  const hash = await argon2.hash(newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const result = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?')
    .run(hash, new Date().toISOString(), username);
  if (result.changes === 0) { console.error(`User '${username}' not found`); process.exit(2); }
  console.log(`Password updated for '${username}'`);
} else if (cmd === 'delete') {
  const [username] = args;
  if (!username) usage();
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) { console.error(`User '${username}' not found`); process.exit(2); }
  const tables = ['goals', 'categories', 'todos', 'focus_notes', 'annual_goals', 'habits', 'habit_logs', 'books', 'retrospectives', 'time_blocks', 'settings'];
  const tx = db.transaction(() => {
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(user.id);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  });
  tx();
  console.log(`Deleted user '${username}' and all their data`);
} else {
  usage();
}

db.close();
