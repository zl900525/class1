// 輸入區（docs/design.md 3.7）

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAX_TEXT_LENGTH } from '../chat/types';
import { useChatState, useChatStore } from '../state/ChatContext';
import { AlertIcon, ClipIcon, CloseIcon, ReplyIcon, SendIcon } from './Icons';
import { excerpt } from './ReplyQuote';

const MAX_LINES = 5;
const COUNTER_FROM = 50;

interface Props {
  file: File | null;
  imageError: string | null;
  onPickFile: (file: File) => void;
  onClearFile: () => void;
}

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

export function Composer({ file, imageError, onPickFile, onClearFile }: Props) {
  const state = useChatState();
  const store = useChatStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const length = [...text].length;
  const remaining = MAX_TEXT_LENGTH - length;
  const online = state.connection === 'online';
  const canSend = online && !busy && remaining >= 0 && (text.trim().length > 0 || !!file);

  const replyTarget = state.replyTo
    ? (state.messages.find((m) => m.id === state.replyTo) ?? state.referenced[state.replyTo] ?? null)
    : null;

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // 輸入框隨內容長高，最多 5 行
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight);
    const extra = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) * 2;
    el.style.height = `${Math.min(el.scrollHeight + parseFloat(style.borderTopWidth) * 2, line * MAX_LINES + extra)}px`;
  }, [text]);

  useEffect(() => {
    if (state.replyTo) textRef.current?.focus();
  }, [state.replyTo]);

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    const ok = await store.send(text, file);
    setBusy(false);
    if (ok) {
      setText('');
      onClearFile();
    }
    textRef.current?.focus();
  };

  return (
    <div className="composer">
      {replyTarget && (
        <div className="reply-bar">
          <ReplyIcon size={16} />
          <span className="reply-bar-text">
            <b>回覆 {replyTarget.nickname}：</b>
            {excerpt(replyTarget)}
          </span>
          <button type="button" className="icon-btn" aria-label="取消回覆" onClick={() => store.setReplyTo(null)}>
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {file && preview && (
        <div className="attach">
          <img className="attach-thumb" src={preview} alt="已選擇的圖片預覽" />
          <span className="attach-name">{file.name}</span>
          <button type="button" className="icon-btn" aria-label="取消這張圖片" onClick={onClearFile}>
            <CloseIcon size={18} />
          </button>
        </div>
      )}

      {imageError && (
        <div className="inline-error" role="alert">
          <AlertIcon size={16} />
          {imageError}
        </div>
      )}

      <form
        className="composer-row"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <button type="button" className="square-btn" aria-label="附加圖片" onClick={() => fileRef.current?.click()}>
          <ClipIcon size={22} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onPickFile(picked);
            e.target.value = '';
          }}
        />
        <label className="composer-field">
          <span className="visually-hidden">訊息</span>
          <textarea
            ref={textRef}
            rows={1}
            value={text}
            placeholder="輸入訊息…"
            className={remaining < 0 ? 'over-limit' : ''}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchDevice()) {
                e.preventDefault();
                void submit();
              }
            }}
            onPaste={(e) => {
              const pasted = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
              if (pasted) {
                e.preventDefault();
                onPickFile(pasted);
              }
            }}
          />
        </label>
        {remaining < 0 && <span className="over-chip">超過 {-remaining} 字</span>}
        <button
          type="submit"
          className="send-btn"
          disabled={!canSend}
          aria-label={online ? '送出' : '送出（連線中斷，暫時無法送出）'}
        >
          <SendIcon size={20} />
          <span className="send-label">送出</span>
        </button>
      </form>

      <div className="composer-foot">
        <span className="composer-hint">Enter 送出・Shift+Enter 換行・可以直接貼上或拖曳圖片</span>
        {remaining >= 0 && remaining < COUNTER_FROM && <span className="counter">剩 {remaining} 字</span>}
      </div>
    </div>
  );
}
