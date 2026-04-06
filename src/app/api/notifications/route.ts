import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Client } from '@libsql/client';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const db = await getDb();
  const notifResult = await db.execute({
    sql: 'SELECT * FROM notifications WHERE staff_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [session.id],
  });

  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM notifications WHERE staff_id = ? AND read = 0',
    args: [session.id],
  });

  return NextResponse.json({
    notifications: notifResult.rows,
    unreadCount: Number(countResult.rows[0].count),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未認証' }, { status: 401 });

  const { id, readAll } = await req.json();
  const db = await getDb();

  if (readAll) {
    await db.execute({ sql: 'UPDATE notifications SET read = 1 WHERE staff_id = ?', args: [session.id] });
  } else if (id) {
    await db.execute({ sql: 'UPDATE notifications SET read = 1 WHERE id = ? AND staff_id = ?', args: [id, session.id] });
  }

  return NextResponse.json({ ok: true });
}

// 通知送信ヘルパー（他APIから呼ばれる）
export async function sendNotification(db: Client, staffId: number, type: string, title: string, message: string) {
  await db.execute({
    sql: 'INSERT INTO notifications (staff_id, type, title, message) VALUES (?, ?, ?, ?)',
    args: [staffId, type, title, message],
  });
}
