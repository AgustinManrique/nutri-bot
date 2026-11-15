import { createHash } from 'node:crypto';

function requerida(nombre: string): string {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

// Getters: se leen recién cuando se usan (no rompe al importar)
export const env = {
  get telegramToken() { return requerida('TELEGRAM_BOT_TOKEN'); },
  // Si no se define, se deriva del token del bot (no hace falta otra variable)
  get webhookSecret() {
    return process.env.TELEGRAM_WEBHOOK_SECRET
      || createHash('sha256').update(`nutri-webhook:${requerida('TELEGRAM_BOT_TOKEN')}`).digest('hex').slice(0, 48);
  },
  /** Opcional: chat ids que siempre son admin. El acceso normal se maneja en la base. */
  get allowedChatIds(): number[] {
    return (process.env.ALLOWED_CHAT_IDS ?? '').split(',').map((s) => Number(s.trim())).filter(Boolean);
  },
  get supabaseUrl() { return requerida('SUPABASE_URL'); },
  get supabaseKey() { return requerida('SUPABASE_SERVICE_ROLE_KEY'); },
  get geminiKey() { return requerida('GEMINI_API_KEY'); },
  get geminiModel() { return process.env.GEMINI_MODEL || 'gemini-flash-latest'; },
  get cronSecret() { return requerida('CRON_SECRET'); },
};
