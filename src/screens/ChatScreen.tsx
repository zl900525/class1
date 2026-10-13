// 聊天室主畫面（架構文件 7.2、docs/design.md 4.2、4.3）

import { useCallback, useRef, useState } from 'react';
import { Composer } from '../components/Composer';
import { ConnectionBanner, DemoStrip } from '../components/ConnectionBanner';
import { ImageIcon, LeaveIcon, UsersIcon } from '../components/Icons';
import { ImageViewer } from '../components/ImageViewer';
import { MessageList } from '../components/MessageList';
import { OnlineList } from '../components/OnlineList';
import { IMAGE_ERROR_TEXT, validateImageFile } from '../lib/imageCompress';
import { useChatState, useChatStore } from '../state/ChatContext';

export function ChatScreen() {
  const state = useChatState();
  const store = useChatStore();
  const [listOpen, setListOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const pickFile = useCallback((picked: File) => {
    const error = validateImageFile(picked);
    if (error) {
      setImageError(IMAGE_ERROR_TEXT[error]);
      return;
    }
    setImageError(null);
    setFile(picked);
  }, []);

  const closeViewer = useCallback(() => setViewing(null), []);
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div
      className="chat"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) pickFile(dropped);
      }}
    >
      {store.serviceKind === 'local' && <DemoStrip />}

      <header className="topbar">
        <span className="topbar-mark" aria-hidden="true" />
        <h1 className="topbar-title">匿名聊天室</h1>
        <button
          type="button"
          className={`count-pill${listOpen ? ' count-pill--open' : ''}`}
          aria-expanded={listOpen}
          aria-label={`線上 ${state.online.length} 人，${listOpen ? '收起' : '展開'}名單`}
          onClick={() => setListOpen((open) => !open)}
        >
          <UsersIcon size={18} />
          {state.online.length}
        </button>
        <button type="button" className="leave-btn" onClick={() => void store.leave()}>
          <LeaveIcon size={16} />
          離開
        </button>
      </header>

      {state.bannerVisible && <ConnectionBanner />}

      <div className="chat-body">
        <main className="chat-main">
          <MessageList onOpenImage={setViewing} />
          {state.toast && (
            <div className="toast" role="status">
              {state.toast}
            </div>
          )}
          <Composer
            file={file}
            imageError={imageError}
            onPickFile={pickFile}
            onClearFile={() => {
              setFile(null);
              setImageError(null);
            }}
          />
        </main>
        <OnlineList users={state.online} variant="sidebar" />
      </div>

      {listOpen && (
        <div className="sheet-layer">
          <button type="button" className="sheet-scrim" aria-label="收起名單" onClick={() => setListOpen(false)} />
          <OnlineList users={state.online} variant="sheet" />
        </div>
      )}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <ImageIcon size={40} />
          <span>放開以加入圖片</span>
        </div>
      )}

      {viewing && <ImageViewer url={viewing} onClose={closeViewer} />}
    </div>
  );
}
