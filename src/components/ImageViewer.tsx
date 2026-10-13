// 圖片全螢幕檢視（docs/design.md 4.4）：點任何地方或按 Esc 關閉

import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';

export function ImageViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="圖片全螢幕檢視" onClick={onClose}>
      <button ref={closeRef} type="button" className="viewer-close" aria-label="關閉" onClick={onClose}>
        <CloseIcon size={22} />
      </button>
      <img className="viewer-img" src={url} alt="放大的聊天室圖片" />
      <p className="viewer-hint">點一下任何地方，或按 Esc 關閉</p>
    </div>
  );
}
