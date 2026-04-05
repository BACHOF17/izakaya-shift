'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface ShiftDetail {
  date: string;
  start: string;
  end: string;
  breakMin: number;
  hours: number;
  minutes: number;
  normalMin: number;
  lateNightMin: number;
  overtimeMin: number;
  pay: number;
}

interface SalaryDetail {
  staffId: number;
  staffName: string;
  hourlyRate: number;
  transportFee: number;
  totalHours: number;
  totalMinutes: number;
  workDays: number;
  basePay: number;
  lateNightPay: number;
  overtimePay: number;
  totalTransport: number;
  totalPay: number;
  totalNormalMin: number;
  totalLateNightMin: number;
  totalOvertimeMin: number;
  shifts: ShiftDetail[];
}

export default function OwnerSalaryPage() {
  const { session } = useSession('owner');
  const [salaries, setSalaries] = useState<SalaryDetail[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!selectedMonth || !session) return;
    fetch(`/api/salary?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSalaries(data); })
      .catch(() => {});
  }, [selectedMonth, session]);

  const totalAll = salaries.reduce((sum, s) => sum + s.totalPay, 0);
  const totalLateNight = salaries.reduce((sum, s) => sum + (s.lateNightPay || 0), 0);
  const totalOvertime = salaries.reduce((sum, s) => sum + (s.overtimePay || 0), 0);

  const formatMin = (min: number) => `${Math.floor(min / 60)}h${min % 60}m`;

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role="owner" name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">給料計算</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* 合計 */}
        <div className="bg-orange-500 text-white rounded-xl shadow-sm p-6 text-center">
          <p className="text-sm opacity-80">今月の人件費合計</p>
          <p className="text-3xl font-bold mt-1">{totalAll.toLocaleString()}円</p>
          <p className="text-sm opacity-80 mt-1">{salaries.length}人</p>
        </div>

        {/* 内訳サマリー */}
        {(totalLateNight > 0 || totalOvertime > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-500">深夜手当合計</p>
              <p className="font-bold text-purple-700">{totalLateNight.toLocaleString()}円</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500">残業手当合計</p>
              <p className="font-bold text-blue-700">{totalOvertime.toLocaleString()}円</p>
            </div>
          </div>
        )}

        {/* スタッフ別 */}
        <div className="space-y-3">
          {salaries.map(s => (
            <div key={s.staffId} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === s.staffId ? null : s.staffId)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="text-left">
                  <span className="font-medium">{s.staffName}</span>
                  <span className="text-gray-400 ml-2 text-sm">
                    {s.workDays}日 / {s.totalHours}h{s.totalMinutes}m
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg">{s.totalPay.toLocaleString()}円</span>
                  <span className="text-gray-400 ml-1 text-sm">{expandedId === s.staffId ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedId === s.staffId && (
                <div className="border-t px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2 py-3 text-center text-sm">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">時給</p>
                      <p className="font-bold">{s.hourlyRate.toLocaleString()}円</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">基本給</p>
                      <p className="font-bold">{s.basePay.toLocaleString()}円</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-purple-500 text-xs">深夜手当 (25%増)</p>
                      <p className="font-bold text-purple-700">
                        {(s.lateNightPay || 0).toLocaleString()}円
                        {s.totalLateNightMin > 0 && (
                          <span className="text-xs font-normal text-purple-400 ml-1">
                            ({formatMin(s.totalLateNightMin)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-blue-500 text-xs">残業手当 (25%増)</p>
                      <p className="font-bold text-blue-700">
                        {(s.overtimePay || 0).toLocaleString()}円
                        {s.totalOvertimeMin > 0 && (
                          <span className="text-xs font-normal text-blue-400 ml-1">
                            ({formatMin(s.totalOvertimeMin)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="text-green-500 text-xs">交通費</p>
                      <p className="font-bold text-green-700">{s.totalTransport.toLocaleString()}円</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-orange-500 text-xs">合計</p>
                      <p className="font-bold text-orange-700">{s.totalPay.toLocaleString()}円</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">勤務詳細</p>
                    {s.shifts.map((sh, i) => (
                      <div key={i} className="flex flex-wrap items-center justify-between text-sm py-1.5 border-b border-gray-100">
                        <span className="font-medium">{sh.date}</span>
                        <span className="text-gray-500">{sh.start}-{sh.end}</span>
                        <span>{sh.hours}h{sh.minutes}m</span>
                        <div className="w-full flex gap-2 mt-0.5">
                          {sh.lateNightMin > 0 && (
                            <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                              深夜{formatMin(sh.lateNightMin)}
                            </span>
                          )}
                          {sh.overtimeMin > 0 && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                              残業{formatMin(sh.overtimeMin)}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {sh.pay.toLocaleString()}円
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {salaries.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
              この月のシフトデータはありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
