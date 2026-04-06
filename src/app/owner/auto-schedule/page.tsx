'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface StaffSlot {
  id: number;
  name: string;
  start: string;
  end: string;
  requestId: number;
}

interface ScheduleSlot {
  date: string;
  staff: StaffSlot[];
}

interface StaffSummary {
  name: string;
  days: number;
  totalDays: number;
}

interface ScheduleResult {
  schedule: ScheduleSlot[];
  staffSummary: StaffSummary[];
  totalDays: number;
  pendingCount: number;
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function AutoSchedulePage() {
  const { session } = useSession('owner');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [minStaff, setMinStaff] = useState(1);
  const [maxStaff, setMaxStaff] = useState(5);
  const [targetDates, setTargetDates] = useState<Set<string>>(new Set()); // 対象日
  const [dateMode, setDateMode] = useState<'all' | 'pick'>('all');
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const generateDays = () => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(`${selectedMonth}-${String(d).padStart(2, '0')}`);
    return days;
  };

  const toggleTargetDate = (d: string) => {
    setTargetDates(prev => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  };

  const handlePreview = async () => {
    setLoading(true);
    setMessage('');
    setExcludedIds(new Set());
    try {
      let url = `/api/auto-schedule?month=${selectedMonth}&max_staff=${maxStaff}`;
      if (dateMode === 'pick' && targetDates.size > 0) {
        url += `&dates=${[...targetDates].sort().join(',')}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setResult(data);
    } catch {
      setMessage('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleStaff = (requestId: number) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!result) return;
    setConfirming(true);
    setMessage('');

    // 除外されていないリクエストIDを集める
    const requestIds: number[] = [];
    for (const slot of result.schedule) {
      for (const s of slot.staff) {
        if (!excludedIds.has(s.requestId)) {
          requestIds.push(s.requestId);
        }
      }
    }

    if (requestIds.length === 0) {
      setMessage('確定するシフトがありません');
      setConfirming(false);
      return;
    }

    try {
      const res = await fetch('/api/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = `${data.created}件のシフトを確定しました！${data.skipped > 0 ? `（${data.skipped}件は重複のためスキップ）` : ''}`;
        setMessage(msg);
        setResult(null);
      }
    } catch {
      setMessage('エラーが発生しました');
    } finally {
      setConfirming(false);
    }
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return DAY_LABELS[d.getDay()];
  };

  const getDayColor = (dateStr: string) => {
    const d = new Date(dateStr).getDay();
    if (d === 0) return 'text-red-500';
    if (d === 6) return 'text-blue-500';
    return '';
  };

  // 有効なリクエスト数
  const activeCount = result
    ? result.schedule.reduce((sum, slot) => sum + slot.staff.filter(s => !excludedIds.has(s.requestId)).length, 0)
    : 0;

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">自動シフト調整</h2>
          <button
            onClick={() => router.push('/owner/shifts')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← シフト管理に戻る
          </button>
        </div>

        {/* 設定 */}
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">対象月</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* 対象日モード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">対象日</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => { setDateMode('all'); setTargetDates(new Set()); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${dateMode === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                月全体
              </button>
              <button onClick={() => setDateMode('pick')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${dateMode === 'pick' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                日を選ぶ {dateMode === 'pick' && targetDates.size > 0 && `(${targetDates.size}日)`}
              </button>
            </div>
            {dateMode === 'pick' && (
              <div className="border rounded-lg p-3">
                <div className="grid grid-cols-7 gap-1">
                  {DAY_LABELS.map((d, i) => (
                    <div key={d} className={`text-center text-xs py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
                  ))}
                  {(() => { const days = generateDays(); if (!days.length) return null; const blanks = new Date(days[0]).getDay(); return Array.from({length: blanks}, (_, i) => <div key={`b${i}`}/>); })()}
                  {generateDays().map(d => {
                    const dayNum = parseInt(d.split('-')[2]);
                    const isSelected = targetDates.has(d);
                    const dow = new Date(d).getDay();
                    return (
                      <button key={d} onClick={() => toggleTargetDate(d)}
                        className={`py-2 rounded text-sm font-medium transition-all ${
                          isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-700'
                        } ${dow === 0 ? 'text-red-500' : ''} ${dow === 6 ? 'text-blue-500' : ''}`}>
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最低人数/日: <span className="text-orange-600">{minStaff}人</span>
              </label>
              <input
                type="range" min={1} max={10} value={minStaff}
                onChange={e => setMinStaff(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最大人数/日: <span className="text-orange-600">{maxStaff}人</span>
              </label>
              <input
                type="range" min={1} max={10} value={maxStaff}
                onChange={e => setMaxStaff(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>
          </div>

          <button
            onClick={handlePreview}
            disabled={loading}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? '計算中...' : '🤖 自動調整を実行'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${
            message.includes('エラー') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
          }`}>
            <p>{message}</p>
            {!message.includes('エラー') && !result && (
              <button onClick={() => router.push('/owner/shifts')}
                className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
                📅 シフト管理を見る
              </button>
            )}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="space-y-4">
            {/* サマリー */}
            <div className="bg-blue-500 text-white rounded-xl p-5 text-center">
              <p className="text-sm opacity-80">自動調整結果</p>
              <p className="text-3xl font-bold mt-1">{result.totalDays}日分</p>
              <p className="text-sm opacity-80 mt-1">
                未承認{result.pendingCount}件から{activeCount}件を選定
              </p>
            </div>

            {/* スタッフ別サマリー */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold mb-3">スタッフ配分</h3>
              <div className="grid grid-cols-2 gap-2">
                {result.staffSummary.map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <span className="font-medium text-sm">{s.name}</span>
                    <div className="text-right">
                      <span className="font-bold text-orange-600">{s.days}日</span>
                      <span className="text-xs text-gray-400 ml-1">（累計{s.totalDays}日）</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 日別シフト表 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-semibold mb-3">シフト表プレビュー</h3>
              <p className="text-xs text-gray-400 mb-3">スタッフをタップで除外/復活できます</p>
              <div className="space-y-2">
                {result.schedule.map(slot => (
                  <div key={slot.date} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-bold ${getDayColor(slot.date)}`}>
                        {slot.date}
                      </span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getDayColor(slot.date)} bg-gray-100`}>
                        {getDayLabel(slot.date)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {slot.staff.filter(s => !excludedIds.has(s.requestId)).length}人
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {slot.staff.map(s => {
                        const isExcluded = excludedIds.has(s.requestId);
                        return (
                          <button
                            key={s.requestId}
                            onClick={() => toggleStaff(s.requestId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isExcluded
                                ? 'bg-gray-100 text-gray-400 line-through'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            }`}
                          >
                            {s.name}
                            <span className="ml-1 opacity-60">{s.start}-{s.end}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 確定ボタン */}
            <button
              onClick={handleConfirm}
              disabled={confirming || activeCount === 0}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-colors shadow-md"
            >
              {confirming ? '確定中...' : `✅ ${activeCount}件のシフトを確定する`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
