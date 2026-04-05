'use client';

import { useState, useEffect } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface PunchRecord {
  staff_id: number;
  staff_name: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
}

export default function OwnerPunchHistoryPage() {
  const { session } = useSession('owner');
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    const url = staffFilter !== 'all'
      ? `/api/punch-history?month=${selectedMonth}&staff_id=${staffFilter}`
      : `/api/punch-history?month=${selectedMonth}`;
    fetch(url)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data); })
      .catch(() => {});
  }, [selectedMonth, staffFilter]);

  const formatTime = (dt: string | null) => {
    if (!dt) return '--:--';
    const parts = dt.split(' ');
    return parts[1] ? parts[1].slice(0, 5) : dt.slice(0, 5);
  };

  // スタッフ名一覧
  const staffNames = [...new Set(records.map(r => JSON.stringify({ id: r.staff_id, name: r.staff_name })))]
    .map(s => JSON.parse(s) as { id: number; name: string });

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">打刻履歴</h2>
          <input type="month" value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" />
        </div>

        {/* スタッフフィルター */}
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => setStaffFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
              staffFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'
            }`}>全員</button>
          {staffNames.map(s => (
            <button key={s.id} onClick={() => setStaffFilter(String(s.id))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                staffFilter === String(s.id) ? 'bg-orange-500 text-white' : 'bg-white text-gray-600'
              }`}>{s.name}</button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-orange-600">{records.length}</span>
            <span className="text-gray-500 ml-1 text-sm">件の打刻記録</span>
          </div>

          {records.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">この月の打刻記録はありません</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-3">
                <span>スタッフ</span>
                <span>日付</span>
                <span className="text-center">出勤</span>
                <span className="text-center">退勤</span>
              </div>
              {records.map((r, i) => (
                <div key={i} className="grid grid-cols-4 items-center p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="font-medium">{r.staff_name}</span>
                  <span className="text-gray-600">{r.date}</span>
                  <span className={`text-center ${r.clock_in ? 'text-green-600' : 'text-gray-300'}`}>
                    {formatTime(r.clock_in)}
                  </span>
                  <span className={`text-center ${r.clock_out ? 'text-red-500' : 'text-gray-300'}`}>
                    {formatTime(r.clock_out)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
