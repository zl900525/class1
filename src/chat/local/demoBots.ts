// ?demo=1 的模擬使用者：會進出、說話、按表情，讓一個人也能看到「別人」的樣子

import { EMOJIS, type Emoji, type PresenceUser } from '../types';

export interface BotHost {
  botJoin(user: PresenceUser): void;
  botLeave(user: PresenceUser): void;
  botSay(user: PresenceUser, text: string): void;
  botReact(user: PresenceUser, emoji: Emoji): void;
}

const LINES = [
  '有人看過昨天的流星雨嗎？',
  '超級亮的',
  '今天晚上還有嗎',
  '氣象說凌晨三點最多',
  '我要去頂樓等',
  '有人要一起嗎',
  '剛剛好像看到一顆！',
  '這裡有直播 https://example.com/meteor-live',
  '好冷喔',
  '哈哈哈',
];

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export class DemoBots {
  private timers: number[] = [];
  private bots: PresenceUser[] = [
    { userId: 'demo-cat', tabId: 'demo-cat', nickname: '小貓', onlineAt: '' },
    { userId: 'demo-tu', tabId: 'demo-tu', nickname: '阿土', onlineAt: '' },
  ];
  private online = new Set<string>();

  constructor(private host: BotHost) {}

  get onlineBots(): PresenceUser[] {
    return this.bots.filter((b) => this.online.has(b.userId));
  }

  start() {
    this.later(1500, () => this.join(this.bots[0]));
    this.later(4000, () => this.join(this.bots[1]));
    this.later(3000, () => this.chatter());
    // 阿土 40 秒後離開，25 秒後回來（超過 10 秒，所以看得到離開和進入提示）
    this.later(40000, () => this.leave(this.bots[1]));
    this.later(65000, () => this.join(this.bots[1]));
  }

  stop() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.bots.filter((b) => this.online.has(b.userId)).forEach((b) => this.leave(b));
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private join(bot: PresenceUser) {
    bot.onlineAt = new Date().toISOString();
    this.online.add(bot.userId);
    this.host.botJoin({ ...bot });
  }

  private leave(bot: PresenceUser) {
    this.online.delete(bot.userId);
    this.host.botLeave({ ...bot });
  }

  private chatter() {
    const present = this.onlineBots;
    if (present.length > 0) {
      const bot = pick(present);
      if (Math.random() < 0.3) this.host.botReact(bot, pick(EMOJIS));
      else this.host.botSay(bot, pick(LINES));
    }
    this.later(6000 + Math.random() * 8000, () => this.chatter());
  }
}
