// 把訊息和進出提示排成畫面上的時間軸：
// 跨日插入日期分隔線；同一個人 1 分鐘內的連續訊息只有第一則顯示代號（架構文件 7.2）

import type { Message } from '../chat/types';
import { dateLabel, dayKey } from './time';

export interface Notice {
  id: string;
  kind: 'join' | 'leave';
  nickname: string;
  /** 裝置的時間，只在沒有 after 時用來排序 */
  at: string;
  /** 提示出現當下，畫面上最後一則訊息的 id。提示固定排在它後面，不受裝置時鐘快慢影響 */
  after: string | null;
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
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(sorted.map((m) => m.id));
  const anchored = new Map<string, Notice[]>();
  const loose: Notice[] = [];
  for (const notice of notices) {
    if (notice.after && ids.has(notice.after)) {
      anchored.set(notice.after, [...(anchored.get(notice.after) ?? []), notice]);
    } else {
      loose.push(notice);
    }
  }

  // 有對應訊息的提示緊跟在那則訊息後面（日期跟著那則訊息算）；其他的依時間排進去
  const entries: Entry[] = [];
  for (const message of sorted) {
    entries.push({ at: message.createdAt, message });
    for (const notice of anchored.get(message.id) ?? []) entries.push({ at: message.createdAt, notice });
  }
  for (const notice of loose) {
    const index = entries.findIndex((e) => e.at > notice.at);
    entries.splice(index === -1 ? entries.length : index, 0, { at: notice.at, notice });
  }

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
