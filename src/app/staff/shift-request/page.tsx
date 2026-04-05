'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

interface TimePreset {
  id: string;
  label: string;
  start: string;
  end: string;
  icon: string;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function ShiftRequestPage() {
  const { session } = useSession();
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [presets, setPresets] = useState<TimePreset[]>([]);

  // 複数日選択
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('23:00');
  const [note, setNote] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    // プリセット取得
    fetch('/api/presets').then(r => r.json()).then(setPresets).catch(() => {});
  }, []);

  const fetchRequests = useCallback(() => {
    if (!selectedMonth) return;
    fetch(`/api/shift-requests?month=${selectedMonth}`)
      .then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); })
      .then(data => { if (data) setRequests(data); })
      .catch(() => {});
  }, [selectedMonth, router]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // 日付トグル
  const toggleDate = (d: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  // 一括提出
  const handleSubmit = async () => {
    if (selectedDates.size === 0) {
      setError('日付を選択してください');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');

    const dates = [...selectedDates].sort();
    let submitted = 0;
    let skipped = 0;
    for (const d of dates) {
      const res = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: d, start_time: startTime, end_time: endTime, note }),
      });
      if (res.ok) submitted++; else skipped++;
    }

    setSuccess(`${submitted}件提出しました${skipped > 0 ? `（${skipped}件スキップ）` : ''}`);
    setSelectedDates(new Set());
    setNote('');
    setSubmitting(false);
    fetchRequests();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('この希望を削除しますか？')) return;
    await fetch(`/api/shift-requests?id=${id}`, { method: 'DELETE' });
    fetchRequests();
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': return { text: '未承認', color: 'bg-yellow-100 text-yellow-700' };
      case 'approved': return { text: '承認済', color: 'bg-green-100 text-green-700' };
      case 'rejected': return { text: '却下', color: 'bg-red-100 text-red-700' };
      default: return { text: s, color: 'bg-gray-100' };
    }
  };

  const generateDays = () => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${selectedMonth}-${String(d).padStart(2, '0')}`);
    }
    return days;
  };

  // 曜日一括選択
  const selectByDayOfWeek = (dow: number[]) => {
    const today = new Date().toISOString().split('T')[0];
    const requestedDates = new Set(requests.map(r => r.date));
    const days = generateDays();
    const newSet = new Set(selectedDates);
    for (const d of days) {
      if (d <= today || requestedDates.has(d)) continue;
      if (dow.includes(new Date(d).getDay())) newSet.add(d);
    }
    setSelectedDates(newSet);
  };

  const days = generateDays();
  const requestedDates = new Set(requests.map(r => r.date));
  const today = new Date().toISOString().split('T')[0];

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <h2 className="text-xl font-bold">シフト希望提出</h2>

        {/* 月選択 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm text-gray-600 mb-1">月を選択</label>
          <input type="month" value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setSelectedDates(new Set()); }}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500" />
        </div>

        {/* カレンダー（複数選択） */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              日付をタップで選択 <span className="text-orange-600">({selectedDates.size}日)</span>
            </label>
            <button onClick={() => setSelectedDates(new Set())}
              className="text-xs text-gray-400 hover:text-red-500">クリア</button>
          </div>

          {/* 曜日ショートカット */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            <button onClick={() => selectByDayOfWeek([1,2,3,4,5])}
              className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600 hover:bg-gray-200 whitespace-nowrap">平日全部</button>
            <button onClick={() => selectByDayOfWeek([0,6])}
              className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600 hover:bg-gray-200 whitespace-nowrap">土日</button>
            <button onClick={() => selectByDayOfWeek([5,6])}
              className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600 hover:bg-gray-200 whitespace-nowrap">金土</button>
            <button onClick={() => selectByDayOfWeek([0,1,2,3,4,5,6])}
              className="px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-600 hover:bg-gray-200 whitespace-nowrap">全日</button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className={`text-center text-xs py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
            {days.length > 0 && Array.from({ length: new Date(days[0]).getDay() }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map(d => {
              const dayNum = parseInt(d.split('-')[2]);
              const isRequested = requestedDates.has(d);
              const isSelected = selectedDates.has(d);
              const isPast = d <= today;
              const dow = new Date(d).getDay();
              return (
                <button key={d}
                  onClick={() => !isPast && !isRequested && toggleDate(d)}
                  disabled={isPast || isRequested}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                    : isRequested ? 'bg-green-100 text-green-600'
                    : isPast ? 'text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                  } ${!isPast && !isRequested && dow === 0 ? 'text-red-500' : ''} ${!isPast && !isRequested && dow === 6 ? 'text-blue-500' : ''}`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" /> 選択中</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded" /> 提出済み</span>
          </div>
        </div>

        {/* 時間帯プリセット */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">時間帯</label>
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {presets.map(p => (
              <button key={p.id}
                onClick={() => { setStartTime(p.start); setEndTime(p.end); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  startTime === p.start && endTime === p.end
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.icon} {p.label}
                <span className="block text-[10px] opacity-70">{p.start}-{p.end}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500" />
            </div>
          </div>
        </div>

        {/* メモ */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <label className="block text-sm text-gray-600 mb-1">メモ（任意）</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="早退希望、遅刻など"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500" />
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
        {success && <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">{success}</p>}

        {/* 提出ボタン */}
        <button onClick={handleSubmit}
          disabled={submitting || selectedDates.size === 0}
          className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-md">
          {submitting ? '送信中...' : selectedDates.size > 0
            ? `${selectedDates.size}日分のシフト希望を提出`
            : 'カレンダーから日付を選んでください'}
        </button>

        {/* 提出済み一覧 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-3">提出済み ({requests.length}件)</h3>
          {requests.length === 0 ? (
            <p className="text-gray-400 text-sm">まだ希望がありません</p>
          ) : (
            <div className="space-y-2">
              {requests.map(r => {
                const st = statusLabel(r.status);
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{r.date}</span>
                      <span className="text-gray-500 ml-2 text-sm">{r.start_time} - {r.end_time}</span>
                      {r.note && <span className="text-gray-400 ml-2 text-xs">{r.note}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.text}</span>
                      {r.status === 'pending' && (
                        <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 text-xs">取消</button>
                      )}
                    </div>
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
