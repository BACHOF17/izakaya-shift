import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export interface SalarySettings {
  lateNightStart: string;
  lateNightEnd: string;
  lateNightRate: number;
  overtimeThreshold: number;
  overtimeRate: number;
}

const DEFAULT_SETTINGS: SalarySettings = {
  lateNightStart: '22:00',
  lateNightEnd: '05:00',
  lateNightRate: 1.25,
  overtimeThreshold: 480,
  overtimeRate: 1.25,
};

export async function getSalarySettings(): Promise<SalarySettings> {
  const db = await getDb();
  const result = await db.execute("SELECT value FROM settings WHERE key = 'salary_settings'");
  if (result.rows.length > 0) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(String(result.rows[0].value)) };
  }
  return DEFAULT_SETTINGS;
}

export async function GET() {
  return NextResponse.json(await getSalarySettings());
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const settings = await req.json();
  const db = await getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('salary_settings', ?)",
    args: [JSON.stringify(settings)],
  });
  return NextResponse.json({ ok: true });
}
