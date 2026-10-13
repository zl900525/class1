import { describe, expect, it } from 'vitest';
import type { Message } from '../chat/types';
import { buildTimeline, type Notice } from './grouping';

const msg = (id: string, senderId: string, at: string, extra: Partial<Message> = {}): Message => ({
  id,
  senderId,
  nickname: senderId,
  text: id,
  image: null,
  replyTo: null,
  createdAt: at,
  recalledAt: null,
  ...extra,
});

const now = new Date('2026-10-13T12:00:00');
const t = (hhmmss: string, day = '2026-10-13') => new Date(`${day}T${hhmmss}`).toISOString();

describe('buildTimeline', () => {
  it('同一個人 1 分鐘內只有第一則顯示代號', () => {
    const items = buildTimeline(
      [msg('a', 'cat', t('10:00:00')), msg('b', 'cat', t('10:00:40')), msg('c', 'cat', t('10:02:00'))],
      [],
      now,
    );
    const shown = items.flatMap((i) => (i.type === 'message' ? [i.showName] : []));
    expect(shown).toEqual([true, false, true]);
  });

  it('不同人會重新顯示代號', () => {
    const items = buildTimeline([msg('a', 'cat', t('10:00:00')), msg('b', 'dog', t('10:00:10'))], [], now);
    const shown = items.flatMap((i) => (i.type === 'message' ? [i.showName] : []));
    expect(shown).toEqual([true, true]);
  });

  it('中間夾了進出提示就重新顯示代號', () => {
    const notice: Notice = { id: 'n', kind: 'join', nickname: 'dog', at: t('10:00:05') };
    const items = buildTimeline([msg('a', 'cat', t('10:00:00')), msg('b', 'cat', t('10:00:10'))], [notice], now);
    expect(items.map((i) => i.type)).toEqual(['date', 'message', 'notice', 'message']);
    const last = items[3];
    expect(last.type === 'message' && last.showName).toBe(true);
  });

  it('跨日插入日期分隔線', () => {
    const items = buildTimeline(
      [msg('a', 'cat', t('23:59:00', '2026-10-12')), msg('b', 'cat', t('00:00:30'))],
      [],
      now,
    );
    const labels = items.flatMap((i) => (i.type === 'date' ? [i.label] : []));
    expect(labels).toEqual(['10 月 12 日', '今天']);
  });

  it('已收回的訊息變成收回提示', () => {
    const items = buildTimeline([msg('a', 'cat', t('10:00:00'), { recalledAt: t('10:01:00') })], [], now);
    expect(items[1].type).toBe('recalled');
  });
});
