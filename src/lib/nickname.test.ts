import { describe, expect, it } from 'vitest';
import { nicknameKey, nicknameLength, normalizeNickname, validateNickname } from './nickname';

describe('normalizeNickname', () => {
  it('去掉頭尾空白', () => {
    expect(normalizeNickname('  小明  ')).toBe('小明');
  });
  it('全形英數字轉半形', () => {
    expect(normalizeNickname('Ｔｏｍ１')).toBe('Tom1');
  });
  it('拿掉零寬字元', () => {
    expect(normalizeNickname('To​m')).toBe('Tom');
  });
});

describe('nicknameKey', () => {
  it('大小寫和全形視為相同', () => {
    expect(nicknameKey('Tom')).toBe(nicknameKey('tom'));
    expect(nicknameKey('Ｔｏｍ')).toBe(nicknameKey('TOM'));
  });
});

describe('validateNickname', () => {
  it('空白或只有空白不行', () => {
    expect(validateNickname('')).toBe('empty');
    expect(validateNickname('   ')).toBe('empty');
  });
  it('1～12 個字可以', () => {
    expect(validateNickname('小')).toBeNull();
    expect(validateNickname('一二三四五六七八九十一二')).toBeNull();
  });
  it('13 個字不行', () => {
    expect(validateNickname('一二三四五六七八九十一二三')).toBe('too_long');
  });
  it('emoji 算一個字', () => {
    expect(nicknameLength('貓🐱')).toBe(2);
  });
  it('保留字不分大小寫都不行', () => {
    expect(validateNickname('系統')).toBe('reserved');
    expect(validateNickname('管理員')).toBe('reserved');
    expect(validateNickname('ADMIN')).toBe('reserved');
    expect(validateNickname(' Ａｄｍｉｎ ')).toBe('reserved');
  });
});
