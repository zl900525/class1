import { useEffect } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { ChatScreen } from './screens/ChatScreen';
import { JoinScreen } from './screens/JoinScreen';
import { ChatProvider, useChatState, useChatStore } from './state/ChatContext';

const TITLE = '匿名聊天室';
const showDebug = new URLSearchParams(window.location.search).has('debug');

function Screens() {
  const state = useChatState();
  const store = useChatStore();

  // 網頁不在前面時，分頁標題顯示未讀數；切回來歸零
  useEffect(() => {
    document.title = state.unread > 0 ? `(${state.unread}) ${TITLE}` : TITLE;
  }, [state.unread]);

  useEffect(() => {
    const onVisible = () => !document.hidden && store.clearUnread();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [store]);

  return (
    <>
      {state.screen === 'loading' && (
        <p className="boot" role="status">
          連線中…
        </p>
      )}
      {state.screen === 'join' && <JoinScreen />}
      {state.screen === 'chat' && <ChatScreen />}
      {showDebug && <DebugPanel />}
    </>
  );
}

export function App() {
  return (
    <ChatProvider>
      <Screens />
    </ChatProvider>
  );
}
