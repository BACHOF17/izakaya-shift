'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface Swap {
  id: number;
  requester_id: number;
  requester_name: string;
  target_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  status: string;
}

interface MyShift {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
}

export default function SwapPage() {
  const { session, loading } = useSession();
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [myShifts, setMyShifts] = useState<MyShift[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const fetchSwaps = useCallback(() => {
    fetch('/api/shift-swap?status=open')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSwaps(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchSwaps();

    // 自分のシフト一覧を取得
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fetch(`/api/shifts?month=${month}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const today = now.toISOString().split('T')[0];
          setMyShifts(data.filter((s: MyShift) => s.date >= today));
        }
      })
      .catch(() => {});
  }, [session, fetchSwaps]);

  const handleRequest = async () => {
    if (!selectedShift) return;
    setMessage('');
    const res = await fetch('/api/shift-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: selectedShift, reason }),
    });
    if (res.ok) {
      setMessage('交換リクエストを送信しました');
      setShowForm(false);
      setReason('');
      setSelectedShift(null);
      fetchSwaps();
    }
  };

  const handleVolunteer = async (swapId: number) => {
    await fetch('/api/shift-swap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: swapId, action: 'volunteer' }),
    });
    fetchSwaps();
  };

  if (loading || !session) return <div className="flex items-center justify-center min-h-screen text-gray-400">読み込み中...</div>;

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">シフト交換</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            {showForm ? '閉じる' : '交換を依頼'}
          </button>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-4">シフト交換リクエスト</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">交換したいシフト</label>
                {myShifts.length === 0 ? (
                  <p className="text-gray-400 text-sm">今後の確定シフトがありません</p>
                ) : (
                  <div className="space-y-2">
                    {myShifts.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedShift(s.id)}
                        className={`w-full p-3 rounded-lg border-2 text-left text-sm transition-all ${
                          selectedShift === s.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium">{s.date}</span>
                        <span className="text-gray-500 ml-2">{s.start_time} - {s.end_time}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">理由（任意）</label>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="急用、体調不良など"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                />
              </div>
              <button
                onClick={handleRequest}
                disabled={!selectedShift}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                交換リクエストを送信
              </button>
            </div>
          </div>
        )}

        {/* 募集中の交換 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">募集中のシフト交換</h3>
          {swaps.length === 0 ? (
            <p className="text-gray-400 text-sm">現在募集中の交換リクエストはありません</p>
          ) : (
            <div className="space-y-3">
              {swaps.map(s => (
                <div key={s.id} className="p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm">{s.requester_name}</span>
                      <span className="text-gray-500 ml-2 text-sm">{s.date}</span>
                      <span className="text-gray-400 ml-1 text-sm">{s.start_time}-{s.end_time}</span>
                    </div>
                    {s.requester_id !== session.id && !s.target_name && (
                      <button
                        onClick={() => handleVolunteer(s.id)}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                      >
                        代わります
                      </button>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-gray-500 text-xs">理由: {s.reason}</p>
                  )}
                  {s.target_name && (
                    <p className="text-green-600 text-xs mt-1">{s.target_name}さんが引き受けました（オーナー承認待ち）</p>
                  )}
                  {s.requester_id === session.id && (
                    <span className="text-xs text-orange-500">自分のリクエスト</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
