import type { ChatService } from './ChatService';
import { LocalChatService } from './local/LocalChatService';
import { SupabaseChatService } from './supabase/SupabaseChatService';

/**
 * 依設定選擇聊天服務（架構文件 4.1）。
 * 有設定 Supabase 網址和公開金鑰 → 階段二的 Supabase 版；沒有 → 階段一的本機版。
 * 網址加上 ?local=1 可以強制使用本機版，改畫面時不會弄髒正式的聊天室資料。
 */
export function createChatService(): ChatService {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const params = new URLSearchParams(window.location.search);

  if (url && key && !params.has('local')) {
    return new SupabaseChatService(url, key);
  }
  return new LocalChatService({ demo: params.has('demo') });
}
