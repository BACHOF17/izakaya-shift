import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export interface SalarySettings {
  lateNightStart: string;   // 深夜帯開始 (例: "22:00")
  lateNightEnd: string;     // 深夜帯終了 (例: "05:00")
  lateNightRate: number;    // 深夜手当倍率 (例: 1.25 = 25%増)
  overtimeThreshold: number; // 残業開始時間（分） (例: 480 = 8時間)
  overtimeRate: number;     // 残業手当倍率 (例: 1.25 = 25%増)
}

const DEFAULT_SETTINGS: SalarySettings = {
  lateNightStart: '22:00',
  lateNightEnd: '05:00',
  lateNightRate: 1.25,
  overtimeThreshold: 480,
  overtimeRate: 1.25,
};

export function getSalarySettings(): SalarySettings {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'salary_settings'").get() as { value: string } | undefined;
  if (row) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  }
  return DEFAULT_SETTINGS;
}

export async function GET() {
  return NextResponse.json(getSalarySettings());
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const settings = await req.json();
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('salary_settings', ?)").run(JSON.stringify(settings));
  return NextResponse.json({ ok: true });
}
