import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calculateSalary, applySalaryConfig } from '@/lib/salary';
import { getSalarySettings } from '@/app/api/salary-settings/route';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const salarySettings = await getSalarySettings();
  applySalaryConfig(salarySettings);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month) return NextResponse.json({ error: '月を指定してください' }, { status: 400 });

  const db = await getDb();

  if (session.role === 'staff') {
    const staffResult = await db.execute({
      sql: 'SELECT id, name, hourly_rate, transport_fee FROM staff WHERE id = ?',
      args: [session.id],
    });
    const staff = staffResult.rows[0] as unknown as { id: number; name: string; hourly_rate: number; transport_fee: number };
    const shiftsResult = await db.execute({
      sql: "SELECT * FROM shifts WHERE staff_id = ? AND date LIKE ? ORDER BY date",
      args: [session.id, `${month}%`],
    });
    const shifts = shiftsResult.rows as unknown as {
      date: string; start_time: string; end_time: string; break_minutes: number; actual_start: string | null; actual_end: string | null;
    }[];
    return NextResponse.json([calculateSalary(staff, shifts)]);
  }

  // オーナー：全スタッフの給料計算
  const staffResult = await db.execute("SELECT id, name, hourly_rate, transport_fee FROM staff WHERE role = 'staff' AND active = 1");
  const staffList = staffResult.rows as unknown as { id: number; name: string; hourly_rate: number; transport_fee: number }[];

  const results = [];
  for (const staff of staffList) {
    const shiftsResult = await db.execute({
      sql: "SELECT * FROM shifts WHERE staff_id = ? AND date LIKE ? ORDER BY date",
      args: [staff.id, `${month}%`],
    });
    const shifts = shiftsResult.rows as unknown as {
      date: string; start_time: string; end_time: string; break_minutes: number; actual_start: string | null; actual_end: string | null;
    }[];
    results.push(calculateSalary(staff, shifts));
  }

  return NextResponse.json(results);
}
