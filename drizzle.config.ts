import type { Config } from 'drizzle-kit';
import path from 'node:path';

export default {
  schema: './lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'binder.sqlite'),
  },
} satisfies Config;
