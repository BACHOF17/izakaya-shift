import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

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

  const { type } = await req.json(); // 'in' or 'out'
  if (type !== 'in' && type !== 'out') {
    return NextResponse.json({ error: '不正なタイプ' }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 今日のシフトを探す
  const todayShift = db.prepare(
    'SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1'
  ).get(session.id, today) as { id: number } | undefined;

  // 打刻記録
  db.prepare(
    'INSERT INTO punch_records (staff_id, shift_id, type) VALUES (?, ?, ?)'
  ).run(session.id, todayShift?.id || null, type);

  // シフトの実出退勤を自動更新
  if (todayShift) {
    if (type === 'in') {
      db.prepare('UPDATE shifts SET actual_start = ? WHERE id = ?').run(currentTime, todayShift.id);
    } else {
      db.prepare('UPDATE shifts SET actual_end = ? WHERE id = ?').run(currentTime, todayShift.id);
    }
  }

  return NextResponse.json({ ok: true, time: currentTime, type });
}
