import { Database } from 'bun:sqlite';
import { CONFIG } from '../config';
import { migrations } from './schema';

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(CONFIG.DB_PATH, { create: true });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  for (const sql of migrations) {
    try {
      database.exec(sql);
    } catch (err: unknown) {
      // Allow ALTER TABLE to fail if column already exists
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('duplicate column')) continue;
      throw err;
    }
  }
  console.log('[db] Database initialized');
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function withTransaction<T>(fn: () => T): T {
  const database = getDb();
  database.exec('BEGIN');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }
}
