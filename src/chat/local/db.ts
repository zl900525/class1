// 階段一的本機資料庫：瀏覽器內建的 IndexedDB，同一個瀏覽器的所有分頁共用

import type { Message, Reaction } from '../types';

/** 存進資料庫的訊息：圖片只存檔案的鍵，顯示時再換成網址 */
export interface StoredMessage extends Omit<Message, 'image'> {
  image: { fullKey: string; thumbKey: string; width: number; height: number } | null;
}

const DB_NAME = 'anon-chat';
const KEEP_MESSAGES = 200;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('messages', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      db.createObjectStore('reactions', { keyPath: 'key' }).createIndex('messageId', 'messageId');
      db.createObjectStore('blobs');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

type StoredReaction = Reaction & { key: string };
export const reactionKey = (r: Pick<Reaction, 'messageId' | 'userId' | 'emoji'>) =>
  `${r.messageId}|${r.userId}|${r.emoji}`;

export async function getMessage(id: string): Promise<StoredMessage | undefined> {
  const db = await open();
  return result(db.transaction('messages').objectStore('messages').get(id));
}

export async function putMessage(message: StoredMessage): Promise<void> {
  const db = await open();
  const tx = db.transaction('messages', 'readwrite');
  tx.objectStore('messages').put(message);
  await done(tx);
}

/** 最新的 limit 則，由舊到新排列 */
export async function getRecentMessages(limit: number): Promise<StoredMessage[]> {
  const db = await open();
  const index = db.transaction('messages').objectStore('messages').index('createdAt');
  const list: StoredMessage[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = index.openCursor(null, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || list.length >= limit) return resolve();
      list.push(cursor.value as StoredMessage);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return list.reverse();
}

export async function getReactionsFor(messageIds: string[]): Promise<Reaction[]> {
  const db = await open();
  const index = db.transaction('reactions').objectStore('reactions').index('messageId');
  const all = await Promise.all(messageIds.map((id) => result(index.getAll(id))));
  return all.flat().map(({ key: _key, ...r }: StoredReaction) => r);
}

export async function hasReaction(r: Reaction): Promise<boolean> {
  const db = await open();
  const found = await result(db.transaction('reactions').objectStore('reactions').getKey(reactionKey(r)));
  return found !== undefined;
}

export async function putReaction(r: Reaction): Promise<void> {
  const db = await open();
  const tx = db.transaction('reactions', 'readwrite');
  tx.objectStore('reactions').put({ ...r, key: reactionKey(r) });
  await done(tx);
}

export async function deleteReaction(r: Reaction): Promise<void> {
  const db = await open();
  const tx = db.transaction('reactions', 'readwrite');
  tx.objectStore('reactions').delete(reactionKey(r));
  await done(tx);
}

export async function deleteReactionsFor(messageId: string): Promise<void> {
  const db = await open();
  const tx = db.transaction('reactions', 'readwrite');
  const store = tx.objectStore('reactions');
  const keys = await result(store.index('messageId').getAllKeys(messageId));
  keys.forEach((key) => store.delete(key));
  await done(tx);
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await open();
  const tx = db.transaction('blobs', 'readwrite');
  tx.objectStore('blobs').put(blob, key);
  await done(tx);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await open();
  return result(db.transaction('blobs').objectStore('blobs').get(key));
}

export async function deleteBlobs(keys: string[]): Promise<void> {
  const db = await open();
  const tx = db.transaction('blobs', 'readwrite');
  keys.forEach((key) => tx.objectStore('blobs').delete(key));
  await done(tx);
}

/** 只保留最新的 200 則，模擬階段二的每日清理 */
export async function pruneOldMessages(): Promise<void> {
  const db = await open();
  const all = await result(db.transaction('messages').objectStore('messages').index('createdAt').getAll());
  const old = (all as StoredMessage[]).slice(0, Math.max(0, all.length - KEEP_MESSAGES));
  for (const m of old) {
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').delete(m.id);
    await done(tx);
    await deleteReactionsFor(m.id);
    if (m.image) await deleteBlobs([m.image.fullKey, m.image.thumbKey]);
  }
}
