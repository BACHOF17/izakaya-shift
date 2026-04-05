import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface ShiftRequest {
  id: number;
  staff_id: number;
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface ScheduleSlot {
  date: string;
  staff: { id: number; name: string; start: string; end: string; requestId: number }[];
}

// GET: プレビュー（自動調整のシミュレーション結果を返す）
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const minStaff = parseInt(searchParams.get('min_staff') || '1');
  const maxStaff = parseInt(searchParams.get('max_staff') || '99');

  if (!month) return NextResponse.json({ error: '月を指定してください' }, { status: 400 });

  const db = getDb();

  // 未承認のシフト希望を取得
  const requests = db.prepare(`
    SELECT sr.id, sr.staff_id, sr.date, sr.start_time, sr.end_time, sr.status, s.name as staff_name
    FROM shift_requests sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE sr.date LIKE ? AND sr.status = 'pending'
    ORDER BY sr.date, sr.start_time
  `).all(`${month}%`) as ShiftRequest[];

  // 既に承認済みのシフトを取得
  const approved = db.prepare(`
    SELECT sr.date, sr.staff_id
    FROM shift_requests sr
    WHERE sr.date LIKE ? AND sr.status = 'approved'
  `).all(`${month}%`) as { date: string; staff_id: number }[];

  const approvedSet = new Set(approved.map(a => `${a.date}-${a.staff_id}`));

  // スタッフの月間勤務日数カウント
  const staffDayCounts: Record<number, number> = {};
  for (const a of approved) {
    staffDayCounts[a.staff_id] = (staffDayCounts[a.staff_id] || 0) + 1;
  }

  // 日付ごとにグループ化
  const dateRequests: Record<string, ShiftRequest[]> = {};
  for (const r of requests) {
    if (!dateRequests[r.date]) dateRequests[r.date] = [];
    dateRequests[r.date].push(r);
  }

  // 自動調整ロジック
  const schedule: ScheduleSlot[] = [];
  const assignedCounts = { ...staffDayCounts }; // 既存のカウントを引き継ぐ

  const sortedDates = Object.keys(dateRequests).sort();

  for (const date of sortedDates) {
    const dayRequests = dateRequests[date];
    // 既に承認済みのスタッフを除外
    const available = dayRequests.filter(r => !approvedSet.has(`${r.date}-${r.staff_id}`));

    if (available.length === 0) continue;

    // 勤務日数が少ないスタッフを優先（公平性）
    available.sort((a, b) => {
      const countA = assignedCounts[a.staff_id] || 0;
      const countB = assignedCounts[b.staff_id] || 0;
      return countA - countB;
    });

    // minStaff以上maxStaff以下のスタッフを割り当て
    const assigned = available.slice(0, Math.min(maxStaff, available.length));

    if (assigned.length >= minStaff) {
      const slot: ScheduleSlot = {
        date,
        staff: assigned.map(r => ({
          id: r.staff_id,
          name: r.staff_name,
          start: r.start_time,
          end: r.end_time,
          requestId: r.id,
        })),
      };
      schedule.push(slot);

      for (const s of assigned) {
        assignedCounts[s.staff_id] = (assignedCounts[s.staff_id] || 0) + 1;
      }
    }
  }

  // スタッフ別のサマリー
  const staffSummary: Record<number, { name: string; days: number; totalDays: number }> = {};
  for (const slot of schedule) {
    for (const s of slot.staff) {
      if (!staffSummary[s.id]) {
        staffSummary[s.id] = { name: s.name, days: 0, totalDays: assignedCounts[s.id] || 0 };
      }
      staffSummary[s.id].days++;
    }
  }

  return NextResponse.json({
    schedule,
    staffSummary: Object.values(staffSummary),
    totalDays: schedule.length,
    pendingCount: requests.length,
  });
}

// POST: 自動調整結果を確定（一括承認）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { requestIds } = await req.json();
  if (!requestIds || !Array.isArray(requestIds)) {
    return NextResponse.json({ error: 'リクエストIDが必要です' }, { status: 400 });
  }

  const db = getDb();
  const stmt = db.prepare('UPDATE shift_requests SET status = ? WHERE id = ?');
  const createShift = db.prepare(`
    INSERT INTO shifts (staff_id, date, start_time, end_time)
    SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?
  `);
  const notifyStmt = db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)');
  const getReq = db.prepare('SELECT staff_id, date FROM shift_requests WHERE id = ?');

  const tx = db.transaction(() => {
    for (const id of requestIds) {
      const r = getReq.get(id) as { staff_id: number; date: string } | undefined;
      stmt.run('approved', id);
      createShift.run(id);
      if (r) {
        notifyStmt.run(r.staff_id, 'shift', 'シフト確定', `${r.date}のシフトが確定しました`);
      }
    }
  });
  tx();

  return NextResponse.json({ ok: true, count: requestIds.length });
}
