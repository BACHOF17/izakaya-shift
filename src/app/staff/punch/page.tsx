'use client';

import { useState, useEffect } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

export default function PunchPage() {
  const { session, loading } = useSession();
  const [isWorking, setIsWorking] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [lastAction, setLastAction] = useState<{ type: string; time: string } | null>(null);
  const [todayShift, setTodayShift] = useState<{ start_time: string; end_time: string } | null>(null);
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/punch')
      .then(r => r.json())
      .then(data => {
        setIsWorking(data.isWorking);
        setTodayShift(data.todayShift);
      })
      .catch(() => {});
  }, [session]);

  const handlePunch = async (type: 'in' | 'out') => {
    setPunching(true);
    setMessage('');
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsWorking(type === 'in');
        setLastAction({ type, time: data.time });
        setMessage(type === 'in' ? '出勤しました！' : '退勤しました！お疲れ様でした！');
      }
    } catch {
      setMessage('エラーが発生しました');
    } finally {
      setPunching(false);
    }
  };

  if (loading || !session) return <div className="flex items-center justify-center min-h-screen text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 flex flex-col items-center">
        <h2 className="text-xl font-bold mb-6">タイムカード</h2>

        {/* 時計 */}
        <div className="text-6xl font-bold text-gray-800 mb-2 tabular-nums">
          {currentTime}
        </div>
        <p className="text-gray-400 text-sm mb-8">
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>

        {/* 今日のシフト */}
        {todayShift && (
          <div className="bg-orange-50 rounded-xl p-4 mb-6 w-full max-w-sm text-center">
            <p className="text-sm text-gray-500">今日のシフト</p>
            <p className="text-xl font-bold text-orange-600">
              {todayShift.start_time} - {todayShift.end_time}
            </p>
          </div>
        )}

        {/* 打刻ボタン */}
        <div className="flex gap-6 mb-6">
          <button
            onClick={() => handlePunch('in')}
            disabled={punching || isWorking}
            className={`w-36 h-36 rounded-full text-xl font-bold shadow-lg transition-all active:scale-95 ${
              isWorking
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-xl'
            }`}
          >
            出勤
          </button>
          <button
            onClick={() => handlePunch('out')}
            disabled={punching || !isWorking}
            className={`w-36 h-36 rounded-full text-xl font-bold shadow-lg transition-all active:scale-95 ${
              !isWorking
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600 hover:shadow-xl'
            }`}
          >
            退勤
          </button>
        </div>

        {/* ステータス */}
        <div className={`px-4 py-2 rounded-full text-sm font-medium mb-4 ${
          isWorking ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {isWorking ? '勤務中' : '退勤済み'}
        </div>

        {message && (
          <p className={`text-sm font-medium ${message.includes('エラー') ? 'text-red-500' : 'text-green-600'}`}>
            {message}
          </p>
        )}

        {lastAction && (
          <p className="text-gray-400 text-xs mt-2">
            最終打刻: {lastAction.type === 'in' ? '出勤' : '退勤'} {lastAction.time}
          </p>
        )}
      </div>
    </div>
  );
}
