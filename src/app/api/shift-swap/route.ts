import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'open';

  let swaps;
  if (session.role === 'owner') {
    // オーナーは承認待ちを表示
    swaps = db.prepare(`
      SELECT ss.*,
        r.name as requester_name,
        t.name as target_name,
        sh.date, sh.start_time, sh.end_time
      FROM shift_swaps ss
      JOIN staff r ON ss.requester_id = r.id
      LEFT JOIN staff t ON ss.target_id = t.id
      JOIN shifts sh ON ss.shift_id = sh.id
      WHERE ss.status = ?
      ORDER BY ss.created_at DESC
    `).all(status);
  } else {
    // スタッフは自分関連のもの + オープンな交換募集
    swaps = db.prepare(`
      SELECT ss.*,
        r.name as requester_name,
        t.name as target_name,
        sh.date, sh.start_time, sh.end_time
      FROM shift_swaps ss
      JOIN staff r ON ss.requester_id = r.id
      LEFT JOIN staff t ON ss.target_id = t.id
      JOIN shifts sh ON ss.shift_id = sh.id
      WHERE ss.status = ? AND (ss.requester_id = ? OR ss.target_id = ? OR ss.target_id IS NULL)
      ORDER BY ss.created_at DESC
    `).all(status, session.id, session.id);
  }

  return NextResponse.json(swaps);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { shift_id, reason } = await req.json();
  const db = getDb();

  // シフトが自分のものか確認
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ? AND staff_id = ?').get(shift_id, session.id);
  if (!shift) return NextResponse.json({ error: 'シフトが見つかりません' }, { status: 404 });

  const result = db.prepare(
    'INSERT INTO shift_swaps (requester_id, shift_id, reason) VALUES (?, ?, ?)'
  ).run(session.id, shift_id, reason || '');

  // オーナーに通知
  const owners = db.prepare("SELECT id FROM staff WHERE role = 'owner' AND active = 1").all() as { id: number }[];
  for (const owner of owners) {
    db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
      .run(owner.id, 'swap', 'シフト交換リクエスト', `${session.name}さんがシフト交換を希望しています`);
  }

  return NextResponse.json({ id: result.lastInsertRowid });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, action, target_id } = await req.json();
  const db = getDb();

  const swap = db.prepare('SELECT * FROM shift_swaps WHERE id = ?').get(id) as {
    id: number; requester_id: number; shift_id: number; target_id: number | null; status: string;
  } | undefined;
  if (!swap) return NextResponse.json({ error: '見つかりません' }, { status: 404 });

  if (action === 'volunteer') {
    // スタッフが代わりを名乗り出る
    db.prepare('UPDATE shift_swaps SET target_id = ?, status = ? WHERE id = ?')
      .run(session.id, 'accepted', id);

    // 依頼者に通知
    db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
      .run(swap.requester_id, 'swap', 'シフト交換の応募', `${session.name}さんが代わりを引き受けてくれました`);

    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' && session.role === 'owner') {
    // オーナー承認 → シフトの担当を交代
    db.prepare('UPDATE shift_swaps SET status = ? WHERE id = ?').run('approved', id);

    const targetId = swap.target_id || target_id;
    if (targetId) {
      db.prepare('UPDATE shifts SET staff_id = ? WHERE id = ?').run(targetId, swap.shift_id);

      // 両者に通知
      db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
        .run(swap.requester_id, 'swap', 'シフト交換承認', 'シフト交換が承認されました');
      db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
        .run(targetId, 'swap', 'シフト交換承認', 'シフト交換が承認されました。新しいシフトを確認してください');
    }

    return NextResponse.json({ ok: true });
  }

  if (action === 'reject' && session.role === 'owner') {
    db.prepare('UPDATE shift_swaps SET status = ? WHERE id = ?').run('rejected', id);
    db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)')
      .run(swap.requester_id, 'swap', 'シフト交換却下', 'シフト交換が却下されました');
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel' && swap.requester_id === session.id) {
    db.prepare('UPDATE shift_swaps SET status = ? WHERE id = ?').run('cancelled', id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: '不正な操作' }, { status: 400 });
}
