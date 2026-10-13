import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresenceUser } from '../chat/types';
import { PresenceTracker } from './presenceTracker';

const user = (userId: string, nickname: string, tabId = `${userId}-tab`, onlineAt = '2026-10-13T10:00:00Z'): PresenceUser => ({
  userId,
  tabId,
  nickname,
  onlineAt,
});

describe('PresenceTracker', () => {
  let notices: string[];
  let tracker: PresenceTracker;
  const me = user('me', '小明');

  beforeEach(() => {
    vi.useFakeTimers();
    notices = [];
    tracker = new PresenceTracker(() => {}, (kind, nick) => notices.push(`${kind}:${nick}`));
    tracker.reset('me');
  });
  afterEach(() => vi.useRealTimers());

  it('剛進入時的名單不產生提示，自己排第一個', () => {
    tracker.sync([user('cat', '小貓', 'c', '2026-10-13T09:00:00Z'), me], true);
    expect(notices).toEqual([]);
    expect(tracker.list().map((u) => u.nickname)).toEqual(['小明', '小貓']);
    expect(tracker.list()[0].isMe).toBe(true);
  });

  it('有人上線馬上顯示進入提示', () => {
    tracker.sync([me], true);
    tracker.join(user('cat', '小貓'));
    expect(notices).toEqual(['join:小貓']);
  });

  it('離開後 10 秒才顯示離開提示，這段時間名單還保留', () => {
    const cat = user('cat', '小貓');
    tracker.sync([me, cat], true);
    tracker.leave(cat);
    vi.advanceTimersByTime(9_999);
    expect(notices).toEqual([]);
    expect(tracker.list().map((u) => u.nickname)).toContain('小貓');
    vi.advanceTimersByTime(1);
    expect(notices).toEqual(['leave:小貓']);
    expect(tracker.list().map((u) => u.nickname)).not.toContain('小貓');
  });

  it('10 秒內回來（例如重新整理）什麼都不顯示', () => {
    const cat = user('cat', '小貓', 'old-tab');
    tracker.sync([me, cat], true);
    tracker.leave(cat);
    vi.advanceTimersByTime(5_000);
    tracker.join(user('cat', '小貓', 'new-tab'));
    vi.advanceTimersByTime(20_000);
    expect(notices).toEqual([]);
  });

  it('同一個人開兩個分頁只算一個，關掉其中一個不算離開', () => {
    tracker.sync([me], true);
    tracker.join(user('cat', '小貓', 't1'));
    tracker.join(user('cat', '小貓', 't2'));
    expect(notices).toEqual(['join:小貓']);
    expect(tracker.list()).toHaveLength(2);
    tracker.leave(user('cat', '小貓', 't1'));
    vi.advanceTimersByTime(20_000);
    expect(notices).toEqual(['join:小貓']);
  });

  it('重連後的名單比對差異', () => {
    const cat = user('cat', '小貓');
    tracker.sync([me, cat], true);
    tracker.sync([me, user('dog', '阿土')], false);
    expect(notices).toEqual(['join:阿土']);
    vi.advanceTimersByTime(10_000);
    expect(notices).toEqual(['join:阿土', 'leave:小貓']);
  });
});
