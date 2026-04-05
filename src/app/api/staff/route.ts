import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const db = getDb();
  const staff = db.prepare("SELECT id, name, pin, hourly_rate, transport_fee, role, active FROM staff ORDER BY role DESC, name").all();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { name, pin, hourly_rate, transport_fee } = await req.json();
  if (!name || !pin) {
    return NextResponse.json({ error: '名前とPINは必須です' }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO staff (name, pin, hourly_rate, transport_fee) VALUES (?, ?, ?, ?)'
  ).run(name, pin, hourly_rate || 1000, transport_fee || 0);
  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { id, name, pin, hourly_rate, transport_fee, active } = await req.json();
  const db = getDb();
  db.prepare(
    'UPDATE staff SET name = ?, pin = ?, hourly_rate = ?, transport_fee = ?, active = ? WHERE id = ?'
  ).run(name, pin, hourly_rate, transport_fee, active ?? 1, id);
  return NextResponse.json({ ok: true });
}
