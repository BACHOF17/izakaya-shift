import { cookies } from 'next/headers';
import { getDb } from './db';

export interface SessionUser {
  id: number;
  name: string;
  role: 'staff' | 'owner';
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  if (!session) return null;

  try {
    const data = JSON.parse(Buffer.from(session.value, 'base64').toString());
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT id, name, role FROM staff WHERE id = ? AND active = 1',
      args: [data.id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { id: Number(row.id), name: String(row.name), role: String(row.role) as 'staff' | 'owner' };
  } catch {
    return null;
  }
}

export function createSessionToken(user: { id: number; name: string; role: string }): string {
  return Buffer.from(JSON.stringify({ id: user.id, name: user.name, role: user.role, ts: Date.now() })).toString('base64');
}
