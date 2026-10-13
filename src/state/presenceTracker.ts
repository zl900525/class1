// 線上名單與進出提示的規則（架構文件 6.3）：
// - 同一個代號開好幾個分頁算同一個人
// - 有人離開先等 10 秒，10 秒內回來就什麼都不顯示
// - 剛進入時拿到的完整名單，不會讓每個人都跳一次「進入了聊天室」

import type { PresenceUser } from '../chat/types';
import { nicknameKey } from '../lib/nickname';

export const LEAVE_GRACE_MS = 10_000;

export interface OnlineUser {
  key: string;
  nickname: string;
  isMe: boolean;
}

type NoticeHandler = (kind: 'join' | 'leave', nickname: string) => void;

export class PresenceTracker {
  private tabs = new Map<string, PresenceUser>();
  private grace = new Map<string, { user: PresenceUser; timer: ReturnType<typeof setTimeout> }>();
  private myUserId = '';

  constructor(
    private onChange: () => void,
    private onNotice: NoticeHandler,
    private graceMs = LEAVE_GRACE_MS,
  ) {}

  reset(myUserId: string) {
    this.myUserId = myUserId;
    this.grace.forEach((g) => clearTimeout(g.timer));
    this.grace.clear();
    this.tabs.clear();
  }

  /** initial = 剛進入時的完整名單，不產生提示；之後的 sync（例如重連）會比對差異 */
  sync(list: PresenceUser[], initial: boolean) {
    if (initial) {
      this.reset(this.myUserId);
      list.forEach((u) => this.tabs.set(u.tabId, u));
      this.onChange();
      return;
    }
    const incoming = new Map(list.map((u) => [u.tabId, u]));
    for (const [tabId, u] of this.tabs) if (!incoming.has(tabId)) this.leave(u);
    for (const [tabId, u] of incoming) if (!this.tabs.has(tabId)) this.join(u);
  }

  join(user: PresenceUser) {
    const key = nicknameKey(user.nickname);
    const pending = this.grace.get(key);
    const wasPresent = this.hasTab(key) || !!pending;
    if (pending) {
      clearTimeout(pending.timer);
      this.grace.delete(key);
    }
    this.tabs.set(user.tabId, user);
    if (!wasPresent && user.userId !== this.myUserId) this.onNotice('join', user.nickname);
    this.onChange();
  }

  leave(user: PresenceUser) {
    if (!this.tabs.delete(user.tabId)) return;
    const key = nicknameKey(user.nickname);
    if (this.hasTab(key) || user.userId === this.myUserId || this.grace.has(key)) {
      this.onChange();
      return;
    }
    const timer = setTimeout(() => {
      this.grace.delete(key);
      this.onNotice('leave', user.nickname);
      this.onChange();
    }, this.graceMs);
    this.grace.set(key, { user, timer });
  }

  /** 自己排第一個，其他人依上線順序 */
  list(): OnlineUser[] {
    const byKey = new Map<string, { nickname: string; onlineAt: string; isMe: boolean }>();
    const add = (u: PresenceUser) => {
      const key = nicknameKey(u.nickname);
      const existing = byKey.get(key);
      const isMe = u.userId === this.myUserId || !!existing?.isMe;
      if (!existing || u.onlineAt < existing.onlineAt) {
        byKey.set(key, { nickname: u.nickname, onlineAt: u.onlineAt, isMe });
      } else if (isMe) existing.isMe = true;
    };
    this.tabs.forEach(add);
    this.grace.forEach((g) => add(g.user));
    return [...byKey.entries()]
      .sort(([, a], [, b]) => Number(b.isMe) - Number(a.isMe) || a.onlineAt.localeCompare(b.onlineAt))
      .map(([key, v]) => ({ key, nickname: v.nickname, isMe: v.isMe }));
  }

  private hasTab(key: string) {
    for (const u of this.tabs.values()) if (nicknameKey(u.nickname) === key) return true;
    return false;
  }
}
