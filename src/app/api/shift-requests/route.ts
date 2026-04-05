import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM
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
  const requests = db.prepare(query).all(...params);
  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { date, start_time, end_time, note } = await req.json();
  if (!date || !start_time || !end_time) {
    return NextResponse.json({ error: '日付と時間は必須です' }, { status: 400 });
  }

  const db = getDb();
  // 同じ日の重複チェック
  const existing = db.prepare(
    'SELECT id FROM shift_requests WHERE staff_id = ? AND date = ? AND status != ?'
  ).get(session.id, date, 'rejected');
  if (existing) {
    return NextResponse.json({ error: 'この日は既にシフト希望があります' }, { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO shift_requests (staff_id, date, start_time, end_time, note) VALUES (?, ?, ?, ?, ?)'
  ).run(session.id, date, start_time, end_time, note || '');
  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, status, ids } = await req.json();

  const db = getDb();

  // 一括承認
  if (ids && Array.isArray(ids) && status) {
    if (session.role !== 'owner') {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }
    const stmt = db.prepare('UPDATE shift_requests SET status = ? WHERE id = ?');
    const createShift = db.prepare(`
      INSERT INTO shifts (staff_id, date, start_time, end_time)
      SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?
    `);
    const notifyStmt = db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)');
    const getReq = db.prepare('SELECT staff_id, date FROM shift_requests WHERE id = ?');
    const tx = db.transaction(() => {
      for (const reqId of ids) {
        const r = getReq.get(reqId) as { staff_id: number; date: string } | undefined;
        stmt.run(status, reqId);
        if (status === 'approved') {
          createShift.run(reqId);
        }
        if (r) {
          const label = status === 'approved' ? '承認' : '却下';
          notifyStmt.run(r.staff_id, 'shift', `シフト希望${label}`, `${r.date}のシフト希望が${label}されました`);
        }
      }
    });
    tx();
    return NextResponse.json({ ok: true, count: ids.length });
  }

  // 個別承認/却下
  if (session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const req2 = db.prepare('SELECT staff_id, date FROM shift_requests WHERE id = ?').get(id) as { staff_id: number; date: string } | undefined;
  db.prepare('UPDATE shift_requests SET status = ? WHERE id = ?').run(status, id);
  if (status === 'approved') {
    db.prepare(`
      INSERT INTO shifts (staff_id, date, start_time, end_time)
      SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?
    `).run(id);
  }
  if (req2) {
    const label = status === 'approved' ? '承認' : '却下';
    db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
      .run(req2.staff_id, 'shift', `シフト希望${label}`, `${req2.date}のシフト希望が${label}されました`);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

  const db = getDb();
  const request = db.prepare('SELECT * FROM shift_requests WHERE id = ?').get(Number(id)) as { staff_id: number; status: string } | undefined;
  if (!request) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  if (session.role !== 'owner' && request.staff_id !== session.id) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  if (request.status !== 'pending' && session.role !== 'owner') {
    return NextResponse.json({ error: '承認済みのシフトは削除できません' }, { status: 400 });
  }

  db.prepare('DELETE FROM shift_requests WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
