import { describe, expect, it } from 'vitest';
import { dateLabel, dayKey, formatRemaining, formatTime } from './time';

// 用裝置時區建立時間，測試在任何時區都成立
const local = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('formatTime', () => {
  it('顯示 時:分，個位數補 0', () => {
    expect(formatTime(local(2026, 10, 13, 9, 5))).toBe('09:05');
    expect(formatTime(local(2026, 10, 13, 23, 59))).toBe('23:59');
  });
});

describe('dayKey', () => {
  it('同一天的不同時間是同一個鍵', () => {
    expect(dayKey(local(2026, 10, 13, 0, 1))).toBe(dayKey(local(2026, 10, 13, 23, 59)));
  });
  it('跨過午夜就是不同天', () => {
    expect(dayKey(local(2026, 10, 13, 23, 59))).not.toBe(dayKey(local(2026, 10, 14, 0, 0)));
  });
});

describe('dateLabel', () => {
  const now = new Date(2026, 9, 13, 15, 0);
  it('今天顯示「今天」', () => {
    expect(dateLabel(local(2026, 10, 13, 8), now)).toBe('今天');
  });
  it('今年的其他天顯示月日', () => {
    expect(dateLabel(local(2026, 10, 12), now)).toBe('10 月 12 日');
  });
  it('去年的顯示年月日', () => {
    expect(dateLabel(local(2025, 12, 31), now)).toBe('2025 年 12 月 31 日');
  });
});

describe('formatRemaining', () => {
  it('顯示 分:秒', () => {
    expect(formatRemaining(84_000)).toBe('1:24');
    expect(formatRemaining(120_000)).toBe('2:00');
  });
  it('不足一秒進位成 1 秒', () => {
    expect(formatRemaining(400)).toBe('0:01');
  });
  it('已經過期顯示 0:00', () => {
    expect(formatRemaining(-5_000)).toBe('0:00');
  });
});
