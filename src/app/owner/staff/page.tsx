'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface Staff {
  id: number;
  name: string;
  pin: string;
  hourly_rate: number;
  transport_fee: number;
  role: string;
  active: number;
}

export default function OwnerStaffPage() {
  const { session } = useSession('owner');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: '', pin: '', hourly_rate: 1000, transport_fee: 0 });
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchStaff = useCallback(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStaffList(data); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (session) fetchStaff(); }, [session, fetchStaff]);

  const handleAdd = async () => {
    setError('');
    if (!form.name || !form.pin) {
      setError('名前とPINは必須です');
      return;
    }
    if (form.pin.length < 4) {
      setError('PINは4桁で入力してください');
      return;
    }
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    setForm({ name: '', pin: '', hourly_rate: 1000, transport_fee: 0 });
    setShowForm(false);
    fetchStaff();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    fetchStaff();
  };

  const handleToggleActive = async (staff: Staff) => {
    await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...staff, active: staff.active ? 0 : 1 }),
    });
    fetchStaff();
  };

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">スタッフ管理</h2>
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null); }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
          >
            {showForm ? '閉じる' : '+ スタッフ追加'}
          </button>
        </div>

        {/* 追加フォーム */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold mb-4">新しいスタッフ</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">名前</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">PIN（4桁）</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.pin}
                    onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">時給（円）</label>
                  <input
                    type="number"
                    value={form.hourly_rate}
                    onChange={e => setForm({ ...form, hourly_rate: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">交通費（円/回）</label>
                  <input
                    type="number"
                    value={form.transport_fee}
                    onChange={e => setForm({ ...form, transport_fee: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleAdd}
                className="w-full py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
              >
                追加する
              </button>
            </div>
          </div>
        )}

        {/* スタッフ一覧 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">スタッフ一覧</h3>
          <div className="space-y-2">
            {staffList.filter(s => s.role === 'staff').map(s => (
              <div key={s.id} className={`p-4 rounded-lg ${s.active ? 'bg-gray-50' : 'bg-red-50 opacity-60'}`}>
                {editing?.id === s.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="名前"
                      />
                      <input
                        type="text"
                        value={editing.pin}
                        onChange={e => setEditing({ ...editing, pin: e.target.value.replace(/\D/g, '') })}
                        className="px-2 py-1 border rounded text-sm"
                        placeholder="PIN"
                        maxLength={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">時給</label>
                        <input
                          type="number"
                          value={editing.hourly_rate}
                          onChange={e => setEditing({ ...editing, hourly_rate: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">交通費/回</label>
                        <input
                          type="number"
                          value={editing.transport_fee}
                          onChange={e => setEditing({ ...editing, transport_fee: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUpdate} className="px-3 py-1 bg-green-500 text-white rounded text-sm">保存</button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1 bg-gray-300 rounded text-sm">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-400 ml-2 text-sm">PIN: {s.pin}</span>
                      <span className="text-gray-500 ml-3 text-sm">{s.hourly_rate.toLocaleString()}円/h</span>
                      {s.transport_fee > 0 && (
                        <span className="text-gray-400 ml-2 text-sm">交通費: {s.transport_fee.toLocaleString()}円</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(s)}
                        className="px-2 py-1 text-blue-500 hover:bg-blue-50 rounded text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`px-2 py-1 rounded text-sm ${
                          s.active ? 'text-red-400 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'
                        }`}
                      >
                        {s.active ? '無効化' : '有効化'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* オーナーアカウント */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold mb-3">オーナーアカウント</h3>
          {staffList.filter(s => s.role === 'owner').map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <span className="font-medium">{s.name}</span>
                <span className="text-gray-400 ml-2 text-sm">PIN: {s.pin}</span>
              </div>
              <button
                onClick={() => setEditing(s)}
                className="px-2 py-1 text-blue-500 hover:bg-blue-50 rounded text-sm"
              >
                編集
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
