'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface ShiftRequest {
  id: number;
  staff_id: number;
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  note: string;
}

interface Shift {
  id: number;
  staff_id: number;
  staff_name: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  actual_start: string | null;
  actual_end: string | null;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const STAFF_COLORS = [
  'bg-orange-200 text-orange-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-teal-200 text-teal-800',
  'bg-yellow-200 text-yellow-800',
  'bg-red-200 text-red-800',
];

export default function OwnerShiftsPage() {
  const { session } = useSession('owner');
  const [tab, setTab] = useState<'requests' | 'confirmed'>('confirmed');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const fetchData = useCallback(() => {
    if (!selectedMonth) return;
    fetch(`/api/shift-requests?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRequests(data); }).catch(() => {});
    fetch(`/api/shifts?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setShifts(data); }).catch(() => {});
  }, [selectedMonth]);

  useEffect(() => { if (session) fetchData(); }, [session, fetchData]);

  const handleApprove = async (id: number) => {
    await fetch('/api/shift-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'approved' }),
    });
    fetchData();
  };

  const handleReject = async (id: number) => {
    await fetch('/api/shift-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'rejected' }),
    });
    fetchData();
  };

  const handleBulkApprove = async () => {
    const pendingIds = requests.filter(r => r.status === 'pending').map(r => r.id);
    if (pendingIds.length === 0) return;
    if (!confirm(`${pendingIds.length}件の希望を一括承認しますか？`)) return;
    await fetch('/api/shift-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pendingIds, status: 'approved' }),
    });
    fetchData();
  };

  const handleBulkReject = async () => {
    const pendingIds = requests.filter(r => r.status === 'pending').map(r => r.id);
    if (pendingIds.length === 0) return;
    if (!confirm(`${pendingIds.length}件の希望を一括却下しますか？`)) return;
    await fetch('/api/shift-requests', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pendingIds, status: 'rejected' }),
    });
    fetchData();
  };

  const handleSaveShift = async () => {
    if (!editingShift) return;
    await fetch('/api/shifts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingShift),
    });
    setEditingShift(null);
    fetchData();
  };

  const handleDeleteShift = async (id: number) => {
    if (!confirm('このシフトを削除しますか？')) return;
    await fetch(`/api/shifts?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  // カレンダー用データ
  const generateCalendar = () => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDay = new Date(y, m - 1, 1).getDay();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${selectedMonth}-${String(d).padStart(2, '0')}`);
    }
    return days;
  };

  const shiftsByDate: Record<string, Shift[]> = {};
  for (const s of shifts) {
    if (!shiftsByDate[s.date]) shiftsByDate[s.date] = [];
    shiftsByDate[s.date].push(s);
  }

  // スタッフ名→色マッピング
  const staffNames = [...new Set(shifts.map(s => s.staff_name))];
  const staffColorMap: Record<string, string> = {};
  staffNames.forEach((name, i) => { staffColorMap[name] = STAFF_COLORS[i % STAFF_COLORS.length]; });

  const calendarDays = generateCalendar();
  const today = new Date().toISOString().split('T')[0];
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  // 選択日のシフト
  const selectedDayShifts = selectedDate ? (shiftsByDate[selectedDate] || []) : [];

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">シフト管理</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setSelectedDate(null); }}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* タブ */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('confirmed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'confirmed' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            カレンダー ({shifts.length})
          </button>
          <button
            onClick={() => setTab('requests')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'requests' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            シフト希望 {pendingRequests.length > 0 && (
              <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-xs">{pendingRequests.length}</span>
            )}
          </button>
        </div>

        {tab === 'confirmed' ? (
          <div className="space-y-4">
            {/* カレンダー / リスト切替 */}
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded text-xs font-medium ${viewMode === 'calendar' ? 'bg-gray-200 text-gray-800' : 'text-gray-400'}`}
              >
                📅 カレンダー
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-xs font-medium ${viewMode === 'list' ? 'bg-gray-200 text-gray-800' : 'text-gray-400'}`}
              >
                📋 リスト
              </button>
            </div>

            {viewMode === 'calendar' ? (
              <>
                {/* カレンダービュー */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  {/* スタッフ凡例 */}
                  {staffNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {staffNames.map(name => (
                        <span key={name} className={`px-2 py-0.5 rounded text-[10px] font-medium ${staffColorMap[name]}`}>
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 曜日ヘッダー */}
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAY_LABELS.map((d, i) => (
                      <div key={d} className={`text-center text-xs font-medium py-1 ${
                        i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                      }`}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* 日付グリッド */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dateStr, i) => {
                      if (!dateStr) return <div key={`blank-${i}`} />;

                      const dayNum = parseInt(dateStr.split('-')[2]);
                      const dayOfWeek = new Date(dateStr).getDay();
                      const dayShifts = shiftsByDate[dateStr] || [];
                      const isToday = dateStr === today;
                      const isSelected = dateStr === selectedDate;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          className={`min-h-[72px] rounded-lg p-1 text-left transition-all border ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300'
                              : isToday
                              ? 'border-orange-300 bg-orange-50'
                              : dayShifts.length > 0
                              ? 'border-gray-200 bg-white hover:border-orange-300'
                              : 'border-gray-100 bg-gray-50 hover:bg-white'
                          }`}
                        >
                          <span className={`text-xs font-bold block mb-0.5 ${
                            isToday ? 'text-orange-600'
                            : dayOfWeek === 0 ? 'text-red-500'
                            : dayOfWeek === 6 ? 'text-blue-500'
                            : 'text-gray-700'
                          }`}>
                            {dayNum}
                          </span>
                          {dayShifts.length > 0 && (
                            <div className="space-y-0.5">
                              {dayShifts.slice(0, 3).map(s => (
                                <div
                                  key={s.id}
                                  className={`text-[8px] leading-tight px-1 py-0.5 rounded truncate ${staffColorMap[s.staff_name] || 'bg-gray-200 text-gray-700'}`}
                                >
                                  {s.staff_name.slice(0, 3)}
                                </div>
                              ))}
                              {dayShifts.length > 3 && (
                                <div className="text-[8px] text-gray-400 px-1">+{dayShifts.length - 3}</div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 選択日の詳細 */}
                {selectedDate && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="font-semibold mb-3">
                      {selectedDate}
                      <span className={`ml-2 text-sm ${
                        new Date(selectedDate).getDay() === 0 ? 'text-red-500'
                        : new Date(selectedDate).getDay() === 6 ? 'text-blue-500'
                        : 'text-gray-500'
                      }`}>
                        ({DAY_LABELS[new Date(selectedDate).getDay()]})
                      </span>
                      <span className="text-sm text-gray-400 ml-2">{selectedDayShifts.length}人</span>
                    </h3>
                    {selectedDayShifts.length === 0 ? (
                      <p className="text-gray-400 text-sm">この日のシフトはありません</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedDayShifts.map(s => (
                          <div key={s.id} className="p-3 bg-gray-50 rounded-lg">
                            {editingShift?.id === s.id ? (
                              <div className="space-y-2">
                                <span className="font-medium text-sm">{s.staff_name}</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-xs text-gray-500">実出勤</label>
                                    <input type="time" value={editingShift.actual_start || editingShift.start_time}
                                      onChange={e => setEditingShift({ ...editingShift, actual_start: e.target.value })}
                                      className="w-full px-2 py-1.5 border rounded text-sm" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">実退勤</label>
                                    <input type="time" value={editingShift.actual_end || editingShift.end_time}
                                      onChange={e => setEditingShift({ ...editingShift, actual_end: e.target.value })}
                                      className="w-full px-2 py-1.5 border rounded text-sm" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500">休憩（分）</label>
                                  <input type="number" value={editingShift.break_minutes}
                                    onChange={e => setEditingShift({ ...editingShift, break_minutes: parseInt(e.target.value) || 0 })}
                                    className="w-24 px-2 py-1.5 border rounded text-sm" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleSaveShift} className="px-4 py-1.5 bg-green-500 text-white rounded text-sm">保存</button>
                                  <button onClick={() => setEditingShift(null)} className="px-4 py-1.5 bg-gray-200 rounded text-sm">キャンセル</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${staffColorMap[s.staff_name] || 'bg-gray-200'}`}>
                                    {s.staff_name}
                                  </span>
                                  <span className="text-gray-600 text-sm">
                                    {s.actual_start || s.start_time} - {s.actual_end || s.end_time}
                                  </span>
                                  {s.break_minutes > 0 && (
                                    <span className="text-gray-400 text-xs">(休{s.break_minutes}分)</span>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => setEditingShift(s)}
                                    className="px-2 py-1 text-blue-500 hover:bg-blue-50 rounded text-sm">編集</button>
                                  <button onClick={() => handleDeleteShift(s.id)}
                                    className="px-2 py-1 text-red-400 hover:bg-red-50 rounded text-sm">削除</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* リストビュー */
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold mb-3">確定シフト一覧</h3>
                {shifts.length === 0 ? (
                  <p className="text-gray-400 text-sm">確定シフトはありません</p>
                ) : (
                  <div className="space-y-2">
                    {shifts.map(s => (
                      <div key={s.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${staffColorMap[s.staff_name] || 'bg-gray-200'}`}>
                              {s.staff_name}
                            </span>
                            <span className="text-gray-600 text-sm">{s.date}</span>
                            <span className="text-gray-400 text-sm">
                              {s.actual_start || s.start_time}-{s.actual_end || s.end_time}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setEditingShift(s)}
                              className="px-2 py-1 text-blue-500 hover:bg-blue-50 rounded text-sm">編集</button>
                            <button onClick={() => handleDeleteShift(s.id)}
                              className="px-2 py-1 text-red-400 hover:bg-red-50 rounded text-sm">削除</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* シフト希望タブ */
          <div className="space-y-4">
            {pendingRequests.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-orange-600">未承認のシフト希望</h3>
                  <div className="flex gap-2">
                    <button onClick={handleBulkApprove}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                      全て承認
                    </button>
                    <button onClick={handleBulkReject}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">
                      全て却下
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingRequests.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium text-sm">{r.staff_name}</span>
                        <span className="text-gray-500 ml-2 text-sm">{r.date}</span>
                        <span className="text-gray-400 ml-2 text-sm">{r.start_time}-{r.end_time}</span>
                        {r.note && <span className="text-gray-400 ml-1 text-xs">({r.note})</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(r.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">承認</button>
                        <button onClick={() => handleReject(r.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">却下</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold mb-3">処理済み</h3>
              {processedRequests.length === 0 ? (
                <p className="text-gray-400 text-sm">処理済みのシフト希望はありません</p>
              ) : (
                <div className="space-y-2">
                  {processedRequests.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium text-sm">{r.staff_name}</span>
                        <span className="text-gray-500 ml-2 text-sm">{r.date}</span>
                        <span className="text-gray-400 ml-2 text-sm">{r.start_time}-{r.end_time}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status === 'approved' ? '承認済' : '却下'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
