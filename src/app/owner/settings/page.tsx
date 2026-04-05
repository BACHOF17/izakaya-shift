'use client';

import { useState, useEffect } from 'react';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface TimePreset {
  id: string;
  label: string;
  start: string;
  end: string;
  icon: string;
}

const ICONS = ['🌙', '🌃', '☀️', '💪', '🍽', '🔪', '⏰', '🌅'];

export default function OwnerSettingsPage() {
  const { session } = useSession('owner');
  const [presets, setPresets] = useState<TimePreset[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/presets').then(r => r.json()).then(setPresets).catch(() => {});
  }, []);

  const updatePreset = (index: number, field: keyof TimePreset, value: string) => {
    setPresets(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addPreset = () => {
    setPresets(prev => [...prev, {
      id: `custom_${Date.now()}`,
      label: '新しい時間帯',
      start: '17:00',
      end: '23:00',
      icon: '⏰',
    }]);
  };

  const removePreset = (index: number) => {
    setPresets(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setMessage('');
    const res = await fetch('/api/presets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presets }),
    });
    if (res.ok) setMessage('保存しました');
    else setMessage('エラーが発生しました');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <h2 className="text-xl font-bold">店舗設定</h2>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">時間帯プリセット</h3>
            <button onClick={addPreset}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
              + 追加
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">スタッフがシフト希望を出す時に選べる時間帯を設定します</p>

          <div className="space-y-3">
            {presets.map((p, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {/* アイコン選択 */}
                  <div className="flex gap-1 flex-wrap">
                    {ICONS.map(icon => (
                      <button key={icon} onClick={() => updatePreset(i, 'icon', icon)}
                        className={`w-8 h-8 rounded text-lg ${p.icon === icon ? 'bg-orange-100 ring-2 ring-orange-500' : 'hover:bg-gray-100'}`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => removePreset(i)} className="ml-auto text-red-400 hover:text-red-600 text-sm">削除</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">名前</label>
                    <input type="text" value={p.label}
                      onChange={e => updatePreset(i, 'label', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">開始</label>
                    <input type="time" value={p.start}
                      onChange={e => updatePreset(i, 'start', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">終了</label>
                    <input type="time" value={p.end}
                      onChange={e => updatePreset(i, 'end', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-orange-500" />
                  </div>
                </div>
                {/* プレビュー */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-400">プレビュー:</span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">
                    {p.icon} {p.label} {p.start}-{p.end}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {message && (
            <p className={`mt-3 text-sm ${message.includes('エラー') ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
          )}

          <button onClick={handleSave}
            className="w-full mt-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors">
            設定を保存
          </button>
        </div>
      </div>
    </div>
  );
}
