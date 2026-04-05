import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = getDb();
  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE staff_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(session.id);

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE staff_id = ? AND read = 0'
  ).get(session.id) as { count: number };

  return NextResponse.json({ notifications, unreadCount: unreadCount.count });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, readAll } = await req.json();
  const db = getDb();

  if (readAll) {
    db.prepare('UPDATE notifications SET read = 1 WHERE staff_id = ?').run(session.id);
  } else if (id) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND staff_id = ?').run(id, session.id);
  }

  return NextResponse.json({ ok: true });
}

// 通知送信ヘルパー（他APIから呼ばれる）
export function sendNotification(db: ReturnType<typeof getDb>, staffId: number, type: string, title: string, message: string) {
  db.prepare(
    'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)'
  ).run(staffId, type, title, message);
}
