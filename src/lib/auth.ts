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
    const db = getDb();
    const user = db.prepare('SELECT id, name, role FROM staff WHERE id = ? AND active = 1').get(data.id) as SessionUser | undefined;
    return user || null;
  } catch {
    return null;
  }
}

export function createSessionToken(user: { id: number; name: string; role: string }): string {
  return Buffer.from(JSON.stringify({ id: user.id, name: user.name, role: user.role, ts: Date.now() })).toString('base64');
}
