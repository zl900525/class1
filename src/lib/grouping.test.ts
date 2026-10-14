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
    const notice: Notice = { id: 'n', kind: 'join', nickname: 'dog', at: t('10:00:05'), after: null };
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

  it('裝置時鐘比伺服器快時，提示還是排在它出現當下的最後一則訊息後面', () => {
    // 提示出現時最後一則是 a；裝置時鐘快了 30 秒，所以提示的時間比之後才送來的 b 還晚
    const notice: Notice = { id: 'n', kind: 'join', nickname: 'dog', at: t('10:00:40'), after: 'a' };
    const items = buildTimeline([msg('a', 'cat', t('10:00:00')), msg('b', 'dog', t('10:00:20'))], [notice], now);
    expect(items.map((i) => i.key)).toEqual(['date-2026-10-13', 'a', 'n', 'b']);
  });

  it('對應的訊息不見了（例如失敗訊息被刪掉），就改用時間排序', () => {
    const notice: Notice = { id: 'n', kind: 'leave', nickname: 'dog', at: t('10:00:30'), after: 'gone' };
    const items = buildTimeline([msg('a', 'cat', t('10:00:00')), msg('b', 'cat', t('10:01:00'))], [notice], now);
    expect(items.map((i) => i.key)).toEqual(['date-2026-10-13', 'a', 'n', 'b']);
  });

  it('已收回的訊息變成收回提示', () => {
    const items = buildTimeline([msg('a', 'cat', t('10:00:00'), { recalledAt: t('10:01:00') })], [], now);
    expect(items[1].type).toBe('recalled');
  });
});
