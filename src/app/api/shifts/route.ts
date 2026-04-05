import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const staffId = searchParams.get('staff_id');

  let query = `
    SELECT sh.*, s.name as staff_name, s.hourly_rate
    FROM shifts sh
    JOIN staff s ON sh.staff_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (session.role === 'staff') {
    query += ' AND sh.staff_id = ?';
    params.push(session.id);
  } else if (staffId) {
    query += ' AND sh.staff_id = ?';
    params.push(Number(staffId));
  }

  if (month) {
    query += " AND sh.date LIKE ?";
    params.push(`${month}%`);
  }

  query += ' ORDER BY sh.date, sh.start_time';
  const shifts = db.prepare(query).all(...params);
  return NextResponse.json(shifts);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { id, start_time, end_time, break_minutes, actual_start, actual_end } = await req.json();
  const db = getDb();
  db.prepare(`
    UPDATE shifts SET start_time = ?, end_time = ?, break_minutes = ?, actual_start = ?, actual_end = ?
    WHERE id = ?
  `).run(start_time, end_time, break_minutes ?? 0, actual_start || null, actual_end || null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM shifts WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
