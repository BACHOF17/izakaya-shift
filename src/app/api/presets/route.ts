import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

const DEFAULT_PRESETS = [
  { id: 'dinner', label: 'ディナー', start: '17:00', end: '23:00', icon: '🌙' },
  { id: 'last', label: 'ラスト', start: '17:00', end: '01:00', icon: '🌃' },
  { id: 'lunch', label: 'ランチ', start: '11:00', end: '15:00', icon: '☀️' },
  { id: 'full', label: '通し', start: '11:00', end: '23:00', icon: '💪' },
];

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'time_presets'").get() as { value: string } | undefined;
  if (row) {
    return NextResponse.json(JSON.parse(row.value));
  }
  return NextResponse.json(DEFAULT_PRESETS);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }
  const { presets } = await req.json();
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('time_presets', ?)").run(JSON.stringify(presets));
  return NextResponse.json({ ok: true });
}
