import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('把網址切成連結', () => {
    expect(linkify('看這個 https://example.com 好酷')).toEqual([
      { type: 'text', value: '看這個 ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ' 好酷' },
    ]);
  });

  it('結尾的標點不算進網址', () => {
    expect(linkify('網址是 http://a.tw/x.')).toEqual([
      { type: 'text', value: '網址是 ' },
      { type: 'link', value: 'http://a.tw/x' },
      { type: 'text', value: '.' },
    ]);
  });

  it('中文標點會切斷網址', () => {
    expect(linkify('https://example.com，你看')[0]).toEqual({
      type: 'link',
      value: 'https://example.com',
    });
  });

  it('javascript: 不會變成連結', () => {
    expect(linkify('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('HTML 標籤保持純文字', () => {
    expect(linkify('<b>粗體</b>')).toEqual([{ type: 'text', value: '<b>粗體</b>' }]);
  });

  it('沒有網址就是一整段文字', () => {
    expect(linkify('你好')).toEqual([{ type: 'text', value: '你好' }]);
  });
});
