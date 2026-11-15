import { responder } from '../../lib/agente';
import { env } from '../../lib/env';
import { resumenDia } from '../../lib/resumen';
import { enviarMensaje } from '../../lib/telegram';

// Vercel Cron → GET /api/cron/cierre (todos los días 20:30 hora Argentina)
export async function GET(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${env.cronSecret}`) {
    return new Response('forbidden', { status: 401 });
  }

  for (const chatId of env.allowedChatIds) {
    try {
      const r = await resumenDia(chatId);
      if (!r.comidas.length) {
        await enviarMensaje(chatId, '👋 Hoy no cargaste ninguna comida. ¿Me contás qué comiste así no perdemos el registro?');
        continue;
      }
      const texto = await responder(
        chatId,
        [{
          text:
            '[Mensaje automático de las 20:30] Mirá cómo vengo hoy. Si me falta algo para cerrar las metas, ' +
            'sugerime qué comer con lo que tengo en la despensa (incluí suplementos si sirven). ' +
            'Si ya estoy bien, decímelo en una línea. Breve.',
        }],
        '[recordatorio automático de cierre del día]',
      );
      await enviarMensaje(chatId, texto);
    } catch (e) {
      console.error(`[cron cierre] chat ${chatId}`, e);
    }
  }
  return new Response('ok');
}
