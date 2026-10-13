// 手機長按選單（docs/design.md 3.6）

import { useEffect } from 'react';
import { EMOJIS, RECALL_WINDOW_MS, type Emoji, type Message } from '../chat/types';
import { formatRemaining } from '../lib/time';
import { useNow } from '../state/ChatContext';
import { RecallIcon, ReplyIcon } from './Icons';
import { excerpt } from './ReplyQuote';

interface Props {
  message: Message;
  isMine: boolean;
  mineEmojis: Set<Emoji>;
  onReact: (emoji: Emoji) => void;
  onReply: () => void;
  onRecall: () => void;
  onClose: () => void;
}

export function MessageMenu({ message, isMine, mineEmojis, onReact, onReply, onRecall, onClose }: Props) {
  const now = useNow(1000, isMine);
  const remaining = RECALL_WINDOW_MS - (now - Date.parse(message.createdAt));
  const showRecall = isMine && remaining > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="menu-layer">
      <button type="button" className="menu-scrim" aria-label="關閉選單" onClick={onClose} />
      <div className={`menu-stack${isMine ? ' menu-stack--mine' : ''}`}>
        <div className={`menu-preview${isMine ? ' menu-preview--mine' : ''}`}>{excerpt(message, 80) || '[圖片]'}</div>
        <div className="menu" role="menu" aria-label="訊息操作">
          <div className="menu-emojis">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                className={`menu-emoji${mineEmojis.has(emoji) ? ' menu-emoji--mine' : ''}`}
                aria-label={`${mineEmojis.has(emoji) ? '取消' : '按'} ${emoji}`}
                onClick={act(() => onReact(emoji))}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" className="menu-item" onClick={act(onReply)}>
            <ReplyIcon />
            <span>回覆</span>
          </button>
          {showRecall && (
            <button type="button" role="menuitem" className="menu-item" onClick={act(onRecall)}>
              <RecallIcon />
              <span className="menu-item-label">收回</span>
              <span className="menu-item-hint">還剩 {formatRemaining(remaining)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
