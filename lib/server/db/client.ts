import 'server-only';
import path from 'node:path';
import { DatabaseConnection } from './connection';
import { ensureUserCategories, initializeUsers } from './bootstrap';

// Compatibility facade: existing repositories keep their public function API.
const connection = new DatabaseConnection({
  filename: () => process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite'),
  migrationsFolder: path.join(process.cwd(), 'drizzle'),
  initialize: db => initializeUsers(db, {
    username: process.env.APP_USERNAME ?? 'admin',
    passwordHash: process.env.APP_PASSWORD_HASH,
  }),
});

export const getDb = () => connection.get();
export const closeDb = () => connection.close();
export const ensureCategoriesForUser = (userId: string) => ensureUserCategories(getDb(), userId);
export { PENDING_ADMIN_USER_ID } from './constants';
export * as schema from './schema';
