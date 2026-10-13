// 代號規則與比對（架構文件 6.1、9.1）

export const NICKNAME_MAX = 12;
const RESERVED = ['系統', '管理員', 'admin'];

// 看不見的字元：控制字元、零寬字元、方向控制字元
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;

/** 統一格式：全形轉半形、拿掉看不見的字元、去掉頭尾空白 */
export function normalizeNickname(raw: string): string {
  return raw.normalize('NFKC').replace(INVISIBLE, '').trim();
}

/** 比對用的鍵：統一格式後忽略大小寫（Tom = tom = Ｔｏｍ） */
export function nicknameKey(raw: string): string {
  return normalizeNickname(raw).toLowerCase();
}

/** 用「字」計算長度（emoji 等組合字元算一個字） */
export function nicknameLength(raw: string): number {
  return [...normalizeNickname(raw)].length;
}

export type NicknameError = 'empty' | 'too_long' | 'reserved';

export function validateNickname(raw: string): NicknameError | null {
  const length = nicknameLength(raw);
  if (length === 0) return 'empty';
  if (length > NICKNAME_MAX) return 'too_long';
  if (RESERVED.some((word) => nicknameKey(word) === nicknameKey(raw))) return 'reserved';
  return null;
}

export const NICKNAME_ERROR_TEXT: Record<NicknameError | 'taken' | 'network', string> = {
  empty: '請輸入代號',
  too_long: `代號最多 ${NICKNAME_MAX} 個字`,
  reserved: '這個代號不能使用',
  taken: '這個代號有人在用了，請換一個',
  network: '連不上伺服器，請稍後再試',
};
