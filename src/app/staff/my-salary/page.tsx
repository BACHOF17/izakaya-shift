'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/nav';
import { useSession } from '@/lib/useSession';

interface SalaryDetail {
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
  totalLateNightMin: number;
  totalOvertimeMin: number;
  shifts: { date: string; start: string; end: string; breakMin: number; hours: number; minutes: number; lateNightMin: number; overtimeMin: number; pay: number }[];
}

export default function MySalaryPage() {
  const { session } = useSession();
  const [salary, setSalary] = useState<SalaryDetail | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    fetch(`/api/salary?month=${selectedMonth}`)
      .then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); })
      .then(data => { if (data && data[0]) setSalary(data[0]); else setSalary(null); })
      .catch(() => {});
  }, [selectedMonth, router]);

  const formatMin = (min: number) => `${Math.floor(min / 60)}h${min % 60}m`;

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20">
      <Nav role={session.role} name={session.name} />
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">給料確認</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500"
          />
        </div>

        {salary ? (
          <div className="space-y-4">
            {/* メイン */}
            <div className="bg-orange-500 text-white rounded-xl p-6 text-center">
              <p className="text-sm opacity-80">今月の給料</p>
              <p className="text-3xl font-bold mt-1">{salary.totalPay.toLocaleString()}円</p>
              <p className="text-sm opacity-80 mt-1">{salary.workDays}日 / {salary.totalHours}h{salary.totalMinutes}m</p>
            </div>

            {/* 内訳 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-500">基本給</p>
                <p className="font-bold">{salary.basePay.toLocaleString()}円</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                <p className="text-xs text-green-500">交通費</p>
                <p className="font-bold text-green-700">{salary.totalTransport.toLocaleString()}円</p>
              </div>
              {(salary.lateNightPay || 0) > 0 && (
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-purple-500">深夜手当</p>
                  <p className="font-bold text-purple-700">{salary.lateNightPay.toLocaleString()}円</p>
                  <p className="text-[10px] text-purple-400">{formatMin(salary.totalLateNightMin)}</p>
                </div>
              )}
              {(salary.overtimePay || 0) > 0 && (
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500">残業手当</p>
                  <p className="font-bold text-blue-700">{salary.overtimePay.toLocaleString()}円</p>
                  <p className="text-[10px] text-blue-400">{formatMin(salary.totalOvertimeMin)}</p>
                </div>
              )}
            </div>

            {/* 勤務詳細 */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h4 className="font-semibold mb-2 text-sm">勤務詳細</h4>
              <div className="space-y-1">
                {salary.shifts.map((s, i) => (
                  <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{s.date}</span>
                      <span className="text-gray-500">{s.start}-{s.end}</span>
                      <span className="font-medium">{s.pay.toLocaleString()}円</span>
                    </div>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{s.hours}h{s.minutes}m</span>
                      {s.lateNightMin > 0 && (
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">
                          深夜{formatMin(s.lateNightMin)}
                        </span>
                      )}
                      {s.overtimeMin > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">
                          残業{formatMin(s.overtimeMin)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
            この月のシフトデータはありません
          </div>
        )}
      </div>
    </div>
  );
}
