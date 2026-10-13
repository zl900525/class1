// 時間顯示，一律使用裝置的時區

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 同一天的鍵，用來判斷要不要插入日期分隔線 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dateLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (dayKey(iso) === dayKey(now.toISOString())) return '今天';
  const base = `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  return d.getFullYear() === now.getFullYear() ? base : `${d.getFullYear()} 年 ${base}`;
}

/** 收回剩餘時間，例如 1:24 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}
