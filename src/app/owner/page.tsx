'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

export default function OwnerDashboard() {
  const { session } = useSession('owner');
  const [pendingCount, setPendingCount] = useState(0);
  const [todayShifts, setTodayShifts] = useState<{ staff_name: string; start_time: string; end_time: string }[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    // 未承認のシフト希望数
    fetch(`/api/shift-requests?month=${month}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingCount(data.filter((r: { status: string }) => r.status === 'pending').length);
        }
      }).catch(() => {});

    // 今日のシフト
    fetch(`/api/shifts?month=${month}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTodayShifts(data.filter((s: { date: string }) => s.date === today));
        }
      }).catch(() => {});

    // スタッフ数
    fetch('/api/staff')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStaffCount(data.filter((s: { role: string; active: number }) => s.role === 'staff' && s.active).length);
        }
      }).catch(() => {});
  }, [session]);

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <h2 className="text-xl font-bold">ダッシュボード</h2>

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/owner/shifts')}
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold text-orange-500">{pendingCount}</p>
            <p className="text-sm text-gray-500 mt-1">未承認の希望</p>
          </button>
          <button
            onClick={() => router.push('/owner/shifts')}
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold text-blue-500">{todayShifts.length}</p>
            <p className="text-sm text-gray-500 mt-1">今日のシフト</p>
          </button>
          <button
            onClick={() => router.push('/owner/staff')}
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold text-green-500">{staffCount}</p>
            <p className="text-sm text-gray-500 mt-1">スタッフ数</p>
          </button>
        </div>

        {/* 今日のシフト */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">今日のシフト</h3>
          {todayShifts.length === 0 ? (
            <p className="text-gray-400 text-sm">今日のシフトはありません</p>
          ) : (
            <div className="space-y-2">
              {todayShifts.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{s.staff_name}</span>
                  <span className="text-gray-500 text-sm">{s.start_time} - {s.end_time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* クイックリンク */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/owner/auto-schedule')}
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md text-sm">
            🤖 自動シフト調整
          </button>
          <button onClick={() => router.push('/owner/settings')}
            className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md text-sm">
            ⚙️ 店舗設定
          </button>
        </div>
      </div>
    </div>
  );
}
