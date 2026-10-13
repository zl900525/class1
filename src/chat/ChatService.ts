// 架構文件第 5.2、5.3 節的介面約定。
// 畫面只透過 src/state 使用這個介面；階段二只要再寫一個 SupabaseChatService 實作它。

import type {
  ConnectionStatus,
  Emoji,
  Message,
  PreparedImage,
  PresenceUser,
  Reaction,
} from './types';

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: 'nickname_taken' | 'invalid' | 'network' };

export type SendResult = { ok: true } | { ok: false };

export type RecallResult =
  | { ok: true }
  | { ok: false; reason: 'too_late' | 'not_owner' | 'network' };

export interface SendInput {
  id: string;
  nickname: string;
  text: string;
  image: PreparedImage | null;
  replyTo: string | null;
}

export interface ChatEvents {
  'message:new': Message;
  'message:recalled': { messageId: string };
  'reaction:added': Reaction;
  'reaction:removed': Reaction;
  'presence:sync': PresenceUser[];
  'presence:join': PresenceUser;
  'presence:leave': PresenceUser;
  'connection:status': ConnectionStatus;
  'session:kicked': { reason: 'nickname_taken' };
}

export type ChatEventName = keyof ChatEvents;

/** 只有本機版有的測試開關（?debug=1 的測試面板用） */
export interface DebugControls {
  setOffline(offline: boolean): void;
  failNextSend(): void;
  setSlowUpload(slow: boolean): void;
}

export interface ChatService {
  readonly kind: 'local' | 'supabase';
  readonly debug?: DebugControls;

  /** 這個瀏覽器的匿名身分 */
  getUserId(): Promise<string>;
  join(nickname: string): Promise<JoinResult>;
  leave(): Promise<void>;
  loadRecent(): Promise<{ messages: Message[]; reactions: Reaction[] }>;
  fetchMessages(ids: string[]): Promise<Message[]>;
  sendMessage(input: SendInput, onProgress?: (percent: number) => void): Promise<SendResult>;
  recall(messageId: string): Promise<RecallResult>;
  toggleReaction(messageId: string, emoji: Emoji, nickname: string): Promise<{ ok: boolean }>;
  on<K extends ChatEventName>(event: K, handler: (payload: ChatEvents[K]) => void): () => void;
}
