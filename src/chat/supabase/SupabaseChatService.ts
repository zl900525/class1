// 階段二的聊天服務：實作跟本機版同一份介面（架構文件 5.4）
// - 匿名身分：Supabase Auth 的匿名登入
// - 訊息、表情：資料庫，新增／收回／表情變動透過 Realtime 的 Postgres Changes 推送
// - 線上名單：Realtime 頻道 room:lobby 的 Presence
// - 圖片：Storage 的 chat-images 倉庫

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ChatEventName,
  ChatEvents,
  ChatService,
  JoinResult,
  RecallResult,
  SendInput,
  SendResult,
} from '../ChatService';
import {
  HISTORY_LIMIT,
  type ConnectionStatus,
  type Emoji,
  type Message,
  type PresenceUser,
  type Reaction,
} from '../types';
import { nicknameKey, normalizeNickname, validateNickname } from '../../lib/nickname';

const CHANNEL = 'room:lobby';
const BUCKET = 'chat-images';
const FIRST_SYNC_WAIT_MS = 1500;
const SIGN_IN_RETRY_MS = 3000;

interface MessageRow {
  id: string;
  sender_id: string;
  nickname: string;
  text: string;
  image_path: string | null;
  thumb_path: string | null;
  image_width: number | null;
  image_height: number | null;
  reply_to: string | null;
  created_at: string;
  recalled_at: string | null;
}

interface ReactionRow {
  message_id: string;
  user_id: string;
  nickname?: string;
  emoji: Emoji;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SupabaseChatService implements ChatService {
  readonly kind = 'supabase' as const;

  private client: SupabaseClient;
  private handlers = new Map<ChatEventName, Set<(payload: never) => void>>();
  private userIdPromise: Promise<string>;
  private tabId = crypto.randomUUID();
  private channel: RealtimeChannel | null = null;
  private me: PresenceUser | null = null;
  private known = new Map<string, PresenceUser>();
  private status: ConnectionStatus = 'connecting';
  private onSync: (() => void) | null = null;

  constructor(
    private url: string,
    private key: string,
  ) {
    this.client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    this.userIdPromise = this.signIn();
    window.addEventListener('offline', () => this.setStatus('reconnecting'));
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

  private setStatus(status: ConnectionStatus) {
    if (!this.me || status === this.status) return;
    this.status = status;
    this.emit('connection:status', status);
  }

  // ---- 匿名身分 ----

  /** 這個瀏覽器已經有身分就沿用，沒有就匿名登入；失敗會一直重試 */
  private async signIn(): Promise<string> {
    for (;;) {
      try {
        const { data } = await this.client.auth.getSession();
        if (data.session) return data.session.user.id;
        const { data: created, error } = await this.client.auth.signInAnonymously();
        if (created.user) return created.user.id;
        console.error('匿名登入失敗', error);
      } catch (error) {
        console.error('匿名登入失敗', error);
      }
      await delay(SIGN_IN_RETRY_MS);
    }
  }

  getUserId() {
    return this.userIdPromise;
  }

  // ---- 進入、離開、線上名單 ----

  async join(raw: string): Promise<JoinResult> {
    if (validateNickname(raw)) return { ok: false, reason: 'invalid' };
    const userId = await this.userIdPromise;

    const channel = this.client.channel(CHANNEL, { config: { presence: { key: this.tabId } } });
    this.channel = channel;
    this.listen(channel);

    const firstSync = new Promise<void>((resolve) => {
      this.onSync = resolve;
      setTimeout(resolve, FIRST_SYNC_WAIT_MS);
    });
    const subscribed = await new Promise<boolean>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve(true);
          void this.onResubscribed();
        } else {
          resolve(false);
          this.setStatus('reconnecting');
        }
      });
    });
    if (!subscribed) {
      await this.dropChannel();
      return { ok: false, reason: 'network' };
    }
    await firstSync;

    const key = nicknameKey(raw);
    const others = this.presenceList();
    if (others.some((u) => u.userId !== userId && nicknameKey(u.nickname) === key)) {
      await this.dropChannel();
      return { ok: false, reason: 'nickname_taken' };
    }

    this.me = { userId, tabId: this.tabId, nickname: normalizeNickname(raw), onlineAt: new Date().toISOString() };
    await channel.track(this.me);
    const list = [...others.filter((u) => u.tabId !== this.tabId), this.me];
    this.known = new Map(list.map((u) => [u.tabId, u]));
    this.status = 'online';
    this.emit('presence:sync', list);
    this.emit('connection:status', 'online');
    return { ok: true };
  }

  async leave() {
    this.me = null;
    this.status = 'connecting';
    await this.dropChannel();
  }

  private async dropChannel() {
    const channel = this.channel;
    this.channel = null;
    this.known.clear();
    if (!channel) return;
    try {
      await channel.untrack();
    } catch {
      // 已經斷線就不用取消登記
    }
    await this.client.removeChannel(channel);
  }

  private listen(channel: RealtimeChannel) {
    channel
      .on('presence', { event: 'sync' }, () => {
        this.onSync?.();
        this.onSync = null;
        this.diffPresence();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if (this.me) this.emit('message:new', this.toMessage(p.new as MessageRow));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const row = p.new as MessageRow;
        if (this.me && row.recalled_at) this.emit('message:recalled', { messageId: row.id });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (p) => {
        if (this.me) this.emit('reaction:added', this.toReaction(p.new as ReactionRow));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (p) => {
        // 刪除通知只帶主鍵（訊息、人、表情），沒有代號
        if (this.me) this.emit('reaction:removed', this.toReaction(p.old as ReactionRow));
      });
  }

  private presenceList(): PresenceUser[] {
    const state = this.channel?.presenceState<PresenceUser>() ?? {};
    return Object.values(state).flatMap((metas) => {
      const meta = metas[0];
      return meta ? [{ userId: meta.userId, tabId: meta.tabId, nickname: meta.nickname, onlineAt: meta.onlineAt }] : [];
    });
  }

  /** 每次名單同步就跟上一次比對，產生「誰上線、誰離開」（10 秒緩衝在狀態管理裡處理） */
  private diffPresence() {
    if (!this.me) return;
    const current = new Map(this.presenceList().map((u) => [u.tabId, u]));
    current.set(this.me.tabId, this.me);
    for (const [tabId, user] of this.known) {
      if (!current.has(tabId)) this.emit('presence:leave', user);
    }
    for (const [tabId, user] of current) {
      if (!this.known.has(tabId)) {
        this.emit('presence:join', user);
        this.checkConflict(user);
      }
    }
    this.known = current;
  }

  /** 兩個人同時搶同一個代號：晚到的人被送回進入畫面（架構文件 6.1） */
  private checkConflict(other: PresenceUser) {
    const me = this.me;
    if (!me || other.userId === me.userId || nicknameKey(other.nickname) !== nicknameKey(me.nickname)) return;
    const theyWereFirst =
      other.onlineAt < me.onlineAt || (other.onlineAt === me.onlineAt && other.userId < me.userId);
    if (theyWereFirst) {
      void this.leave();
      this.emit('session:kicked', { reason: 'nickname_taken' });
    }
  }

  /** 斷線後重新連上：檢查代號有沒有被拿走，重新登記上線（架構文件 6.4） */
  private async onResubscribed() {
    const me = this.me;
    if (!me || this.status === 'online' || !this.channel) return;
    await new Promise<void>((resolve) => {
      this.onSync = resolve;
      setTimeout(resolve, FIRST_SYNC_WAIT_MS);
    });
    const takenByOther = this.presenceList().some(
      (u) => u.userId !== me.userId && nicknameKey(u.nickname) === nicknameKey(me.nickname),
    );
    if (takenByOther) {
      await this.leave();
      this.emit('session:kicked', { reason: 'nickname_taken' });
      return;
    }
    await this.channel.track(me);
    this.emit('presence:sync', [...this.presenceList().filter((u) => u.tabId !== me.tabId), me]);
    this.setStatus('online');
  }

  // ---- 訊息 ----

  async loadRecent() {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (error) throw error;
    const messages = (data as MessageRow[]).reverse().map((row) => this.toMessage(row));
    if (messages.length === 0) return { messages, reactions: [] };

    const { data: reactionRows, error: reactionError } = await this.client
      .from('reactions')
      .select('message_id, user_id, nickname, emoji')
      .in('message_id', messages.map((m) => m.id));
    if (reactionError) throw reactionError;
    return { messages, reactions: (reactionRows as ReactionRow[]).map((r) => this.toReaction(r)) };
  }

  async fetchMessages(ids: string[]) {
    const { data, error } = await this.client.from('messages').select('*').in('id', ids);
    if (error) throw error;
    return (data as MessageRow[]).map((row) => this.toMessage(row));
  }

  async sendMessage(input: SendInput, onProgress?: (percent: number) => void): Promise<SendResult> {
    try {
      const userId = await this.userIdPromise;
      let image: Pick<MessageRow, 'image_path' | 'thumb_path' | 'image_width' | 'image_height'> = {
        image_path: null,
        thumb_path: null,
        image_width: null,
        image_height: null,
      };

      if (input.image) {
        const ext = EXTENSIONS[input.image.full.type] ?? 'jpg';
        const fullPath = `${userId}/${input.id}.${ext}`;
        const sameFile = input.image.thumb === input.image.full; // GIF 不另做縮圖
        const thumbPath = sameFile ? fullPath : `${userId}/${input.id}_thumb.${ext}`;
        const total = input.image.full.size + (sameFile ? 0 : input.image.thumb.size);

        await this.upload(fullPath, input.image.full, (sent) => onProgress?.(Math.round((sent / total) * 100)));
        if (!sameFile) {
          await this.upload(thumbPath, input.image.thumb, (sent) =>
            onProgress?.(Math.round(((input.image!.full.size + sent) / total) * 100)),
          );
        }
        image = {
          image_path: fullPath,
          thumb_path: thumbPath,
          image_width: input.image.width,
          image_height: input.image.height,
        };
      }

      const { error } = await this.client.from('messages').insert({
        id: input.id,
        nickname: input.nickname,
        text: input.text,
        reply_to: input.replyTo,
        ...image,
      });
      // 23505 = 這個 id 已經存在：上次其實送成功了，重試時不重複
      if (error && error.code !== '23505') return { ok: false };
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  /** 直接呼叫 Storage 的上傳網址，才拿得到上傳進度 */
  private async upload(path: string, blob: Blob, onProgress: (sentBytes: number) => void): Promise<void> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('no session');

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.url}/storage/v1/object/${BUCKET}/${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', this.key);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
      xhr.onerror = () => reject(new Error('upload failed'));
      xhr.send(blob);
    });
  }

  async recall(messageId: string): Promise<RecallResult> {
    const { data: row } = await this.client
      .from('messages')
      .select('image_path, thumb_path')
      .eq('id', messageId)
      .maybeSingle();

    const { data, error } = await this.client.rpc('recall_message', { p_id: messageId });
    if (error) return { ok: false, reason: 'network' };
    if (data === 'too_late' || data === 'not_owner') return { ok: false, reason: data };

    // 收回成功後刪掉圖片檔；失敗也沒關係，每天的清理會再處理
    const paths = [...new Set([row?.image_path, row?.thumb_path].filter((p): p is string => !!p))];
    if (paths.length) void this.client.storage.from(BUCKET).remove(paths);
    return { ok: true };
  }

  async toggleReaction(messageId: string, emoji: Emoji, nickname: string) {
    const userId = await this.userIdPromise;
    const { error } = await this.client.from('reactions').insert({ message_id: messageId, emoji, nickname });
    if (!error) return { ok: true };
    if (error.code !== '23505') return { ok: false };
    // 已經按過了 → 這次是取消
    const { error: deleteError } = await this.client
      .from('reactions')
      .delete()
      .match({ message_id: messageId, user_id: userId, emoji });
    return { ok: !deleteError };
  }

  // ---- 資料轉換 ----

  private publicUrl(path: string) {
    return this.client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  private toMessage(row: MessageRow): Message {
    return {
      id: row.id,
      senderId: row.sender_id,
      nickname: row.nickname,
      text: row.text,
      image:
        row.image_path && row.thumb_path
          ? {
              url: this.publicUrl(row.image_path),
              thumbUrl: this.publicUrl(row.thumb_path),
              width: row.image_width ?? 4,
              height: row.image_height ?? 3,
            }
          : null,
      replyTo: row.reply_to,
      createdAt: row.created_at,
      recalledAt: row.recalled_at,
    };
  }

  private toReaction(row: ReactionRow): Reaction {
    return { messageId: row.message_id, userId: row.user_id, nickname: row.nickname ?? '', emoji: row.emoji };
  }
}
