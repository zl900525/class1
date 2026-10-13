// 架構文件第 5.1 節的資料格式。階段一、階段二共用。

export const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export type Emoji = (typeof EMOJIS)[number];

export const HISTORY_LIMIT = 50;
export const MAX_TEXT_LENGTH = 500;
export const RECALL_WINDOW_MS = 2 * 60 * 1000;

export interface ChatImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface Message {
  id: string;
  senderId: string;
  nickname: string;
  text: string;
  image: ChatImage | null;
  replyTo: string | null;
  createdAt: string;
  recalledAt: string | null;
}

export interface Reaction {
  messageId: string;
  userId: string;
  nickname: string;
  emoji: Emoji;
}

export interface PresenceUser {
  userId: string;
  tabId: string;
  nickname: string;
  onlineAt: string;
}

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

/** 已經壓縮好、準備上傳的圖片（壓縮在送進聊天服務之前完成，兩個階段共用） */
export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}
