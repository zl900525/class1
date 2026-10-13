// 訊息列表：時間軸、自動捲動、「↓ N 則新訊息」、空聊天室（架構文件 7.2）

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Emoji } from '../chat/types';
import { buildTimeline } from '../lib/grouping';
import { useChatState, useChatStore } from '../state/ChatContext';
import { ArrowDownIcon, ChatIcon } from './Icons';
import { MessageBubble, type BubbleActions } from './MessageBubble';
import { MessageMenu } from './MessageMenu';
import { DateSeparator, SystemNotice } from './SystemNotice';

const BOTTOM_THRESHOLD = 80;

export function MessageList({ onOpenImage }: { onOpenImage: (url: string) => void }) {
  const state = useChatState();
  const store = useChatStore();
  const { messages, notices, pending, reactions, referenced, userId } = state;

  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const seen = useRef(new Set<string>());
  const seenNotices = useRef(0);
  const [newCount, setNewCount] = useState(0);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const timeline = useMemo(() => buildTimeline(messages, notices), [messages, notices]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // 被回覆、但不在列表裡的原訊息，去問聊天服務
  useEffect(() => {
    const ids = messages.flatMap((m) => (m.replyTo && !byId.has(m.replyTo) ? [m.replyTo] : []));
    if (ids.length) store.ensureReferenced(ids);
  }, [messages, byId, store]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottom.current = true;
    setNewCount(0);
  }, []);

  useLayoutEffect(() => {
    const fresh = messages.filter((m) => !seen.current.has(m.id));
    fresh.forEach((m) => seen.current.add(m.id));
    const freshNotices = notices.length > seenNotices.current;
    seenNotices.current = notices.length;
    if (fresh.length === 0 && !freshNotices) return;

    const mineJustSent = fresh.some((m) => m.senderId === userId && pending[m.id]);
    if (mineJustSent || atBottom.current || seen.current.size === fresh.length) {
      scrollToBottom();
    } else {
      const fromOthers = fresh.filter((m) => m.senderId !== userId).length;
      if (fromOthers) setNewCount((c) => c + fromOthers);
    }
  }, [messages, notices, pending, userId, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
    if (atBottom.current && newCount) setNewCount(0);
  };

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('msg--flash');
    void el.offsetWidth; // 重新觸發閃一下的動畫
    el.classList.add('msg--flash');
  }, []);

  const actions: BubbleActions = useMemo(
    () => ({
      onReply: (id) => store.setReplyTo(id),
      onRecall: (id) => void store.recall(id),
      onToggleReaction: (id, emoji: Emoji) => void store.toggleReaction(id, emoji),
      onRetry: (id) => store.retry(id),
      onDiscard: (id) => store.discard(id),
      onOpenImage,
      onOpenMenu: setMenuFor,
      onJump: jumpTo,
      onTogglePicker: setPickerFor,
    }),
    [store, onOpenImage, jumpTo],
  );

  const menuMessage = menuFor ? byId.get(menuFor) : undefined;

  return (
    <div className="msg-list-wrap">
      <div className="msg-list" ref={listRef} onScroll={onScroll} aria-live="polite" aria-relevant="additions">
        <div className="msg-list-inner">
          {timeline.length === 0 && (
            <div className="empty">
              <span className="empty-mark" aria-hidden="true">
                <ChatIcon size={48} />
              </span>
              <p>還沒有人說話，打個招呼吧</p>
            </div>
          )}
          {timeline.map((item) => {
            switch (item.type) {
              case 'date':
                return <DateSeparator key={item.key} label={item.label} />;
              case 'notice':
                return (
                  <SystemNotice
                    key={item.key}
                    text={`${item.notice.nickname} ${item.notice.kind === 'join' ? '進入' : '離開'}了聊天室`}
                  />
                );
              case 'recalled':
                return <SystemNotice key={item.key} text={`${item.message.nickname} 收回了一則訊息`} />;
              case 'message': {
                const m = item.message;
                const quotedId = m.replyTo;
                const quoted = quotedId ? (byId.get(quotedId) ?? referenced[quotedId]) : undefined;
                return (
                  <MessageBubble
                    key={item.key}
                    message={m}
                    showName={item.showName}
                    isMine={m.senderId === userId}
                    userId={userId}
                    pending={pending[m.id]}
                    reactions={reactions[m.id] ?? []}
                    quoted={quoted}
                    canJumpToQuoted={!!quotedId && byId.has(quotedId)}
                    pickerOpen={pickerFor === m.id}
                    actions={actions}
                  />
                );
              }
            }
          })}
        </div>
      </div>

      {newCount > 0 && (
        <button type="button" className="new-msgs" onClick={() => scrollToBottom(true)}>
          <ArrowDownIcon size={16} />
          {newCount} 則新訊息
        </button>
      )}

      {menuMessage && !menuMessage.recalledAt && (
        <MessageMenu
          message={menuMessage}
          isMine={menuMessage.senderId === userId}
          mineEmojis={new Set((reactions[menuMessage.id] ?? []).filter((r) => r.userId === userId).map((r) => r.emoji))}
          onReact={(emoji) => void store.toggleReaction(menuMessage.id, emoji)}
          onReply={() => store.setReplyTo(menuMessage.id)}
          onRecall={() => void store.recall(menuMessage.id)}
          onClose={() => setMenuFor(null)}
        />
      )}
    </div>
  );
}
