// 進入畫面（架構文件 7.1、docs/design.md 4.1）

import { useState } from 'react';
import { AlertIcon } from '../components/Icons';
import { DemoStrip } from '../components/ConnectionBanner';
import { NICKNAME_ERROR_TEXT, NICKNAME_MAX, nicknameLength, validateNickname } from '../lib/nickname';
import { useChatState, useChatStore } from '../state/ChatContext';

export function JoinScreen() {
  const state = useChatState();
  const store = useChatStore();
  const [value, setValue] = useState(state.nickname);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(state.joinError ? state.nickname : null);

  const ruleError = validateNickname(value);
  // 伺服器回來的錯誤只在代號還沒改過時顯示
  const error =
    (submitted === value && state.joinError) || (touched && ruleError ? NICKNAME_ERROR_TEXT[ruleError] : null);

  return (
    <div className="join">
      {store.serviceKind === 'local' && <DemoStrip />}
      <div className="join-shapes" aria-hidden="true">
        <span className="shape shape--circle" />
        <span className="shape shape--square" />
        <span className="shape shape--tile" />
      </div>
      <main className="join-main">
        <div className="join-intro">
          <span className="join-pill">不用註冊・不用登入</span>
          <h1 className="join-title">
            匿名
            <br />
            聊天室
          </h1>
          <p className="join-lead">取一個代號，直接開聊。</p>
        </div>

        <form
          className="join-card"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (ruleError || state.joining) return;
            setSubmitted(value);
            void store.join(value);
          }}
        >
          <label htmlFor="nickname" className="join-label">
            你的代號
          </label>
          <input
            id="nickname"
            className="join-input"
            type="text"
            value={value}
            autoComplete="off"
            enterKeyHint="go"
            aria-invalid={!!error}
            aria-describedby={error ? 'nickname-error' : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setTouched(true);
            }}
          />
          <div className="join-meta">
            <span>1～{NICKNAME_MAX} 個字</span>
            <span className="mono">
              {nicknameLength(value)}/{NICKNAME_MAX}
            </span>
          </div>
          {error && (
            <div id="nickname-error" className="inline-error" role="alert">
              <AlertIcon size={18} />
              {error}
            </div>
          )}
          <button type="submit" className="join-btn" disabled={!!ruleError || state.joining}>
            {state.joining ? '進入中…' : '進入聊天室'}
          </button>
        </form>
      </main>
    </div>
  );
}
