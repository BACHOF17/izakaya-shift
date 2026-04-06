import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const db = await getDb();
  const result = await db.execute("SELECT id, name, pin, hourly_rate, transport_fee, role, position, active FROM staff ORDER BY role DESC, name");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { name, pin, hourly_rate, transport_fee, position } = await req.json();
  if (!name || !pin) {
    return NextResponse.json({ error: '名前とPINは必須です' }, { status: 400 });
  }
  const db = await getDb();
  const result = await db.execute({
    sql: 'INSERT INTO staff (name, pin, hourly_rate, transport_fee, position) VALUES (?, ?, ?, ?, ?)',
    args: [name, pin, hourly_rate || 1000, transport_fee || 0, position || ''],
  });
  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { id, name, pin, hourly_rate, transport_fee, position, active } = await req.json();
  const db = await getDb();
  await db.execute({
    sql: 'UPDATE staff SET name = ?, pin = ?, hourly_rate = ?, transport_fee = ?, position = ?, active = ? WHERE id = ?',
    args: [name, pin, hourly_rate, transport_fee, position || '', active ?? 1, id],
  });
  return NextResponse.json({ ok: true });
}
