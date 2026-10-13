// 階段一的聊天服務：用 BroadcastChannel 讓同一個瀏覽器的分頁互傳，用 IndexedDB 存歷史訊息。
// 行為盡量模仿階段二的 Supabase：訊息存進「資料庫」後才通知大家，收回有 2 分鐘限制等等。

import type {
  ChatEventName,
  ChatEvents,
  ChatService,
  DebugControls,
  JoinResult,
  RecallResult,
  SendInput,
  SendResult,
} from '../ChatService';
import {
  HISTORY_LIMIT,
  MAX_TEXT_LENGTH,
  RECALL_WINDOW_MS,
  type Emoji,
  type Message,
  type PresenceUser,
  type Reaction,
} from '../types';
import { nicknameKey, normalizeNickname, validateNickname } from '../../lib/nickname';
import * as db from './db';
import { DemoBots, type BotHost } from './demoBots';

type Wire =
  | { t: 'hello'; user: PresenceUser }
  | { t: 'query' }
  | { t: 'bye'; user: PresenceUser }
  | { t: 'msg'; id: string }
  | { t: 'recall'; id: string }
  | { t: 'react'; reaction: Reaction; on: boolean };

const CHANNEL = 'anon-chat-lobby';
const HEARTBEAT_MS = 2000;
const PEER_TIMEOUT_MS = 6000;
const QUERY_WAIT_MS = 500;
const USER_ID_KEY = 'anon-chat.userId';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadUserId(): string {
  try {
    const saved = localStorage.getItem(USER_ID_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export class LocalChatService implements ChatService, BotHost {
  readonly kind = 'local' as const;
  readonly debug: DebugControls;

  private channel = new BroadcastChannel(CHANNEL);
  private handlers = new Map<ChatEventName, Set<(payload: never) => void>>();
  private userId = loadUserId();
  private tabId = crypto.randomUUID();
  private me: PresenceUser | null = null;
  private peers = new Map<string, { user: PresenceUser; lastSeen: number }>();
  private heartbeat: number | undefined;
  private offline = false;
  private failNext = false;
  private slowUpload = false;
  private urlCache = new Map<string, string>();
  private bots: DemoBots | null;

  constructor(options: { demo: boolean }) {
    this.bots = options.demo ? new DemoBots(this) : null;
    this.channel.onmessage = (e: MessageEvent<Wire>) => void this.onWire(e.data);
    window.setInterval(() => this.prunePeers(), HEARTBEAT_MS);
    window.addEventListener('pagehide', () => this.sayBye());
    this.post({ t: 'query' });
    setTimeout(() => this.emit('connection:status', 'online'), 0);

    this.debug = {
      setOffline: (offline) => void this.setOffline(offline),
      failNextSend: () => (this.failNext = true),
      setSlowUpload: (slow) => (this.slowUpload = slow),
    };
  }

  // ---- 事件 ----

  on<K extends ChatEventName>(event: K, handler: (payload: ChatEvents[K]) => void): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (payload: never) => void);
    this.handlers.set(event, set);
    return () => set.delete(handler as (payload: never) => void);
  }

  private emit<K extends ChatEventName>(event: K, payload: ChatEvents[K]) {
    this.handlers.get(event)?.forEach((h) => (h as (p: ChatEvents[K]) => void)(payload));
  }

  private post(wire: Wire) {
    if (!this.offline) this.channel.postMessage(wire);
  }

  // ---- 線上狀態 ----

  private async onWire(wire: Wire) {
    if (this.offline) return;
    switch (wire.t) {
      case 'query':
        if (this.me) this.post({ t: 'hello', user: this.me });
        break;
      case 'hello': {
        if (wire.user.tabId === this.tabId) return;
        const isNew = !this.peers.has(wire.user.tabId);
        this.peers.set(wire.user.tabId, { user: wire.user, lastSeen: Date.now() });
        if (isNew && this.me) {
          this.post({ t: 'hello', user: this.me });
          this.emit('presence:join', wire.user);
          this.checkConflict(wire.user);
        }
        break;
      }
      case 'bye':
        if (this.peers.delete(wire.user.tabId) && this.me) this.emit('presence:leave', wire.user);
        break;
      case 'msg': {
        const stored = await db.getMessage(wire.id);
        if (stored) this.emit('message:new', await this.toMessage(stored));
        break;
      }
      case 'recall':
        this.emit('message:recalled', { messageId: wire.id });
        break;
      case 'react':
        this.emit(wire.on ? 'reaction:added' : 'reaction:removed', wire.reaction);
        break;
    }
  }

  private prunePeers() {
    if (this.offline) return;
    const cutoff = Date.now() - PEER_TIMEOUT_MS;
    for (const [tabId, peer] of this.peers) {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(tabId);
        if (this.me) this.emit('presence:leave', peer.user);
      }
    }
  }

  /** 兩個人同時搶同一個代號：晚到的人被送回進入畫面（架構文件 6.1） */
  private checkConflict(other: PresenceUser) {
    const me = this.me;
    if (!me || other.userId === me.userId) return;
    if (nicknameKey(other.nickname) !== nicknameKey(me.nickname)) return;
    const theyWereFirst =
      other.onlineAt < me.onlineAt || (other.onlineAt === me.onlineAt && other.userId < me.userId);
    if (theyWereFirst) {
      void this.leave();
      this.emit('session:kicked', { reason: 'nickname_taken' });
    }
  }

  private onlineUsers(): PresenceUser[] {
    return [
      ...(this.me ? [this.me] : []),
      ...[...this.peers.values()].map((p) => p.user),
      ...(this.bots?.onlineBots ?? []),
    ];
  }

  private sayBye() {
    if (this.me) this.post({ t: 'bye', user: this.me });
  }

  private startHeartbeat() {
    window.clearInterval(this.heartbeat);
    this.heartbeat = window.setInterval(() => {
      if (this.me) this.post({ t: 'hello', user: this.me });
    }, HEARTBEAT_MS);
  }

  // ---- 介面方法 ----

  async getUserId() {
    return this.userId;
  }

  async join(raw: string): Promise<JoinResult> {
    if (validateNickname(raw)) return { ok: false, reason: 'invalid' };
    if (this.offline) return { ok: false, reason: 'network' };

    this.post({ t: 'query' });
    await delay(QUERY_WAIT_MS);

    const key = nicknameKey(raw);
    const taken = this.onlineUsers().some(
      (u) => u.userId !== this.userId && nicknameKey(u.nickname) === key,
    );
    if (taken) return { ok: false, reason: 'nickname_taken' };

    this.me = {
      userId: this.userId,
      tabId: this.tabId,
      nickname: normalizeNickname(raw),
      onlineAt: new Date().toISOString(),
    };
    this.post({ t: 'hello', user: this.me });
    this.startHeartbeat();
    this.emit('presence:sync', this.onlineUsers());
    this.bots?.start();
    return { ok: true };
  }

  async leave() {
    this.sayBye();
    window.clearInterval(this.heartbeat);
    this.me = null;
    this.bots?.stop();
  }

  async loadRecent() {
    if (this.offline) throw new Error('offline');
    const stored = await db.getRecentMessages(HISTORY_LIMIT);
    const messages = await Promise.all(stored.map((m) => this.toMessage(m)));
    const reactions = await db.getReactionsFor(messages.map((m) => m.id));
    return { messages, reactions };
  }

  async fetchMessages(ids: string[]) {
    const found = await Promise.all(ids.map((id) => db.getMessage(id)));
    return Promise.all(found.filter((m): m is db.StoredMessage => !!m).map((m) => this.toMessage(m)));
  }

  async sendMessage(input: SendInput, onProgress?: (percent: number) => void): Promise<SendResult> {
    if (this.offline) {
      await delay(600);
      return { ok: false };
    }
    if (this.failNext) {
      this.failNext = false;
      await delay(800);
      return { ok: false };
    }
    // 伺服器端檢查（模擬資料庫規則）
    const text = input.text;
    if ([...text].length > MAX_TEXT_LENGTH) return { ok: false };
    if (!text.trim() && !input.image) return { ok: false };
    if (await db.getMessage(input.id)) return { ok: true }; // 重試時已經寫進去了，不重複

    let image: db.StoredMessage['image'] = null;
    if (input.image) {
      const steps = this.slowUpload ? 30 : 6;
      for (let i = 1; i <= steps; i++) {
        await delay(this.slowUpload ? 200 : 60);
        if (this.offline) return { ok: false };
        onProgress?.(Math.round((i / steps) * 100));
      }
      image = {
        fullKey: `${input.id}-full`,
        thumbKey: `${input.id}-thumb`,
        width: input.image.width,
        height: input.image.height,
      };
      await db.putBlob(image.fullKey, input.image.full);
      await db.putBlob(image.thumbKey, input.image.thumb);
    }

    const stored: db.StoredMessage = {
      id: input.id,
      senderId: this.userId,
      nickname: input.nickname,
      text,
      image,
      replyTo: input.replyTo,
      createdAt: new Date().toISOString(),
      recalledAt: null,
    };
    await db.putMessage(stored);
    this.post({ t: 'msg', id: stored.id });
    this.emit('message:new', await this.toMessage(stored));
    void db.pruneOldMessages();
    return { ok: true };
  }

  async recall(messageId: string): Promise<RecallResult> {
    if (this.offline) return { ok: false, reason: 'network' };
    const stored = await db.getMessage(messageId);
    if (!stored || stored.senderId !== this.userId) return { ok: false, reason: 'not_owner' };
    if (Date.now() - Date.parse(stored.createdAt) > RECALL_WINDOW_MS) {
      return { ok: false, reason: 'too_late' };
    }
    if (stored.image) await db.deleteBlobs([stored.image.fullKey, stored.image.thumbKey]);
    await db.deleteReactionsFor(messageId);
    await db.putMessage({ ...stored, text: '', image: null, recalledAt: new Date().toISOString() });
    this.post({ t: 'recall', id: messageId });
    this.emit('message:recalled', { messageId });
    return { ok: true };
  }

  async toggleReaction(messageId: string, emoji: Emoji, nickname: string) {
    if (this.offline) return { ok: false };
    const reaction: Reaction = { messageId, userId: this.userId, nickname, emoji };
    const on = !(await db.hasReaction(reaction));
    if (on) await db.putReaction(reaction);
    else await db.deleteReaction(reaction);
    this.post({ t: 'react', reaction, on });
    this.emit(on ? 'reaction:added' : 'reaction:removed', reaction);
    return { ok: true };
  }

  // ---- 模擬使用者（?demo=1） ----

  botJoin(user: PresenceUser) {
    if (this.me && !this.offline) this.emit('presence:join', user);
  }

  botLeave(user: PresenceUser) {
    if (this.me && !this.offline) this.emit('presence:leave', user);
  }

  botSay(user: PresenceUser, text: string) {
    const stored: db.StoredMessage = {
      id: crypto.randomUUID(),
      senderId: user.userId,
      nickname: user.nickname,
      text,
      image: null,
      replyTo: null,
      createdAt: new Date().toISOString(),
      recalledAt: null,
    };
    void db.putMessage(stored).then(async () => {
      if (this.offline) return; // 斷線中收不到，重連後補上
      this.emit('message:new', await this.toMessage(stored));
    });
  }

  botReact(user: PresenceUser, emoji: Emoji) {
    void (async () => {
      const [latest] = await db.getRecentMessages(1);
      if (!latest || latest.recalledAt) return;
      const reaction: Reaction = { messageId: latest.id, userId: user.userId, nickname: user.nickname, emoji };
      if (await db.hasReaction(reaction)) return;
      await db.putReaction(reaction);
      if (!this.offline) this.emit('reaction:added', reaction);
    })();
  }

  // ---- 模擬斷線（?debug=1） ----

  private async setOffline(offline: boolean) {
    if (offline === this.offline) return;
    if (offline) {
      this.offline = true;
      this.emit('connection:status', 'reconnecting');
      return;
    }
    this.offline = false;
    this.emit('connection:status', 'connecting');
    const now = Date.now();
    this.peers.forEach((p) => (p.lastSeen = now));
    this.post({ t: 'query' });
    if (this.me) this.post({ t: 'hello', user: this.me });
    await delay(QUERY_WAIT_MS);
    if (this.me) this.emit('presence:sync', this.onlineUsers());
    this.emit('connection:status', 'online');
  }

  // ---- 工具 ----

  private async blobUrl(key: string): Promise<string> {
    const cached = this.urlCache.get(key);
    if (cached) return cached;
    const blob = await db.getBlob(key);
    const url = blob ? URL.createObjectURL(blob) : '';
    if (url) this.urlCache.set(key, url);
    return url;
  }

  private async toMessage(stored: db.StoredMessage): Promise<Message> {
    const { image, ...rest } = stored;
    if (!image) return { ...rest, image: null };
    const [url, thumbUrl] = await Promise.all([this.blobUrl(image.fullKey), this.blobUrl(image.thumbKey)]);
    return { ...rest, image: { url, thumbUrl, width: image.width, height: image.height } };
  }
}
