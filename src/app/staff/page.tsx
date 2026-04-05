'use client';

import { useState, useEffect } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface ShiftRequest {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  note: string;
}

export default function StaffDashboard() {
  const { session, loading } = useSession();
  const [requests, setRequests] = useState<ShiftRequest[]>([]);

  useEffect(() => {
    if (!session) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fetch(`/api/shift-requests?month=${month}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRequests(data); })
      .catch(() => {});
  }, [session]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': return { text: '未承認', color: 'bg-yellow-100 text-yellow-700' };
      case 'approved': return { text: '承認済', color: 'bg-green-100 text-green-700' };
      case 'rejected': return { text: '却下', color: 'bg-red-100 text-red-700' };
      default: return { text: s, color: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading || !session) return <div className="flex items-center justify-center min-h-screen text-gray-400">読み込み中...</div>;

  const today = new Date().toISOString().split('T')[0];
  const upcoming = requests.filter(r => r.date >= today && r.status === 'approved');

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <h2 className="text-xl font-bold">ダッシュボード</h2>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">今後の確定シフト</h3>
          {upcoming.length === 0 ? (
            <p className="text-gray-400 text-sm">今後の確定シフトはありません</p>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map(r => {
                const st = statusLabel(r.status);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{r.date}</span>
                      <span className="text-gray-500 ml-2 text-sm">{r.start_time} - {r.end_time}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">今月のシフト希望状況</h3>
          {requests.length === 0 ? (
            <p className="text-gray-400 text-sm">今月のシフト希望はまだありません</p>
          ) : (
            <div className="space-y-2">
              {requests.map(r => {
                const st = statusLabel(r.status);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{r.date}</span>
                      <span className="text-gray-500 ml-2 text-sm">{r.start_time} - {r.end_time}</span>
                      {r.note && <span className="text-gray-400 ml-2 text-xs">{r.note}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                      {st.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
