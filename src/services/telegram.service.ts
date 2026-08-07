import TelegramBot, { type ParseMode } from 'node-telegram-bot-api';
import { env } from '../config/env';

const bot = new TelegramBot(env.telegramBotToken);

export async function sendMessage(text: string, parseMode?: ParseMode): Promise<void> {
  await bot.sendMessage(
    env.telegramChatId,
    text,
    parseMode ? { parse_mode: parseMode } : undefined,
  );
}
