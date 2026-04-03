import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

export function createDb(databaseUrl: string) {
  _sql = postgres(databaseUrl, { max: 10 });
  _db = drizzle(_sql);
  return _db;
}

export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call createDb() first.');
  }
  return _db;
}

export async function closeDb() {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}
