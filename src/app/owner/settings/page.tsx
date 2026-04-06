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

interface SalarySettings {
  lateNightStart: string;
  lateNightEnd: string;
  lateNightRate: number;
  overtimeThreshold: number;
  overtimeRate: number;
}

export default function OwnerSettingsPage() {
  const { session } = useSession('owner');
  const [presets, setPresets] = useState<TimePreset[]>([]);
  const [salary, setSalary] = useState<SalarySettings>({
    lateNightStart: '22:00', lateNightEnd: '05:00', lateNightRate: 1.25,
    overtimeThreshold: 480, overtimeRate: 1.25,
  });
  const [message, setMessage] = useState('');
  const [salaryMsg, setSalaryMsg] = useState('');

  useEffect(() => {
    fetch('/api/presets').then(r => r.json()).then(setPresets).catch(() => {});
    fetch('/api/salary-settings').then(r => r.json()).then(setSalary).catch(() => {});
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

  const handleSaveSalary = async () => {
    setSalaryMsg('');
    const res = await fetch('/api/salary-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salary),
    });
    if (res.ok) setSalaryMsg('保存しました');
    else setSalaryMsg('エラーが発生しました');
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

        {/* 給料設定 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-2">💰 給料計算設定</h3>
          <p className="text-xs text-gray-400 mb-4">深夜手当・残業手当の割合や時間帯を設定します</p>

          <div className="space-y-4">
            {/* 深夜手当 */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-700 mb-3">🌙 深夜手当</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500">開始時間</label>
                  <input type="time" value={salary.lateNightStart}
                    onChange={e => setSalary({ ...salary, lateNightStart: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">終了時間</label>
                  <input type="time" value={salary.lateNightEnd}
                    onChange={e => setSalary({ ...salary, lateNightEnd: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  割増率: <span className="text-purple-600 font-bold">{Math.round((salary.lateNightRate - 1) * 100)}%増</span>
                </label>
                <input type="range" min={0} max={100} step={5}
                  value={Math.round((salary.lateNightRate - 1) * 100)}
                  onChange={e => setSalary({ ...salary, lateNightRate: 1 + Number(e.target.value) / 100 })}
                  className="w-full accent-purple-500" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%（割増なし）</span><span>50%</span><span>100%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                例: 時給1,000円 → 深夜帯は {Math.round(1000 * salary.lateNightRate).toLocaleString()}円
              </p>
            </div>

            {/* 残業手当 */}
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-700 mb-3">⏰ 残業手当</h4>
              <div className="mb-3">
                <label className="text-xs text-gray-500">
                  残業開始: 1日 <span className="text-blue-600 font-bold">{salary.overtimeThreshold / 60}時間</span> 超
                </label>
                <input type="range" min={360} max={720} step={30}
                  value={salary.overtimeThreshold}
                  onChange={e => setSalary({ ...salary, overtimeThreshold: Number(e.target.value) })}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>6時間</span><span>8時間</span><span>10時間</span><span>12時間</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">
                  割増率: <span className="text-blue-600 font-bold">{Math.round((salary.overtimeRate - 1) * 100)}%増</span>
                </label>
                <input type="range" min={0} max={100} step={5}
                  value={Math.round((salary.overtimeRate - 1) * 100)}
                  onChange={e => setSalary({ ...salary, overtimeRate: 1 + Number(e.target.value) / 100 })}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0%（割増なし）</span><span>50%</span><span>100%</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                例: 時給1,000円 → 残業は {Math.round(1000 * salary.overtimeRate).toLocaleString()}円
              </p>
            </div>
          </div>

          {salaryMsg && (
            <p className={`mt-3 text-sm ${salaryMsg.includes('エラー') ? 'text-red-500' : 'text-green-600'}`}>{salaryMsg}</p>
          )}

          <button onClick={handleSaveSalary}
            className="w-full mt-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors">
            給料設定を保存
          </button>
        </div>
      </div>
    </div>
  );
}
