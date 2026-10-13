import type { ChatService } from './ChatService';
import { LocalChatService } from './local/LocalChatService';

/**
 * 依設定選擇聊天服務（架構文件 4.1）。
 * 有設定 Supabase 網址和公開金鑰 → 階段二的 Supabase 版；沒有 → 階段一的本機版。
 */
export function createChatService(): ChatService {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const params = new URLSearchParams(window.location.search);

  if (url && key) {
    // 階段二：在這裡改成 return new SupabaseChatService(url, key);
    console.warn('已設定 Supabase，但 Supabase 版還沒實作（階段二），先使用本機版。');
  }

  return new LocalChatService({ demo: params.has('demo') });
}
