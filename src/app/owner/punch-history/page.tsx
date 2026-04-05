'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface PunchRecord {
  staff_id: number;
  staff_name: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  confirmed: boolean;
  punch_in_id: number | null;
  punch_out_id: number | null;
}

export default function OwnerPunchHistoryPage() {
  const { session } = useSession('owner');
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const fetchRecords = useCallback(() => {
    if (!selectedMonth) return;
    const url = staffFilter !== 'all'
      ? `/api/punch-history?month=${selectedMonth}&staff_id=${staffFilter}`
      : `/api/punch-history?month=${selectedMonth}`;
    fetch(url)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecords(data); })
      .catch(() => {});
  }, [selectedMonth, staffFilter]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const formatTime = (dt: string | null) => {
    if (!dt) return '--:--';
    const parts = dt.split(' ');
    return parts[1] ? parts[1].slice(0, 5) : dt.slice(0, 5);
  };

  // 確認/確認取消
  const handleConfirm = async (record: PunchRecord, confirmed: boolean) => {
    const ids: number[] = [];
    if (record.punch_in_id) ids.push(record.punch_in_id);
    if (record.punch_out_id) ids.push(record.punch_out_id);
    if (ids.length === 0) return;

    setConfirming(true);
    await fetch('/api/punch-history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ punch_ids: ids, confirmed }),
    });
    setConfirming(false);
    fetchRecords();
  };

  // 未確認レコードを一括確認
  const handleConfirmAll = async () => {
    const unconfirmed = records.filter(r => !r.confirmed);
    if (unconfirmed.length === 0) return;

    const ids: number[] = [];
    for (const r of unconfirmed) {
      if (r.punch_in_id) ids.push(r.punch_in_id);
      if (r.punch_out_id) ids.push(r.punch_out_id);
    }
    if (ids.length === 0) return;

    setConfirming(true);
    await fetch('/api/punch-history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ punch_ids: ids, confirmed: true }),
    });
    setConfirming(false);
    fetchRecords();
  };

  // スタッフ名一覧
  const staffNames = [...new Set(records.map(r => JSON.stringify({ id: r.staff_id, name: r.staff_name })))]
    .map(s => JSON.parse(s) as { id: number; name: string });

  const unconfirmedCount = records.filter(r => !r.confirmed).length;
  const confirmedCount = records.filter(r => r.confirmed).length;

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

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-2xl font-bold text-orange-600">{records.length}</span>
            <span className="block text-xs text-gray-500 mt-1">合計</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-2xl font-bold text-green-600">{confirmedCount}</span>
            <span className="block text-xs text-gray-500 mt-1">確認済み</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <span className="text-2xl font-bold text-yellow-600">{unconfirmedCount}</span>
            <span className="block text-xs text-gray-500 mt-1">未確認</span>
          </div>
        </div>

        {/* 一括確認ボタン */}
        {unconfirmedCount > 0 && (
          <button onClick={handleConfirmAll}
            disabled={confirming}
            className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 transition-colors shadow-md">
            {confirming ? '処理中...' : `未確認 ${unconfirmedCount}件をまとめて確認`}
          </button>
        )}

        <div className="bg-white rounded-xl shadow-sm p-5">
          {records.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">この月の打刻記録はありません</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-5 text-xs text-gray-400 font-medium px-3">
                <span>スタッフ</span>
                <span>日付</span>
                <span className="text-center">出勤</span>
                <span className="text-center">退勤</span>
                <span className="text-center">確認</span>
              </div>
              {records.map((r, i) => (
                <div key={i} className={`grid grid-cols-5 items-center p-3 rounded-lg text-sm ${
                  r.confirmed ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
                }`}>
                  <span className="font-medium">{r.staff_name}</span>
                  <span className="text-gray-600">{r.date}</span>
                  <span className={`text-center ${r.clock_in ? 'text-green-600' : 'text-gray-300'}`}>
                    {formatTime(r.clock_in)}
                  </span>
                  <span className={`text-center ${r.clock_out ? 'text-red-500' : 'text-gray-300'}`}>
                    {formatTime(r.clock_out)}
                  </span>
                  <div className="text-center">
                    {r.confirmed ? (
                      <button
                        onClick={() => handleConfirm(r, false)}
                        disabled={confirming}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium hover:bg-green-200 disabled:opacity-50"
                        title="クリックで確認取消"
                      >
                        ✓ 確認済
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConfirm(r, true)}
                        disabled={confirming}
                        className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium hover:bg-yellow-200 disabled:opacity-50"
                      >
                        未確認
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
