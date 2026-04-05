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

const TIME_PRESETS = [
  { label: 'ディナー', start: '17:00', end: '23:00', icon: '🌙' },
  { label: 'ラスト', start: '17:00', end: '01:00', icon: '🌃' },
  { label: 'ランチ', start: '11:00', end: '15:00', icon: '☀️' },
  { label: '通し', start: '11:00', end: '23:00', icon: '💪' },
  { label: 'カスタム', start: '', end: '', icon: '⚙️' },
];

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function ShiftRequestPage() {
  const { session } = useSession();
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  // 手動モード
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('23:00');
  const [note, setNote] = useState('');

  // 自動モード
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0=日, 1=月, ...
  const [maxPerWeek, setMaxPerWeek] = useState(5);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [autoStart, setAutoStart] = useState('17:00');
  const [autoEnd, setAutoEnd] = useState('23:00');
  const [excludeDates, setExcludeDates] = useState<Set<string>>(new Set());

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const fetchRequests = useCallback(() => {
    if (!selectedMonth) return;
    fetch(`/api/shift-requests?month=${selectedMonth}`)
      .then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); })
      .then(data => { if (data) setRequests(data); })
      .catch(() => {});
  }, [selectedMonth, router]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // プリセット選択
  useEffect(() => {
    const preset = TIME_PRESETS[selectedPreset];
    if (preset.start) {
      setAutoStart(preset.start);
      setAutoEnd(preset.end);
    }
  }, [selectedPreset]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    if (!date || !startTime || !endTime) {
      setError('日付と時間を入力してください');
      return;
    }
    const res = await fetch('/api/shift-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, start_time: startTime, end_time: endTime, note }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setSuccess('シフト希望を提出しました');
    setDate('');
    setNote('');
    fetchRequests();
  };

  // 自動希望の候補日を計算
  const getAutoDates = () => {
    if (!selectedMonth || selectedDays.length === 0) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const requestedDates = new Set(requests.map(r => r.date));
    const candidates: string[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      if (dateStr <= today) continue;
      if (requestedDates.has(dateStr)) continue;
      if (excludeDates.has(dateStr)) continue;
      const dayOfWeek = new Date(dateStr).getDay();
      if (selectedDays.includes(dayOfWeek)) {
        candidates.push(dateStr);
      }
    }

    // 週あたり上限を適用
    if (maxPerWeek < 7) {
      const filtered: string[] = [];
      const weekCounts: Record<string, number> = {};
      for (const d of candidates) {
        const dt = new Date(d);
        // 週番号を計算（月曜始まり）
        const jan1 = new Date(dt.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((dt.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const key = `${dt.getFullYear()}-W${weekNum}`;
        weekCounts[key] = (weekCounts[key] || 0) + 1;
        if (weekCounts[key] <= maxPerWeek) {
          filtered.push(d);
        }
      }
      return filtered;
    }
    return candidates;
  };

  const handleAutoSubmit = async () => {
    const dates = getAutoDates();
    if (dates.length === 0) {
      setError('提出する日がありません');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');

    let submitted = 0;
    let skipped = 0;
    for (const d of dates) {
      const res = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: d, start_time: autoStart, end_time: autoEnd, note: '自動希望' }),
      });
      if (res.ok) submitted++;
      else skipped++;
    }

    setSuccess(`${submitted}件のシフト希望を提出しました${skipped > 0 ? `（${skipped}件は既に提出済みでスキップ）` : ''}`);
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
    const days: string[] = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${selectedMonth}-${String(d).padStart(2, '0')}`);
    }
    return days;
  };

  const days = generateDays();
  const requestedDates = new Set(requests.map(r => r.date));
  const autoDates = mode === 'auto' ? new Set(getAutoDates()) : new Set<string>();

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleExcludeDate = (d: string) => {
    setExcludeDates(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <h2 className="text-xl font-bold">シフト希望提出</h2>

        {/* モード切替 */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              mode === 'manual'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📅 1日ずつ選ぶ
          </button>
          <button
            onClick={() => setMode('auto')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
              mode === 'auto'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⚡ まとめて自動入力
          </button>
        </div>

        {mode === 'auto' ? (
          /* ===== 自動モード ===== */
          <div className="space-y-4">
            {/* 月選択 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <label className="block text-sm text-gray-600 mb-2">月を選択</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* 曜日選択 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">出勤できる曜日</label>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      selectedDays.includes(i)
                        ? i === 0 ? 'bg-red-500 text-white' : i === 6 ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200"
                >
                  平日全部
                </button>
                <button
                  onClick={() => setSelectedDays([0, 6])}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200"
                >
                  土日のみ
                </button>
                <button
                  onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200"
                >
                  全曜日
                </button>
                <button
                  onClick={() => setSelectedDays([])}
                  className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600 hover:bg-gray-200"
                >
                  リセット
                </button>
              </div>
            </div>

            {/* 週上限 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                週の最大出勤日数: <span className="text-orange-600">{maxPerWeek}日</span>
              </label>
              <input
                type="range"
                min={1}
                max={7}
                value={maxPerWeek}
                onChange={e => setMaxPerWeek(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1日</span><span>7日</span>
              </div>
            </div>

            {/* 時間帯プリセット */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-3">時間帯</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {TIME_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPreset(i)}
                    className={`p-3 rounded-xl text-center transition-all ${
                      selectedPreset === i
                        ? 'bg-orange-500 text-white shadow-md'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <p className="text-xs font-medium mt-1">{preset.label}</p>
                    {preset.start && (
                      <p className="text-[10px] opacity-75">{preset.start}-{preset.end}</p>
                    )}
                  </button>
                ))}
              </div>

              {selectedPreset === TIME_PRESETS.length - 1 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">開始</label>
                    <input
                      type="time"
                      value={autoStart}
                      onChange={e => setAutoStart(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">終了</label>
                    <input
                      type="time"
                      value={autoEnd}
                      onChange={e => setAutoEnd(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* プレビュー カレンダー */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提出プレビュー
                <span className="text-orange-600 ml-2">{autoDates.size}日分</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">除外したい日はタップしてください</p>
              <div className="grid grid-cols-7 gap-1">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
                ))}
                {days.length > 0 && Array.from({ length: new Date(days[0]).getDay() }, (_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {days.map(d => {
                  const dayNum = parseInt(d.split('-')[2]);
                  const isRequested = requestedDates.has(d);
                  const isAutoCandidate = autoDates.has(d);
                  const isExcluded = excludeDates.has(d);
                  const isPast = d <= new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={d}
                      onClick={() => !isPast && !isRequested && toggleExcludeDate(d)}
                      disabled={isPast}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        isRequested
                          ? 'bg-green-100 text-green-700'
                          : isExcluded
                          ? 'bg-red-100 text-red-400 line-through'
                          : isAutoCandidate
                          ? 'bg-orange-500 text-white ring-2 ring-orange-300'
                          : isPast
                          ? 'text-gray-300'
                          : 'text-gray-400'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" /> 提出予定</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded" /> 提出済み</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded" /> 除外</span>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm">{success}</p>}

            <button
              onClick={handleAutoSubmit}
              disabled={submitting || autoDates.size === 0}
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-md"
            >
              {submitting ? '送信中...' : `${autoDates.size}日分のシフト希望をまとめて提出`}
            </button>
          </div>
        ) : (
          /* ===== 手動モード ===== */
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">月を選択</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">日付を選択</label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAY_LABELS.map(d => (
                      <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
                    ))}
                    {days.length > 0 && Array.from({ length: new Date(days[0]).getDay() }, (_, i) => (
                      <div key={`blank-${i}`} />
                    ))}
                    {days.map(d => {
                      const dayNum = parseInt(d.split('-')[2]);
                      const isRequested = requestedDates.has(d);
                      const isSelected = date === d;
                      const isPast = d < new Date().toISOString().split('T')[0];
                      return (
                        <button
                          key={d}
                          onClick={() => !isPast && setDate(d)}
                          disabled={isPast}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${
                            isSelected ? 'bg-orange-500 text-white'
                            : isRequested ? 'bg-green-100 text-green-700'
                            : isPast ? 'text-gray-300 cursor-not-allowed'
                            : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 時間帯プリセット（手動モード用） */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">時間帯</label>
                  <div className="flex gap-2 mb-2 overflow-x-auto">
                    {TIME_PRESETS.filter(p => p.start).map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => { setStartTime(preset.start); setEndTime(preset.end); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                          startTime === preset.start && endTime === preset.end
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {preset.icon} {preset.label}
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

                <div>
                  <label className="block text-sm text-gray-600 mb-1">メモ（任意）</label>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="早退希望、遅刻など"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500" />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}
                {success && <p className="text-green-600 text-sm">{success}</p>}

                <button onClick={handleSubmit} disabled={!date}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  シフト希望を提出
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 希望一覧 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">提出済みのシフト希望 ({requests.length}件)</h3>
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                        {st.text}
                      </span>
                      {r.status === 'pending' && (
                        <button onClick={() => handleDelete(r.id)}
                          className="text-red-400 hover:text-red-600 text-xs">取消</button>
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
