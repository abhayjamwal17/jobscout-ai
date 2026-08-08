import { config } from 'dotenv';

config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  groqApiKey: process.env.GROQ_API_KEY ?? '',
};
