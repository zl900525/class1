// 一則訊息（docs/design.md 3.1、3.5）

import { useRef } from 'react';
import { RECALL_WINDOW_MS, type Emoji, type Message, type Reaction } from '../chat/types';
import { linkify } from '../lib/linkify';
import { formatTime } from '../lib/time';
import { useNow, type PendingInfo } from '../state/ChatContext';
import { AlertIcon, RecallIcon, ReplyIcon, SmileIcon } from './Icons';
import { ReactionBar } from './ReactionBar';
import { ReactionPicker } from './ReactionPicker';
import { ReplyQuote } from './ReplyQuote';

const LONG_PRESS_MS = 500;

export interface BubbleActions {
  onReply: (id: string) => void;
  onRecall: (id: string) => void;
  onToggleReaction: (id: string, emoji: Emoji) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onOpenImage: (url: string) => void;
  onOpenMenu: (id: string) => void;
  onJump: (id: string) => void;
  onTogglePicker: (id: string | null) => void;
}

interface Props {
  message: Message;
  showName: boolean;
  isMine: boolean;
  userId: string;
  pending: PendingInfo | undefined;
  reactions: Reaction[];
  quoted: Message | null | undefined;
  canJumpToQuoted: boolean;
  pickerOpen: boolean;
  actions: BubbleActions;
}

export function canRecall(message: Message, now: number) {
  return now - Date.parse(message.createdAt) < RECALL_WINDOW_MS;
}

export function MessageBubble(props: Props) {
  const { message, showName, isMine, userId, pending, reactions, quoted, pickerOpen, actions } = props;
  const recallable = isMine && !pending && canRecall(message, Date.now());
  const now = useNow(1000, recallable);
  const showRecall = isMine && !pending && canRecall(message, now);
  const pressTimer = useRef<number | undefined>(undefined);

  const sending = pending?.status === 'sending';
  const failed = pending?.status === 'failed';
  const time = <span className="msg-time">{sending ? '送出中…' : formatTime(message.createdAt)}</span>;

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || pending) return;
    pressTimer.current = window.setTimeout(() => actions.onOpenMenu(message.id), LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(pressTimer.current);

  const mineEmojis = new Set(reactions.filter((r) => r.userId === userId).map((r) => r.emoji));

  const tools = !pending && (
    <div className={`msg-tools${pickerOpen ? ' msg-tools--open' : ''}`}>
      {pickerOpen && (
        <ReactionPicker
          mine={mineEmojis}
          onPick={(emoji) => actions.onToggleReaction(message.id, emoji)}
          onClose={() => actions.onTogglePicker(null)}
        />
      )}
      <div className="tool-group">
        <button type="button" className="tool-btn" aria-label="回覆" onClick={() => actions.onReply(message.id)}>
          <ReplyIcon size={18} />
        </button>
        <button
          type="button"
          className={`tool-btn${pickerOpen ? ' tool-btn--active' : ''}`}
          aria-label="表情"
          aria-expanded={pickerOpen}
          onClick={() => actions.onTogglePicker(pickerOpen ? null : message.id)}
        >
          <SmileIcon size={18} />
        </button>
        {showRecall && (
          <button type="button" className="tool-btn" aria-label="收回" onClick={() => actions.onRecall(message.id)}>
            <RecallIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      id={`msg-${message.id}`}
      className={[
        'msg',
        isMine ? 'msg--mine' : 'msg--other',
        showName ? 'msg--first' : 'msg--grouped',
        sending ? 'msg--sending' : '',
        failed ? 'msg--failed' : '',
      ].join(' ')}
    >
      {showName && !isMine && <div className="msg-name">{message.nickname}</div>}
      <div className="msg-row">
        {isMine && tools}
        {isMine &&
          (failed ? (
            <div className="msg-failed">
              <span className="failed-chip" role="alert">
                <AlertIcon size={14} />
                傳送失敗
              </span>
              <button type="button" className="small-btn" onClick={() => actions.onRetry(message.id)}>
                重試
              </button>
              <button type="button" className="small-btn" onClick={() => actions.onDiscard(message.id)}>
                刪除
              </button>
            </div>
          ) : (
            time
          ))}
        <div
          className={`bubble${message.image || message.replyTo ? ' bubble--rich' : ''}`}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerMove={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => {
            if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
          }}
        >
          {message.replyTo && (
            <ReplyQuote
              quoted={quoted}
              onJump={props.canJumpToQuoted ? () => actions.onJump(message.replyTo!) : null}
            />
          )}
          {message.image && (
            <button
              type="button"
              className="bubble-image"
              aria-label="放大圖片"
              style={{ aspectRatio: `${message.image.width} / ${message.image.height}` }}
              onClick={() => actions.onOpenImage(message.image!.url)}
              disabled={!!pending}
            >
              <img src={message.image.thumbUrl} alt="聊天室裡的圖片" />
              {sending && pending.progress !== null && (
                <span
                  className="progress"
                  role="progressbar"
                  aria-label="上傳進度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pending.progress}
                >
                  <span className="progress-fill" style={{ width: `${pending.progress}%` }} />
                </span>
              )}
            </button>
          )}
          {message.text && (
            <p className="bubble-text">
              {linkify(message.text).map((seg, i) =>
                seg.type === 'link' ? (
                  <a key={i} href={seg.value} target="_blank" rel="noopener noreferrer">
                    {seg.value}
                  </a>
                ) : (
                  <span key={i}>{seg.value}</span>
                ),
              )}
            </p>
          )}
        </div>
        {!isMine && time}
        {!isMine && tools}
      </div>
      <ReactionBar
        reactions={reactions}
        userId={userId}
        onToggle={(emoji) => actions.onToggleReaction(message.id, emoji)}
      />
    </div>
  );
}
