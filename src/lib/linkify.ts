// 網址變連結（架構文件 9.1）：只認 http:// 和 https:// 開頭，其他一律當純文字

export type Segment = { type: 'text'; value: string } | { type: 'link'; value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"'，。！？、「」『』（）]+/g;
// 網址結尾常黏到的標點，不算進網址
const TRAILING = /[.,!?;:)\]}'"]+$/;

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING)?.[0] ?? '';
    url = url.slice(0, url.length - trailing.length);
    if (url.length <= 'https://'.length) continue;

    if (start > last) segments.push({ type: 'text', value: text.slice(last, start) });
    segments.push({ type: 'link', value: url });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}
