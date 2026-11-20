import 'server-only';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type BinderDatabase = BetterSQLite3Database<typeof schema>;
export type DatabaseSession = Pick<BinderDatabase, 'select' | 'insert' | 'update' | 'delete'>;

interface ConnectionOptions {
  filename: () => string;
  migrationsFolder: string;
  initialize?: (db: DatabaseSession) => void;
}

/** Owns one SQLite connection; callers only receive fully initialized databases. */
export class DatabaseConnection {
  private sqlite?: Database.Database;
  private database?: BinderDatabase;

  constructor(private readonly options: ConnectionOptions) {}

  get(): BinderDatabase {
    if (this.database) return this.database;
    const filename = this.options.filename();
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    const sqlite = new Database(filename);
    try {
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      const database = drizzle(sqlite, { schema });
      // A missing migration directory is a deployment error, not a blank DB.
      migrate(database, { migrationsFolder: this.options.migrationsFolder });
      const initialize = this.options.initialize;
      if (initialize) database.transaction(tx => initialize(tx), { behavior: 'immediate' });
      this.sqlite = sqlite;
      this.database = database;
      return database;
    } catch (error) {
      sqlite.close();
      throw error;
    }
  }

  close(): void {
    this.sqlite?.close();
    this.sqlite = undefined;
    this.database = undefined;
  }
}
