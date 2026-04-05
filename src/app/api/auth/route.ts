import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { staffId, pin } = await req.json();
  const db = getDb();

  const user = db.prepare('SELECT id, name, pin, role FROM staff WHERE id = ? AND active = 1').get(staffId) as {
    id: number; name: string; pin: string; role: string;
  } | undefined;

  if (!user || user.pin !== pin) {
    return NextResponse.json({ error: 'PINが正しくありません' }, { status: 401 });
  }

  const token = createSessionToken(user);
  const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
  res.cookies.set('session', token, {
    httpOnly: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('session');
  return res;
}

export async function GET() {
  const db = getDb();
  const staffList = db.prepare("SELECT id, name, role FROM staff WHERE active = 1 ORDER BY role DESC, name").all();
  return NextResponse.json(staffList);
}
