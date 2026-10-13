// 把訊息和進出提示排成畫面上的時間軸：
// 跨日插入日期分隔線；同一個人 1 分鐘內的連續訊息只有第一則顯示代號（架構文件 7.2）

import type { Message } from '../chat/types';
import { dateLabel, dayKey } from './time';

export interface Notice {
  id: string;
  kind: 'join' | 'leave';
  nickname: string;
  at: string;
}

export type TimelineItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'notice'; key: string; notice: Notice }
  | { type: 'recalled'; key: string; message: Message }
  | { type: 'message'; key: string; message: Message; showName: boolean };

const GROUP_WINDOW_MS = 60 * 1000;

export function buildTimeline(
  messages: Message[],
  notices: Notice[],
  now: Date = new Date(),
): TimelineItem[] {
  type Entry = { at: string; message?: Message; notice?: Notice };
  const entries: Entry[] = [
    ...messages.map((message) => ({ at: message.createdAt, message })),
    ...notices.map((notice) => ({ at: notice.at, notice })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const items: TimelineItem[] = [];
  let lastDay = '';
  let prev: Message | null = null;

  for (const entry of entries) {
    const day = dayKey(entry.at);
    if (day !== lastDay) {
      items.push({ type: 'date', key: `date-${day}`, label: dateLabel(entry.at, now) });
      lastDay = day;
      prev = null;
    }

    if (entry.notice) {
      items.push({ type: 'notice', key: entry.notice.id, notice: entry.notice });
      prev = null;
      continue;
    }

    const message = entry.message!;
    if (message.recalledAt) {
      items.push({ type: 'recalled', key: message.id, message });
      prev = null;
      continue;
    }

    const grouped =
      prev !== null &&
      prev.senderId === message.senderId &&
      prev.nickname === message.nickname &&
      Date.parse(message.createdAt) - Date.parse(prev.createdAt) <= GROUP_WINDOW_MS;
    items.push({ type: 'message', key: message.id, message, showName: !grouped });
    prev = message;
  }
  return items;
}
