import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const staffId = searchParams.get('staff_id');

  let query = `
    SELECT pr.id, pr.staff_id, pr.type, pr.punched_at, pr.confirmed, s.name as staff_name
    FROM punch_records pr
    JOIN staff s ON pr.staff_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (session.role === 'staff') {
    query += ' AND pr.staff_id = ?';
    params.push(session.id);
  } else if (staffId) {
    query += ' AND pr.staff_id = ?';
    params.push(Number(staffId));
  }

  if (month) {
    query += " AND pr.punched_at LIKE ?";
    params.push(`${month}%`);
  }

  query += ' ORDER BY pr.punched_at DESC LIMIT 200';
  const records = db.prepare(query).all(...params);

  // ペアにまとめる（出勤→退勤）
  const paired: {
    staff_id: number;
    staff_name: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    confirmed: boolean;
    punch_in_id: number | null;
    punch_out_id: number | null;
  }[] = [];

  const byStaffDate: Record<string, { ins: { id: number; time: string; confirmed: number }[]; outs: { id: number; time: string; confirmed: number }[] }> = {};
  for (const r of records as { id: number; staff_id: number; staff_name: string; type: string; punched_at: string; confirmed: number }[]) {
    const date = r.punched_at.split(' ')[0];
    const key = `${r.staff_id}-${date}`;
    if (!byStaffDate[key]) byStaffDate[key] = { ins: [], outs: [] };
    if (r.type === 'in') byStaffDate[key].ins.push({ id: r.id, time: r.punched_at, confirmed: r.confirmed });
    else byStaffDate[key].outs.push({ id: r.id, time: r.punched_at, confirmed: r.confirmed });
  }

  for (const r of records as { id: number; staff_id: number; staff_name: string; type: string; punched_at: string; confirmed: number }[]) {
    const date = r.punched_at.split(' ')[0];
    const key = `${r.staff_id}-${date}`;
    if (byStaffDate[key]) {
      const inRec = byStaffDate[key].ins[0] || null;
      const outRec = byStaffDate[key].outs[0] || null;
      const allConfirmed = (inRec ? inRec.confirmed === 1 : true) && (outRec ? outRec.confirmed === 1 : true)
        && (inRec !== null || outRec !== null);
      paired.push({
        staff_id: r.staff_id,
        staff_name: r.staff_name,
        date,
        clock_in: inRec?.time || null,
        clock_out: outRec?.time || null,
        confirmed: allConfirmed,
        punch_in_id: inRec?.id || null,
        punch_out_id: outRec?.id || null,
      });
      delete byStaffDate[key]; // 1日1エントリ
    }
  }

  return NextResponse.json(paired);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: '権限がありません' }, { status: 403 });

  const { punch_ids, confirmed } = await req.json();

  if (!Array.isArray(punch_ids) || punch_ids.length === 0) {
    return NextResponse.json({ error: '打刻IDが必要です' }, { status: 400 });
  }

  const db = getDb();
  const confirmVal = confirmed ? 1 : 0;
  const stmt = db.prepare('UPDATE punch_records SET confirmed = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const id of punch_ids) {
      stmt.run(confirmVal, id);
    }
  });
  tx();

  return NextResponse.json({ ok: true, count: punch_ids.length });
}
