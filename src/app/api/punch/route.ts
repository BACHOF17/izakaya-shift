import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

function getJSTNow() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  const hours = String(jst.getUTCHours()).padStart(2, '0');
  const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
  const seconds = String(jst.getUTCSeconds()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    datetime: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = await getDb();
  const { date: today } = getJSTNow();

  const punches = await db.execute({
    sql: `SELECT pr.*, s.date, s.start_time, s.end_time
    FROM punch_records pr
    LEFT JOIN shifts s ON pr.shift_id = s.id
    WHERE pr.staff_id = ? AND date(pr.punched_at) = ?
    ORDER BY pr.punched_at`,
    args: [session.id, today],
  });

  const todayShift = await db.execute({
    sql: 'SELECT * FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1',
    args: [session.id, today],
  });

  const lastPunch = await db.execute({
    sql: 'SELECT * FROM punch_records WHERE staff_id = ? ORDER BY punched_at DESC LIMIT 1',
    args: [session.id],
  });

  const lp = lastPunch.rows[0] as unknown as { type: string; punched_at: string } | undefined;
  const isWorking = lp?.type === 'in' && String(lp.punched_at).startsWith(today);

  return NextResponse.json({
    punches: punches.rows,
    todayShift: todayShift.rows[0] || null,
    isWorking,
    lastPunch: lp || null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { type } = await req.json();
  if (type !== 'in' && type !== 'out') {
    return NextResponse.json({ error: '不正なタイプ' }, { status: 400 });
  }

  const db = await getDb();
  const jst = getJSTNow();

  const todayShift = await db.execute({
    sql: 'SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1',
    args: [session.id, jst.date],
  });
  const shiftRow = todayShift.rows[0] as unknown as { id: number } | undefined;

  const statements = [
    {
      sql: 'INSERT INTO punch_records (staff_id, shift_id, type, punched_at) VALUES (?, ?, ?, ?)',
      args: [session.id, shiftRow?.id || null, type, jst.datetime],
    },
  ];

  if (shiftRow) {
    if (type === 'in') {
      statements.push({ sql: 'UPDATE shifts SET actual_start = ? WHERE id = ?', args: [jst.time, shiftRow.id] });
    } else {
      statements.push({ sql: 'UPDATE shifts SET actual_end = ? WHERE id = ?', args: [jst.time, shiftRow.id] });
    }
  }

  await db.batch(statements, 'write');
  return NextResponse.json({ ok: true, time: jst.time, type });
}
