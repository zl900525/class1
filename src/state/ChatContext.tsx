import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createChatService } from '../chat/createChatService';
import { ChatStore, type ChatState } from './chatStore';

const StoreContext = createContext<ChatStore | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ChatStore(createChatService()));
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useChatStore(): ChatStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useChatStore 必須放在 ChatProvider 裡面');
  return store;
}

export function useChatState(): ChatState {
  const store = useChatStore();
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** 每隔一段時間重新整理，用在收回倒數等需要跟著時間變的地方 */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

export type { ChatState, PendingInfo } from './chatStore';
export type { OnlineUser } from './presenceTracker';
