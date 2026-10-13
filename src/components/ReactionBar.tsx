// 表情標籤（docs/design.md 3.3）：點了等於自己也按；滑鼠移上去或手機長按看誰按的

import { useRef, useState } from 'react';
import { EMOJIS, type Emoji, type Reaction } from '../chat/types';

interface Props {
  reactions: Reaction[];
  userId: string;
  onToggle: (emoji: Emoji) => void;
}

export function ReactionBar({ reactions, userId, onToggle }: Props) {
  const groups = EMOJIS.map((emoji) => {
    const list = reactions.filter((r) => r.emoji === emoji);
    return { emoji, list, mine: list.some((r) => r.userId === userId) };
  }).filter((g) => g.list.length > 0);

  if (groups.length === 0) return null;
  return (
    <div className="reactions">
      {groups.map((g) => (
        <ReactionTag key={g.emoji} {...g} onToggle={() => onToggle(g.emoji)} />
      ))}
    </div>
  );
}

function ReactionTag({
  emoji,
  list,
  mine,
  onToggle,
}: {
  emoji: Emoji;
  list: Reaction[];
  mine: boolean;
  onToggle: () => void;
}) {
  const [showWho, setShowWho] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const names = list.map((r) => r.nickname).join('、');

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setShowWho(true);
      window.setTimeout(() => setShowWho(false), 2500);
    }, 500);
  };
  const cancelPress = () => window.clearTimeout(timer.current);

  return (
    <span className="reaction-wrap">
      <button
        type="button"
        className={`reaction${mine ? ' reaction--mine' : ''}`}
        aria-pressed={mine}
        aria-label={`${emoji} ${list.length} 人${mine ? '，包含你' : ''}：${names}`}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onToggle();
        }}
      >
        {emoji} {list.length}
      </button>
      <span className={`tooltip${showWho ? ' tooltip--show' : ''}`} role="tooltip">
        {emoji} {names}
      </span>
    </span>
  );
}
