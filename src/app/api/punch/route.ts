import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

function getJSTNow() {
  const now = new Date();
  // UTC→JST（+9時間）
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

  const db = getDb();
  const { date: today } = getJSTNow();

  // 今日の打刻記録
  const punches = db.prepare(`
    SELECT pr.*, s.date, s.start_time, s.end_time
    FROM punch_records pr
    LEFT JOIN shifts s ON pr.shift_id = s.id
    WHERE pr.staff_id = ? AND date(pr.punched_at) = ?
    ORDER BY pr.punched_at
  `).all(session.id, today);

  // 今日のシフト
  const todayShift = db.prepare(`
    SELECT * FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1
  `).get(session.id, today);

  // 最新の打刻状態
  const lastPunch = db.prepare(`
    SELECT * FROM punch_records WHERE staff_id = ? ORDER BY punched_at DESC LIMIT 1
  `).get(session.id) as { type: string; punched_at: string } | undefined;

  const isWorking = lastPunch?.type === 'in' && lastPunch.punched_at.startsWith(today);

  return NextResponse.json({ punches, todayShift, isWorking, lastPunch });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { type } = await req.json();
  if (type !== 'in' && type !== 'out') {
    return NextResponse.json({ error: '不正なタイプ' }, { status: 400 });
  }

  const db = getDb();
  const jst = getJSTNow();

  // 今日のシフトを探す
  const todayShift = db.prepare(
    'SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1'
  ).get(session.id, jst.date) as { id: number } | undefined;

  // 打刻記録（JSTの日時で保存）
  db.prepare(
    'INSERT INTO punch_records (staff_id, shift_id, type, punched_at) VALUES (?, ?, ?, ?)'
  ).run(session.id, todayShift?.id || null, type, jst.datetime);

  // シフトの実出退勤を自動更新
  if (todayShift) {
    if (type === 'in') {
      db.prepare('UPDATE shifts SET actual_start = ? WHERE id = ?').run(jst.time, todayShift.id);
    } else {
      db.prepare('UPDATE shifts SET actual_end = ? WHERE id = ?').run(jst.time, todayShift.id);
    }
  }

  return NextResponse.json({ ok: true, time: jst.time, type });
}
