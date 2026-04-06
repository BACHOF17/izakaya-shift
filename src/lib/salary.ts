export interface ShiftDetail {
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

export interface SalaryDetail {
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

// デフォルト値（APIから設定を渡せる）
let LATE_NIGHT_START = 22 * 60;
let LATE_NIGHT_END = 5 * 60;
let OVERTIME_THRESHOLD = 8 * 60;
let LATE_NIGHT_RATE = 1.25;
let OVERTIME_RATE = 1.25;

export interface SalaryConfig {
  lateNightStart?: string;
  lateNightEnd?: string;
  lateNightRate?: number;
  overtimeThreshold?: number;
  overtimeRate?: number;
}

export function applySalaryConfig(config: SalaryConfig) {
  if (config.lateNightStart) LATE_NIGHT_START = timeToMinutes(config.lateNightStart);
  if (config.lateNightEnd) LATE_NIGHT_END = timeToMinutes(config.lateNightEnd);
  if (config.lateNightRate) LATE_NIGHT_RATE = config.lateNightRate;
  if (config.overtimeThreshold) OVERTIME_THRESHOLD = config.overtimeThreshold;
  if (config.overtimeRate) OVERTIME_RATE = config.overtimeRate;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function calcLateNightMinutes(startMin: number, endMin: number): number {
  let lateNight = 0;

  if (endMin <= startMin) {
    // 日跨ぎ: startMin～24:00 と 0:00～endMin の2区間
    // startMin～24:00
    if (startMin < 24 * 60) {
      const segStart = Math.max(startMin, LATE_NIGHT_START);
      const segEnd = 24 * 60;
      if (segStart < segEnd) lateNight += segEnd - segStart;
    }
    // 0:00～endMin（翌朝）
    if (endMin > 0) {
      const segEnd = Math.min(endMin, LATE_NIGHT_END);
      if (segEnd > 0) lateNight += segEnd;
    }
  } else {
    // 同日内
    // 22:00-24:00の深夜帯
    if (endMin > LATE_NIGHT_START && startMin < 24 * 60) {
      const segStart = Math.max(startMin, LATE_NIGHT_START);
      const segEnd = Math.min(endMin, 24 * 60);
      if (segStart < segEnd) lateNight += segEnd - segStart;
    }
    // 0:00-5:00の深夜帯（早朝勤務がある場合）
    if (startMin < LATE_NIGHT_END && endMin > 0) {
      const segEnd = Math.min(endMin, LATE_NIGHT_END);
      const segStart = Math.max(startMin, 0);
      if (segStart < segEnd) lateNight += segEnd - segStart;
    }
  }

  return lateNight;
}

/**
 * 勤務時間を計算（日跨ぎ対応）
 */
function calcWorkedMinutes(startMin: number, endMin: number, breakMin: number): number {
  let worked: number;
  if (endMin <= startMin) {
    // 日跨ぎ: 例 17:00(1020)→02:00(120) = 24*60 - 1020 + 120 = 540分
    worked = (24 * 60 - startMin) + endMin;
  } else {
    worked = endMin - startMin;
  }
  worked -= breakMin;
  return Math.max(worked, 0);
}

export function calculateSalary(
  staff: { id: number; name: string; hourly_rate: number; transport_fee: number },
  shifts: { date: string; start_time: string; end_time: string; break_minutes: number; actual_start: string | null; actual_end: string | null }[]
): SalaryDetail {
  const details: ShiftDetail[] = [];
  let totalMinutes = 0;
  let totalNormalMin = 0;
  let totalLateNightMin = 0;
  let totalOvertimeMin = 0;
  let workDays = 0;

  for (const shift of shifts) {
    const start = shift.actual_start || shift.start_time;
    const end = shift.actual_end || shift.end_time;
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);

    const worked = calcWorkedMinutes(startMin, endMin, shift.break_minutes);
    const lateNightMin = Math.min(calcLateNightMinutes(startMin, endMin), worked);

    // 8時間超は残業
    const overtimeMin = Math.max(worked - OVERTIME_THRESHOLD, 0);

    // 通常時間 = 全体 - 深夜 - 残業（重複を考慮）
    const normalMin = Math.max(worked - lateNightMin - overtimeMin, 0);

    // このシフトの給料計算
    const rate = staff.hourly_rate;
    const shiftPay = Math.floor(
      (normalMin * rate / 60) +
      (lateNightMin * rate * LATE_NIGHT_RATE / 60) +
      (overtimeMin * rate * OVERTIME_RATE / 60)
    );

    totalMinutes += worked;
    totalNormalMin += normalMin;
    totalLateNightMin += lateNightMin;
    totalOvertimeMin += overtimeMin;
    workDays++;

    details.push({
      date: shift.date,
      start,
      end,
      breakMin: shift.break_minutes,
      hours: Math.floor(worked / 60),
      minutes: worked % 60,
      normalMin,
      lateNightMin,
      overtimeMin,
      pay: shiftPay,
    });
  }

  const rate = staff.hourly_rate;
  const basePay = Math.floor(totalNormalMin * rate / 60);
  const lateNightPay = Math.floor(totalLateNightMin * rate * LATE_NIGHT_RATE / 60);
  const overtimePay = Math.floor(totalOvertimeMin * rate * OVERTIME_RATE / 60);
  const totalTransport = staff.transport_fee * workDays;
  const totalPay = basePay + lateNightPay + overtimePay + totalTransport;

  return {
    staffId: staff.id,
    staffName: staff.name,
    hourlyRate: staff.hourly_rate,
    transportFee: staff.transport_fee,
    totalHours: Math.floor(totalMinutes / 60),
    totalMinutes: totalMinutes % 60,
    workDays,
    basePay,
    lateNightPay,
    overtimePay,
    totalTransport,
    totalPay,
    totalNormalMin,
    totalLateNightMin,
    totalOvertimeMin,
    shifts: details,
  };
}
