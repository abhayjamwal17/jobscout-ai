// Reserved characters in Telegram's MarkdownV2 that must be backslash-escaped
// when they appear in text that is not itself formatting syntax.
// https://core.telegram.org/bots/api#markdownv2-style
const MARKDOWN_V2_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL_CHARS, (char) => `\\${char}`);
}
