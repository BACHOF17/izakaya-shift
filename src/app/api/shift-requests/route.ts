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
    SELECT sr.*, s.name as staff_name
    FROM shift_requests sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (session.role === 'staff') {
    query += ' AND sr.staff_id = ?';
    params.push(session.id);
  } else if (staffId) {
    query += ' AND sr.staff_id = ?';
    params.push(Number(staffId));
  }

  if (month) {
    query += " AND sr.date LIKE ?";
    params.push(`${month}%`);
  }

  query += ' ORDER BY sr.date, sr.start_time';
  const result = await db.execute({ sql: query, args: params });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { date, start_time, end_time, note } = await req.json();
  if (!date || !start_time || !end_time) {
    return NextResponse.json({ error: '日付と時間は必須です' }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.execute({
    sql: 'SELECT id FROM shift_requests WHERE staff_id = ? AND date = ? AND status != ?',
    args: [session.id, date, 'rejected'],
  });
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'この日は既にシフト希望があります' }, { status: 400 });
  }

  const result = await db.execute({
    sql: 'INSERT INTO shift_requests (staff_id, date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)',
    args: [session.id, date, start_time, end_time, note || ''],
  });
  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, status, ids } = await req.json();

  const db = await getDb();

  // 一括承認
  if (ids && Array.isArray(ids) && status) {
    if (session.role !== 'owner') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // バッチで処理（トランザクション）
    const statements = [];
    for (const reqId of ids) {
      const r = await db.execute({ sql: 'SELECT staff_id, date FROM shift_requests WHERE id = ?', args: [reqId] });
      const row = r.rows[0] as unknown as { staff_id: number; date: string } | undefined;
      statements.push({ sql: 'UPDATE shift_requests SET status = ? WHERE id = ?', args: [status, reqId] });
      if (status === 'approved') {
        statements.push({
          sql: 'INSERT INTO shifts (staff_id, date, start_time, end_time) SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?',
          args: [reqId],
        });
      }
      if (row) {
        const label = status === 'approved' ? '承認' : '却下';
        statements.push({
          sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)',
          args: [row.staff_id, 'shift', `シフト希望${label}`, `${row.date}のシフト希望が${label}されました`],
        });
      }
    }
    await db.batch(statements, 'write');
    return NextResponse.json({ ok: true, count: ids.length });
  }

  // 個別承認/却下
  if (session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const reqResult = await db.execute({ sql: 'SELECT staff_id, date FROM shift_requests WHERE id = ?', args: [id] });
  const req2 = reqResult.rows[0] as unknown as { staff_id: number; date: string } | undefined;

  const statements = [
    { sql: 'UPDATE shift_requests SET status = ? WHERE id = ?', args: [status, id] },
  ];

  if (status === 'approved') {
    statements.push({
      sql: 'INSERT INTO shifts (staff_id, date, start_time, end_time) SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?',
      args: [id],
    });
  }

  if (req2) {
    const label = status === 'approved' ? '承認' : '却下';
    statements.push({
      sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)',
      args: [req2.staff_id, 'shift', `シフト希望${label}`, `${req2.date}のシフト希望が${label}されました`],
    });
  }

  await db.batch(statements, 'write');
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

  const db = await getDb();
  const result = await db.execute({ sql: 'SELECT * FROM shift_requests WHERE id = ?', args: [Number(id)] });
  const request = result.rows[0] as unknown as { staff_id: number; status: string } | undefined;
  if (!request) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  if (session.role !== 'owner' && Number(request.staff_id) !== session.id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  if (request.status !== 'pending' && session.role !== 'owner') {
    return NextResponse.json({ error: '承認済みのシフトは削除できません' }, { status: 400 });
  }

  await db.execute({ sql: 'DELETE FROM shift_requests WHERE id = ?', args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
