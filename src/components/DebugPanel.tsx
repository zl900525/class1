// 測試面板：網址加上 ?debug=1 才出現（架構文件 7.4）

import { useState } from 'react';
import { useChatStore } from '../state/ChatContext';

export function DebugPanel() {
  const store = useChatStore();
  const debug = store.debug;
  const [offline, setOffline] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [slow, setSlow] = useState(false);

  return (
    <aside className="debug" aria-label="測試面板">
      <div className="debug-head">目前使用：{store.serviceKind === 'local' ? '本機版' : 'Supabase 版'}</div>
      {debug && (
        <>
          <label className="debug-row">
            <span>模擬斷線</span>
            <input
              type="checkbox"
              role="switch"
              checked={offline}
              onChange={(e) => {
                setOffline(e.target.checked);
                debug.setOffline(e.target.checked);
              }}
            />
          </label>
          <label className="debug-row">
            <span>下一則訊息送失敗</span>
            <input
              type="checkbox"
              role="switch"
              checked={failNext}
              onChange={(e) => {
                setFailNext(e.target.checked);
                if (e.target.checked) {
                  debug.failNextSend();
                  // 只作用一次，送出後自動關掉
                  const off = store.subscribe(() => {
                    if (Object.values(store.getState().pending).some((p) => p.status === 'failed')) {
                      setFailNext(false);
                      off();
                    }
                  });
                }
              }}
            />
          </label>
          <label className="debug-row">
            <span>上傳變慢</span>
            <input
              type="checkbox"
              role="switch"
              checked={slow}
              onChange={(e) => {
                setSlow(e.target.checked);
                debug.setSlowUpload(e.target.checked);
              }}
            />
          </label>
        </>
      )}
    </aside>
  );
}
