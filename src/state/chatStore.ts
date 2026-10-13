// 聊天狀態管理（架構文件 4.1）：所有「使用者看得到的規則」都在這裡，兩個階段共用。
// 畫面元件只透過這裡拿資料、做動作，不直接碰聊天服務。

import type { ChatService } from '../chat/ChatService';
import type { ConnectionStatus, Emoji, Message, PreparedImage, Reaction } from '../chat/types';
import { type Notice } from '../lib/grouping';
import { IMAGE_ERROR_TEXT, prepareImage } from '../lib/imageCompress';
import { NICKNAME_ERROR_TEXT, normalizeNickname, validateNickname } from '../lib/nickname';
import { type OnlineUser, PresenceTracker } from './presenceTracker';

const NICKNAME_KEY = 'anon-chat.nickname';
const BANNER_DELAY_MS = 2000;
const TOAST_MS = 3000;

interface Draft {
  id: string;
  text: string;
  image: PreparedImage | null;
  replyTo: string | null;
}

export interface PendingInfo {
  status: 'sending' | 'failed';
  progress: number | null;
  draft: Draft;
}

export interface ChatState {
  screen: 'loading' | 'join' | 'chat';
  userId: string;
  nickname: string;
  joining: boolean;
  joinError: string | null;
  messages: Message[];
  pending: Record<string, PendingInfo>;
  reactions: Record<string, Reaction[]>;
  /** 被回覆、但不在最近 50 則裡的原訊息；null = 已經找不到 */
  referenced: Record<string, Message | null>;
  notices: Notice[];
  online: OnlineUser[];
  connection: ConnectionStatus;
  bannerVisible: boolean;
  unread: number;
  toast: string | null;
  replyTo: string | null;
}

const initialState: ChatState = {
  screen: 'loading',
  userId: '',
  nickname: '',
  joining: false,
  joinError: null,
  messages: [],
  pending: {},
  reactions: {},
  referenced: {},
  notices: [],
  online: [],
  connection: 'connecting',
  bannerVisible: false,
  unread: 0,
  toast: null,
  replyTo: null,
};

const byTime = (a: Message, b: Message) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const sameReaction = (a: Reaction, b: Reaction) =>
  a.messageId === b.messageId && a.userId === b.userId && a.emoji === b.emoji;

function readSavedNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export class ChatStore {
  private state: ChatState = initialState;
  private listeners = new Set<() => void>();
  private tracker: PresenceTracker;
  private expectInitialSync = false;
  private bannerTimer: number | undefined;
  private toastTimer: number | undefined;
  private fetching = new Set<string>();

  constructor(private service: ChatService) {
    this.tracker = new PresenceTracker(
      () => this.set({ online: this.tracker.list() }),
      (kind, nickname) =>
        this.set({
          notices: [
            ...this.state.notices,
            { id: crypto.randomUUID(), kind, nickname, at: new Date().toISOString() },
          ],
        }),
    );

    service.on('message:new', (m) => this.onMessage(m));
    service.on('message:recalled', ({ messageId }) => this.onRecalled(messageId));
    service.on('reaction:added', (r) => this.addReaction(r));
    service.on('reaction:removed', (r) => this.removeReaction(r));
    service.on('presence:sync', (list) => {
      this.tracker.sync(list, this.expectInitialSync);
      this.expectInitialSync = false;
    });
    service.on('presence:join', (u) => this.tracker.join(u));
    service.on('presence:leave', (u) => this.tracker.leave(u));
    service.on('connection:status', (s) => this.onConnection(s));
    service.on('session:kicked', () => {
      this.resetChat();
      this.set({ screen: 'join', joinError: NICKNAME_ERROR_TEXT.taken });
    });

    void service.getUserId().then((userId) =>
      this.set({ userId, nickname: readSavedNickname(), screen: 'join' }),
    );
  }

  // ---- 給 React 用 ----

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  get serviceKind() {
    return this.service.kind;
  }

  get debug() {
    return this.service.debug;
  }

  private set(patch: Partial<ChatState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---- 進入、離開 ----

  async join(raw: string) {
    const error = validateNickname(raw);
    if (error) return this.set({ joinError: NICKNAME_ERROR_TEXT[error] });

    const nickname = normalizeNickname(raw);
    this.set({ joining: true, joinError: null, nickname });
    this.tracker.reset(this.state.userId);
    this.expectInitialSync = true;

    const result = await this.service.join(nickname).catch(() => ({ ok: false as const, reason: 'network' as const }));
    if (!result.ok) {
      this.expectInitialSync = false;
      const text = result.reason === 'nickname_taken' ? NICKNAME_ERROR_TEXT.taken
        : result.reason === 'invalid' ? NICKNAME_ERROR_TEXT.reserved
        : NICKNAME_ERROR_TEXT.network;
      return this.set({ joining: false, joinError: text });
    }

    try {
      localStorage.setItem(NICKNAME_KEY, nickname);
    } catch {
      // 存不了也沒關係，下次重打就好
    }
    this.set({ joining: false, screen: 'chat' });
    await this.reloadRecent();
  }

  async leave() {
    await this.service.leave();
    this.resetChat();
    this.set({ screen: 'join', joinError: null });
  }

  private resetChat() {
    this.tracker.reset(this.state.userId);
    this.set({
      messages: [],
      pending: {},
      reactions: {},
      referenced: {},
      notices: [],
      online: [],
      replyTo: null,
      unread: 0,
    });
  }

  /** 讀取最近 50 則並跟畫面上的合併（進入時、重連後） */
  private async reloadRecent() {
    try {
      const { messages, reactions } = await this.service.loadRecent();
      const loaded = new Set(messages.map((m) => m.id));
      const unsent = this.state.messages.filter((m) => this.state.pending[m.id] && !loaded.has(m.id));
      const reactionMap: Record<string, Reaction[]> = {};
      for (const r of reactions) (reactionMap[r.messageId] ??= []).push(r);
      this.set({ messages: [...messages, ...unsent].sort(byTime), reactions: reactionMap });
    } catch {
      this.showToast('讀取訊息失敗，請重新整理');
    }
  }

  // ---- 送出 ----

  setReplyTo(messageId: string | null) {
    this.set({ replyTo: messageId });
  }

  /** 回傳 true 代表已經送出（或已經放上畫面等待送出），輸入框可以清空 */
  async send(text: string, file: File | null): Promise<boolean> {
    if (this.state.connection !== 'online') return false;
    let image: PreparedImage | null = null;
    if (file) {
      try {
        image = await prepareImage(file);
      } catch {
        this.showToast(IMAGE_ERROR_TEXT.broken);
        return false;
      }
    }

    const draft: Draft = { id: crypto.randomUUID(), text, image, replyTo: this.state.replyTo };
    const optimistic: Message = {
      id: draft.id,
      senderId: this.state.userId,
      nickname: this.state.nickname,
      text,
      image: image && {
        url: URL.createObjectURL(image.full),
        thumbUrl: URL.createObjectURL(image.thumb),
        width: image.width,
        height: image.height,
      },
      replyTo: draft.replyTo,
      createdAt: new Date().toISOString(),
      recalledAt: null,
    };
    this.set({
      messages: [...this.state.messages, optimistic].sort(byTime),
      pending: { ...this.state.pending, [draft.id]: { status: 'sending', progress: image ? 0 : null, draft } },
      replyTo: null,
    });
    void this.deliver(draft);
    return true;
  }

  retry(id: string) {
    const info = this.state.pending[id];
    if (!info || info.status !== 'failed') return;
    this.patchPending(id, { status: 'sending', progress: info.draft.image ? 0 : null });
    void this.deliver(info.draft);
  }

  discard(id: string) {
    const { [id]: _removed, ...pending } = this.state.pending;
    this.set({ pending, messages: this.state.messages.filter((m) => m.id !== id) });
  }

  private async deliver(draft: Draft) {
    const result = await this.service
      .sendMessage(
        { ...draft, nickname: this.state.nickname },
        (progress) => this.patchPending(draft.id, { progress }),
      )
      .catch(() => ({ ok: false }));
    if (!this.state.pending[draft.id]) return; // 已經收到伺服器的確認
    if (result.ok) {
      const { [draft.id]: _done, ...pending } = this.state.pending;
      this.set({ pending });
    } else {
      this.patchPending(draft.id, { status: 'failed', progress: null });
    }
  }

  private patchPending(id: string, patch: Partial<PendingInfo>) {
    const info = this.state.pending[id];
    if (info) this.set({ pending: { ...this.state.pending, [id]: { ...info, ...patch } } });
  }

  // ---- 收回、表情 ----

  async recall(messageId: string) {
    const result = await this.service.recall(messageId).catch(() => ({ ok: false as const, reason: 'network' as const }));
    if (!result.ok) {
      this.showToast(result.reason === 'too_late' ? '已超過可收回的時間' : '操作失敗');
    }
  }

  async toggleReaction(messageId: string, emoji: Emoji) {
    const mine: Reaction = { messageId, userId: this.state.userId, nickname: this.state.nickname, emoji };
    const had = (this.state.reactions[messageId] ?? []).some((r) => sameReaction(r, mine));
    // 畫面先更新，失敗再改回來
    if (had) this.removeReaction(mine);
    else this.addReaction(mine);
    const result = await this.service.toggleReaction(messageId, emoji, this.state.nickname).catch(() => ({ ok: false }));
    if (!result.ok) {
      if (had) this.addReaction(mine);
      else this.removeReaction(mine);
      this.showToast('操作失敗');
    }
  }

  // ---- 被回覆的原訊息 ----

  ensureReferenced(ids: string[]) {
    const known = new Set(this.state.messages.map((m) => m.id));
    const missing = ids.filter((id) => !known.has(id) && !(id in this.state.referenced) && !this.fetching.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => this.fetching.add(id));
    void this.service
      .fetchMessages(missing)
      .then((found) => {
        const referenced = { ...this.state.referenced };
        for (const id of missing) referenced[id] = found.find((m) => m.id === id) ?? null;
        this.set({ referenced });
      })
      .catch(() => {})
      .finally(() => missing.forEach((id) => this.fetching.delete(id)));
  }

  // ---- 其他 ----

  clearUnread() {
    if (this.state.unread) this.set({ unread: 0 });
  }

  showToast(text: string) {
    window.clearTimeout(this.toastTimer);
    this.set({ toast: text });
    this.toastTimer = window.setTimeout(() => this.set({ toast: null }), TOAST_MS);
  }

  // ---- 聊天服務的事件 ----

  private onMessage(message: Message) {
    if (this.state.screen !== 'chat') return;
    const exists = this.state.messages.some((m) => m.id === message.id);
    const fromOther = message.senderId !== this.state.userId;
    const { [message.id]: _confirmed, ...pending } = this.state.pending;
    this.set({
      messages: exists
        ? this.state.messages.map((m) => (m.id === message.id ? message : m))
        : [...this.state.messages, message].sort(byTime),
      pending,
      unread: !exists && fromOther && document.hidden ? this.state.unread + 1 : this.state.unread,
    });
  }

  private onRecalled(messageId: string) {
    const recall = (m: Message): Message => ({ ...m, text: '', image: null, recalledAt: new Date().toISOString() });
    const { [messageId]: _gone, ...reactions } = this.state.reactions;
    const referenced = this.state.referenced[messageId]
      ? { ...this.state.referenced, [messageId]: recall(this.state.referenced[messageId]!) }
      : this.state.referenced;
    this.set({
      messages: this.state.messages.map((m) => (m.id === messageId && !m.recalledAt ? recall(m) : m)),
      reactions,
      referenced,
      replyTo: this.state.replyTo === messageId ? null : this.state.replyTo,
    });
  }

  private addReaction(r: Reaction) {
    const list = this.state.reactions[r.messageId] ?? [];
    if (list.some((x) => sameReaction(x, r))) return;
    this.set({ reactions: { ...this.state.reactions, [r.messageId]: [...list, r] } });
  }

  private removeReaction(r: Reaction) {
    const list = this.state.reactions[r.messageId] ?? [];
    if (!list.some((x) => sameReaction(x, r))) return;
    this.set({ reactions: { ...this.state.reactions, [r.messageId]: list.filter((x) => !sameReaction(x, r)) } });
  }

  private onConnection(status: ConnectionStatus) {
    const previous = this.state.connection;
    window.clearTimeout(this.bannerTimer);
    if (status === 'reconnecting') {
      this.bannerTimer = window.setTimeout(() => this.set({ bannerVisible: true }), BANNER_DELAY_MS);
      this.set({ connection: status });
      return;
    }
    this.set({ connection: status, bannerVisible: status === 'connecting' && this.state.bannerVisible });
    if (status === 'online' && previous !== 'online' && this.state.screen === 'chat') {
      void this.reloadRecent();
    }
  }
}
