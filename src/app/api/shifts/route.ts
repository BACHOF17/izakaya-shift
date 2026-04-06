import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const staffId = searchParams.get('staff_id');

  let query = `
    SELECT sh.*, s.name as staff_name, s.hourly_rate, s.position as staff_position
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
  const result = await db.execute({ sql: query, args: params });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { staff_id, date, start_time, end_time } = await req.json();
  if (!staff_id || !date || !start_time || !end_time) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
  }
  const db = await getDb();
  // 重複チェック
  const existing = await db.execute({
    sql: 'SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1',
    args: [staff_id, date],
  });
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'この日のシフトは既にあります' }, { status: 400 });
  }
  const result = await db.execute({
    sql: 'INSERT INTO shifts (staff_id, date, start_time, end_time) VALUES (?, ?, ?, ?)',
    args: [staff_id, date, start_time, end_time],
  });
  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { id, start_time, end_time, break_minutes, actual_start, actual_end } = await req.json();
  const db = await getDb();
  await db.execute({
    sql: `UPDATE shifts SET start_time = ?, end_time = ?, break_minutes = ?, actual_start = ?, actual_end = ? WHERE id = ?`,
    args: [start_time, end_time, break_minutes ?? 0, actual_start || null, actual_end || null, id],
  });
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

  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM shifts WHERE id = ?', args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
