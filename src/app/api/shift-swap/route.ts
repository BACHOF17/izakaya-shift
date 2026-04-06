import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'open';

  let result;
  if (session.role === 'owner') {
    result = await db.execute({
      sql: `SELECT ss.*,
        r.name as requester_name,
        t.name as target_name,
        sh.date, sh.start_time, sh.end_time
      FROM shift_swaps ss
      JOIN staff r ON ss.requester_id = r.id
      LEFT JOIN staff t ON ss.target_id = t.id
      JOIN shifts sh ON ss.shift_id = sh.id
      WHERE ss.status = ?
      ORDER BY ss.created_at DESC`,
      args: [status],
    });
  } else {
    result = await db.execute({
      sql: `SELECT ss.*,
        r.name as requester_name,
        t.name as target_name,
        sh.date, sh.start_time, sh.end_time
      FROM shift_swaps ss
      JOIN staff r ON ss.requester_id = r.id
      LEFT JOIN staff t ON ss.target_id = t.id
      JOIN shifts sh ON ss.shift_id = sh.id
      WHERE ss.status = ? AND (ss.requester_id = ? OR ss.target_id = ? OR ss.target_id IS NULL)
      ORDER BY ss.created_at DESC`,
      args: [status, session.id, session.id],
    });
  }

  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { shift_id, reason } = await req.json();
  const db = await getDb();

  const shiftResult = await db.execute({
    sql: 'SELECT * FROM shifts WHERE id = ? AND staff_id = ?',
    args: [shift_id, session.id],
  });
  if (shiftResult.rows.length === 0) return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 });

  const result = await db.execute({
    sql: 'INSERT INTO shift_swaps (requester_id, shift_id, reason) VALUES (?, ?, ?)',
    args: [session.id, shift_id, reason || ''],
  });

  // オーナーに通知
  const owners = await db.execute("SELECT id FROM staff WHERE role = 'owner' AND active = 1");
  const notifyStatements = owners.rows.map(owner => ({
    sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)',
    args: [owner.id, 'swap', 'シフト交換リクエスト', `${session.name}さんがシフト交換を希望しています`],
  }));
  if (notifyStatements.length > 0) {
    await db.batch(notifyStatements, 'write');
  }

  return NextResponse.json({ id: Number(result.lastInsertRowid) });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, action, target_id } = await req.json();
  const db = await getDb();

  const swapResult = await db.execute({ sql: 'SELECT * FROM shift_swaps WHERE id = ?', args: [id] });
  const swap = swapResult.rows[0] as unknown as {
    id: number; requester_id: number; shift_id: number; target_id: number | null; status: string;
  } | undefined;
  if (!swap) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  if (action === 'volunteer') {
    await db.batch([
      { sql: 'UPDATE shift_swaps SET target_id = ?, status = ? WHERE id = ?', args: [session.id, 'accepted', id] },
      { sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)', args: [swap.requester_id, 'swap', 'シフト交換の応募', `${session.name}さんが代わりを引き受けてくれました`] },
    ], 'write');
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' && session.role === 'owner') {
    const targetId = swap.target_id || target_id;
    const statements = [
      { sql: 'UPDATE shift_swaps SET status = ? WHERE id = ?', args: ['approved', id] },
    ];
    if (targetId) {
      statements.push(
        { sql: 'UPDATE shifts SET staff_id = ? WHERE id = ?', args: [targetId, swap.shift_id] },
        { sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)', args: [swap.requester_id, 'swap', 'シフト交換承認', 'シフト交換が承認されました'] },
        { sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)', args: [targetId, 'swap', 'シフト交換承認', 'シフト交換が承認されました。新しいシフトを確認してください'] },
      );
    }
    await db.batch(statements, 'write');
    return NextResponse.json({ ok: true });
  }

  if (action === 'reject' && session.role === 'owner') {
    await db.batch([
      { sql: 'UPDATE shift_swaps SET status = ? WHERE id = ?', args: ['rejected', id] },
      { sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)', args: [swap.requester_id, 'swap', 'シフト交換却下', 'シフト交換が却下されました'] },
    ], 'write');
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel' && Number(swap.requester_id) === session.id) {
    await db.execute({ sql: 'UPDATE shift_swaps SET status = ? WHERE id = ?', args: ['cancelled', id] });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: '不正な操作' }, { status: 400 });
}
