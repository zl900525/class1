// 進出提示、已收回、日期分隔線（docs/design.md 3.4）

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="date-sep" role="separator">
      <span>{label}</span>
    </div>
  );
}

export function SystemNotice({ text }: { text: string }) {
  return <p className="sys-notice">{text}</p>;
}
