// 引用區（docs/design.md 3.2）。quoted：undefined = 還在找，null = 找不到了

import type { Message } from '../chat/types';

export function excerpt(message: Message, max = 50): string {
  const text = [...message.text.replace(/\s+/g, ' ').trim()];
  const short = text.length > max ? `${text.slice(0, max).join('')}…` : text.join('');
  return message.image ? `[圖片] ${short}`.trim() : short;
}

interface Props {
  quoted: Message | null | undefined;
  onJump: (() => void) | null;
}

export function ReplyQuote({ quoted, onJump }: Props) {
  if (quoted === undefined) {
    return <div className="quote quote--missing">…</div>;
  }
  if (quoted === null) {
    return <div className="quote quote--missing">原訊息已無法顯示</div>;
  }
  if (quoted.recalledAt) {
    return (
      <button type="button" className="quote quote--recalled" onClick={onJump ?? undefined}>
        此訊息已收回
      </button>
    );
  }
  return (
    <button type="button" className="quote" onClick={onJump ?? undefined}>
      <span className="quote-bar" aria-hidden="true" />
      <span className="quote-body">
        <span className="quote-name">{quoted.nickname}</span>
        <span className="quote-text">{excerpt(quoted)}</span>
      </span>
      {quoted.image && <img className="quote-thumb" src={quoted.image.thumbUrl} alt="" />}
    </button>
  );
}
