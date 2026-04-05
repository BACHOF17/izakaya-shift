'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StaffOption {
  id: number;
  name: string;
  role: string;
}

export default function LoginPage() {
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.json())
      .then(setStaffList)
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!selectedId || !pin) {
      setError('スタッフを選択してPINを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedId, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push(data.role === 'owner' ? '/owner' : '/staff');
    } catch {
      setError('通信エラー');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">シフト管理</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">居酒屋スタッフ用</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              名前を選択
            </label>
            <div className="grid grid-cols-2 gap-2">
              {staffList.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedId(s.id); setError(''); }}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedId === s.id
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {s.name}
                  {s.role === 'owner' && (
                    <span className="block text-xs text-orange-500 mt-0.5">オーナー</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PINコード（4桁）
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-orange-500"
              placeholder="****"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !selectedId || pin.length < 4}
            className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium text-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  );
}
