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

interface StaffSlot {
  id: number;
  name: string;
  start: string;
  end: string;
  requestId: number;
}

interface ScheduleSlot {
  date: string;
  staff: StaffSlot[];
}

// GET: プレビュー（自動調整のシミュレーション結果を返す）
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const maxStaff = parseInt(searchParams.get('max_staff') || '99');
  const datesParam = searchParams.get('dates'); // カンマ区切りの日付
  const targetDates = datesParam ? new Set(datesParam.split(',')) : null;

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

  // 既に確定済みのシフトを取得（shifts テーブルから）
  const existingShifts = db.prepare(`
    SELECT date, staff_id FROM shifts WHERE date LIKE ?
  `).all(`${month}%`) as { date: string; staff_id: number }[];

  const existingSet = new Set(existingShifts.map(s => `${s.date}-${s.staff_id}`));

  // スタッフの月間勤務日数カウント（既存の確定シフトから）
  const staffDayCounts: Record<number, number> = {};
  for (const s of existingShifts) {
    staffDayCounts[s.staff_id] = (staffDayCounts[s.staff_id] || 0) + 1;
  }

  // 日付ごとにグループ化
  const dateRequests: Record<string, ShiftRequest[]> = {};
  for (const r of requests) {
    // 対象日フィルター
    if (targetDates && !targetDates.has(r.date)) continue;
    // 既に確定シフトがあるスタッフ×日をスキップ
    if (existingSet.has(`${r.date}-${r.staff_id}`)) continue;
    if (!dateRequests[r.date]) dateRequests[r.date] = [];
    dateRequests[r.date].push(r);
  }

  // 自動調整ロジック
  const schedule: ScheduleSlot[] = [];
  const assignedCounts = { ...staffDayCounts };
  const sortedDates = Object.keys(dateRequests).sort();

  for (const date of sortedDates) {
    const dayRequests = dateRequests[date];
    if (dayRequests.length === 0) continue;

    // 勤務日数が少ないスタッフを優先（公平性）
    dayRequests.sort((a, b) => {
      const countA = assignedCounts[a.staff_id] || 0;
      const countB = assignedCounts[b.staff_id] || 0;
      return countA - countB;
    });

    // 全員を割り当て（maxStaff以下）
    const assigned = dayRequests.slice(0, Math.min(maxStaff, dayRequests.length));

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

  // 全リクエストID（確定ボタン用）
  const allRequestIds: number[] = [];
  for (const slot of schedule) {
    for (const s of slot.staff) {
      allRequestIds.push(s.requestId);
    }
  }

  return NextResponse.json({
    schedule,
    staffSummary: Object.values(staffSummary),
    totalDays: schedule.length,
    pendingCount: requests.length,
    allRequestIds,
  });
}

// POST: 自動調整結果を確定（一括承認＋シフト作成）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { requestIds } = await req.json();
  if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
    return NextResponse.json({ error: 'リクエストIDが必要です' }, { status: 400 });
  }

  const db = getDb();

  // 重複チェック用
  const checkExisting = db.prepare('SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1');
  const updateStatus = db.prepare('UPDATE shift_requests SET status = ? WHERE id = ?');
  const getReq = db.prepare('SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?');
  const insertShift = db.prepare('INSERT INTO shifts (staff_id, date, start_time, end_time) VALUES (?, ?, ?, ?)');
  const notifyStmt = db.prepare('INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)');

  let created = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const id of requestIds) {
      const r = getReq.get(id) as { staff_id: number; date: string; start_time: string; end_time: string } | undefined;
      if (!r) { skipped++; continue; }

      // 既に同じ日・同じスタッフのシフトがあればスキップ
      const existing = checkExisting.get(r.staff_id, r.date);
      if (existing) {
        updateStatus.run('approved', id); // 希望だけ承認に
        skipped++;
        continue;
      }

      // 承認＋シフト作成
      updateStatus.run('approved', id);
      insertShift.run(r.staff_id, r.date, r.start_time, r.end_time);
      notifyStmt.run(r.staff_id, 'shift', 'シフト確定', `${r.date}のシフトが確定しました`);
      created++;
    }
  });
  tx();

  return NextResponse.json({ ok: true, created, skipped, total: requestIds.length });
}
