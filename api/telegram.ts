import { procesarUpdate } from '../lib/bot';
import { env } from '../lib/env';
import type { TgUpdate } from '../lib/telegram';

// Webhook de Telegram → POST /api/telegram
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) {
    return new Response('forbidden', { status: 401 });
  }
  const update = (await request.json()) as TgUpdate;
  try {
    await procesarUpdate(update);
  } catch (e) {
    console.error('[webhook]', e);
  }
  // Siempre 200 para que Telegram no reintente en loop
  return new Response('ok');
}
