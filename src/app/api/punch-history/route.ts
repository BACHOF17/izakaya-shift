import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const staffId = searchParams.get('staff_id');

  let query = `
    SELECT pr.id, pr.staff_id, pr.type, pr.punched_at, s.name as staff_name
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
  const result = await db.execute({ sql: query, args: params });
  const records = result.rows;

  // ペアにまとめる（出勤→退勤）
  const paired: {
    staff_id: number;
    staff_name: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
  }[] = [];

  const byStaffDate: Record<string, { ins: string[]; outs: string[] }> = {};
  for (const r of records as unknown as { staff_id: number; staff_name: string; type: string; punched_at: string }[]) {
    const date = String(r.punched_at).split(' ')[0];
    const key = `${r.staff_id}-${date}`;
    if (!byStaffDate[key]) byStaffDate[key] = { ins: [], outs: [] };
    if (r.type === 'in') byStaffDate[key].ins.push(String(r.punched_at));
    else byStaffDate[key].outs.push(String(r.punched_at));
  }

  for (const r of records as unknown as { staff_id: number; staff_name: string; type: string; punched_at: string }[]) {
    const date = String(r.punched_at).split(' ')[0];
    const key = `${r.staff_id}-${date}`;
    if (byStaffDate[key]) {
      paired.push({
        staff_id: Number(r.staff_id),
        staff_name: String(r.staff_name),
        date,
        clock_in: byStaffDate[key].ins[0] || null,
        clock_out: byStaffDate[key].outs[0] || null,
      });
      delete byStaffDate[key];
    }
  }

  return NextResponse.json(paired);
}
