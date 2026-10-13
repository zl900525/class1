// 線上名單：電腦版在右側固定一欄，手機版從頂端展開（docs/design.md 4.2、4.3）

import type { OnlineUser } from '../state/ChatContext';

export function OnlineList({ users, variant }: { users: OnlineUser[]; variant: 'sidebar' | 'sheet' }) {
  return (
    <section className={`online online--${variant}`} aria-label="線上名單">
      <h2 className="online-title">線上 {users.length} 人</h2>
      <ul className="online-list">
        {users.map((u) => (
          <li key={u.key} className={u.isMe ? 'online-me' : ''}>
            <span className="online-dot" aria-hidden="true" />
            <span>{u.nickname}</span>
            {u.isMe && <span className="online-you">（你）</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
