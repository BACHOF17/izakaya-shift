import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { calculateSalary, applySalaryConfig } from '@/lib/salary';
import { getSalarySettings } from '@/app/api/salary-settings/route';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  // 給料設定を適用
  const salarySettings = getSalarySettings();
  applySalaryConfig(salarySettings);

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM
  if (!month) return NextResponse.json({ error: '月を指定してください' }, { status: 400 });

  const db = getDb();

  if (session.role === 'staff') {
    const staff = db.prepare('SELECT id, name, hourly_rate, transport_fee FROM staff WHERE id = ?').get(session.id) as {
      id: number; name: string; hourly_rate: number; transport_fee: number;
    };
    const shifts = db.prepare(
      "SELECT * FROM shifts WHERE staff_id = ? AND date LIKE ? ORDER BY date"
    ).all(session.id, `${month}%`) as {
      date: string; start_time: string; end_time: string; break_minutes: number; actual_start: string | null; actual_end: string | null;
    }[];
    return NextResponse.json([calculateSalary(staff, shifts)]);
  }

  // オーナー：全スタッフの給料計算
  const staffList = db.prepare("SELECT id, name, hourly_rate, transport_fee FROM staff WHERE role = 'staff' AND active = 1").all() as {
    id: number; name: string; hourly_rate: number; transport_fee: number;
  }[];

  const results = staffList.map(staff => {
    const shifts = db.prepare(
      "SELECT * FROM shifts WHERE staff_id = ? AND date LIKE ? ORDER BY date"
    ).all(staff.id, `${month}%`) as {
      date: string; start_time: string; end_time: string; break_minutes: number; actual_start: string | null; actual_end: string | null;
    }[];
    return calculateSalary(staff, shifts);
  });

  return NextResponse.json(results);
}
