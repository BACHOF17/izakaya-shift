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
  const datesParam = searchParams.get('dates');
  const targetDates = datesParam ? new Set(datesParam.split(',')) : null;

  if (!month) return NextResponse.json({ error: '月を指定してください' }, { status: 400 });

  const db = await getDb();

  const requestsResult = await db.execute({
    sql: `SELECT sr.id, sr.staff_id, sr.date, sr.start_time, sr.end_time, sr.status, s.name as staff_name
    FROM shift_requests sr
    JOIN staff s ON sr.staff_id = s.id
    WHERE sr.date LIKE ? AND sr.status = 'pending'
    ORDER BY sr.date, sr.start_time`,
    args: [`${month}%`],
  });
  const requests = requestsResult.rows as unknown as ShiftRequest[];

  const existingResult = await db.execute({
    sql: 'SELECT date, staff_id FROM shifts WHERE date LIKE ?',
    args: [`${month}%`],
  });
  const existingShifts = existingResult.rows as unknown as { date: string; staff_id: number }[];

  const existingSet = new Set(existingShifts.map(s => `${s.date}-${s.staff_id}`));

  const staffDayCounts: Record<number, number> = {};
  for (const s of existingShifts) {
    staffDayCounts[s.staff_id] = (staffDayCounts[s.staff_id] || 0) + 1;
  }

  const dateRequests: Record<string, ShiftRequest[]> = {};
  for (const r of requests) {
    if (targetDates && !targetDates.has(r.date)) continue;
    if (existingSet.has(`${r.date}-${r.staff_id}`)) continue;
    if (!dateRequests[r.date]) dateRequests[r.date] = [];
    dateRequests[r.date].push(r);
  }

  const schedule: ScheduleSlot[] = [];
  const assignedCounts = { ...staffDayCounts };
  const sortedDates = Object.keys(dateRequests).sort();

  for (const date of sortedDates) {
    const dayRequests = dateRequests[date];
    if (dayRequests.length === 0) continue;

    dayRequests.sort((a, b) => {
      const countA = assignedCounts[a.staff_id] || 0;
      const countB = assignedCounts[b.staff_id] || 0;
      return countA - countB;
    });

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

  const staffSummary: Record<number, { name: string; days: number; totalDays: number }> = {};
  for (const slot of schedule) {
    for (const s of slot.staff) {
      if (!staffSummary[s.id]) {
        staffSummary[s.id] = { name: s.name, days: 0, totalDays: assignedCounts[s.id] || 0 };
      }
      staffSummary[s.id].days++;
    }
  }

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

  const db = await getDb();

  let created = 0;
  let skipped = 0;

  // 各リクエストを事前に取得してステートメント構築
  const statements = [];
  for (const id of requestIds) {
    const rResult = await db.execute({
      sql: 'SELECT staff_id, date, start_time, end_time FROM shift_requests WHERE id = ?',
      args: [id],
    });
    const r = rResult.rows[0] as unknown as { staff_id: number; date: string; start_time: string; end_time: string } | undefined;
    if (!r) { skipped++; continue; }

    const existingResult = await db.execute({
      sql: 'SELECT id FROM shifts WHERE staff_id = ? AND date = ? LIMIT 1',
      args: [r.staff_id, r.date],
    });

    statements.push({ sql: 'UPDATE shift_requests SET status = ? WHERE id = ?', args: ['approved', id] });

    if (existingResult.rows.length > 0) {
      skipped++;
      continue;
    }

    statements.push({
      sql: 'INSERT INTO shifts (staff_id, date, start_time, end_time) VALUES (?, ?, ?, ?)',
      args: [r.staff_id, r.date, r.start_time, r.end_time],
    });
    statements.push({
      sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)',
      args: [r.staff_id, 'shift', 'シフト確定', `${r.date}のシフトが確定しました`],
    });
    created++;
  }

  if (statements.length > 0) {
    await db.batch(statements, 'write');
  }

  return NextResponse.json({ ok: true, created, skipped, total: requestIds.length });
}
