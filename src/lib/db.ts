import { createClient, Client } from '@libsql/client';

let client: Client | null = null;
let initialized = false;

export async function getDb(): Promise<Client> {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  if (!initialized) {
    initialized = true;
    await initDb(client);
  }
  return client;
}

async function initDb(db: Client) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      hourly_rate INTEGER NOT NULL DEFAULT 1000,
      transport_fee INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('staff', 'owner')),
      position TEXT NOT NULL DEFAULT '' CHECK(position IN ('', 'hall', 'kitchen')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS shift_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      actual_start TEXT,
      actual_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,
    `CREATE TABLE IF NOT EXISTS shift_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      target_id INTEGER,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'accepted', 'approved', 'rejected', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (requester_id) REFERENCES staff(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (target_id) REFERENCES staff(id)
    )`,
    `CREATE TABLE IF NOT EXISTS punch_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      shift_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('in', 'out')),
      punched_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    )`,
  ], 'write');

  // デフォルトオーナーアカウント（初回のみ）
  const result = await db.execute("SELECT id FROM staff WHERE role = 'owner' LIMIT 1");
  if (result.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO staff (name, pin, role, hourly_rate) VALUES (?, ?, 'owner', 0)",
      args: ['オーナー', '9999'],
    });
  }
}
