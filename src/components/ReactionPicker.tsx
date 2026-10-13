// 電腦版的表情選擇小框（docs/design.md 3.5）

import { useEffect, useRef } from 'react';
import { EMOJIS, type Emoji } from '../chat/types';

interface Props {
  mine: Set<Emoji>;
  onPick: (emoji: Emoji) => void;
  onClose: () => void;
}

export function ReactionPicker({ mine, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="picker" role="dialog" aria-label="選擇表情" ref={ref}>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={`picker-btn${mine.has(emoji) ? ' picker-btn--mine' : ''}`}
          aria-label={`${mine.has(emoji) ? '取消' : '按'} ${emoji}`}
          onClick={() => {
            onPick(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
