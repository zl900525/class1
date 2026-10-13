import { WifiOffIcon } from './Icons';

export function ConnectionBanner() {
  return (
    <div className="conn-banner" role="status">
      <WifiOffIcon size={18} />
      連線中斷，正在重新連線…
    </div>
  );
}

/** 階段一頂端的展示模式提示 */
export function DemoStrip() {
  return <div className="demo-strip">展示模式：訊息只存在這台裝置的瀏覽器裡</div>;
}
