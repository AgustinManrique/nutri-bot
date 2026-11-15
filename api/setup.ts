import { env } from '../lib/env';
import { tg } from '../lib/telegram';

// GET /api/setup → registra el webhook de Telegram apuntando a este deploy.
// Es idempotente e inofensivo: siempre apunta al dominio de producción del proyecto.
export async function GET(): Promise<Response> {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) return Response.json({ ok: false, error: 'Falta VERCEL_PROJECT_PRODUCTION_URL (solo existe en Vercel)' }, { status: 500 });
  try {
    await tg('setWebhook', {
      url: `https://${host}/api/telegram`,
      secret_token: env.webhookSecret,
      allowed_updates: ['message'],
    });
    await tg('setMyCommands', {
      commands: [
        { command: 'hoy', description: 'Cómo voy hoy' },
        { command: 'semana', description: 'Resumen de la semana' },
        { command: 'despensa', description: 'Qué tengo en casa' },
        { command: 'web', description: 'Vincular tu mail al dashboard' },
      ],
    });
    const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo');
    return Response.json({ ok: true, webhook: info.url, pendientes: info.pending_update_count, ultimo_error: info.last_error_message ?? null });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
