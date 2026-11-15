import { waitUntil } from '@vercel/functions';
import { procesarUpdate } from '../lib/bot';
import { env } from '../lib/env';
import type { TgUpdate } from '../lib/telegram';

// Webhook de Telegram → POST /api/telegram
// Contestamos 200 al instante (así Telegram no reintenta) y procesamos en segundo plano.
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.webhookSecret) {
    return new Response('forbidden', { status: 401 });
  }
  const update = (await request.json()) as TgUpdate;
  waitUntil(procesarUpdate(update).catch((e) => console.error('[webhook]', e)));
  return new Response('ok');
}
