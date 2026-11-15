import type { Part } from '@google/genai';
import { responder } from './agente';
import { db } from './db';
import { despensaComoTexto, verDespensa } from './despensa';
import { env } from './env';
import { formatearResumen, resumenDia } from './resumen';
import { descargarArchivo, enviarMensaje, escribiendo, type TgUpdate } from './telegram';

const BIENVENIDA = `¡Hola! Soy tu asistente nutricional 🥗💪

Contame lo que comés y entrenás como le hablarías a alguien:
• "desayuné 2 tostadas con queso y un café con leche"
• "hice 1 hora de pesas, piernas, intenso"
• una foto del plato o un audio también sirve

También podés decirme qué tenés en la heladera/alacena y tus suplementos, y preguntarme "¿qué como para cerrar el día?".

Comandos: /hoy · /semana · /despensa · /web (vincular el dashboard)

Para arrancar, pasame: sexo, edad, peso, altura, qué tan activo sos y si querés bajar, mantener o subir.`;

export async function procesarUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;

  if (!env.allowedChatIds.includes(chatId)) {
    await enviarMensaje(chatId, `Este bot es privado. (Tu chat id es ${chatId})`);
    return;
  }

  // Evitar procesar dos veces si Telegram reintenta
  const dup = await db().from('updates_procesados').insert({ update_id: update.update_id });
  if (dup.error) {
    if (dup.error.code === '23505') return;
    throw new Error(dup.error.message);
  }

  await db().from('usuarios').upsert(
    { chat_id: chatId, nombre: msg.from?.first_name ?? null },
    { onConflict: 'chat_id', ignoreDuplicates: true },
  );

  try {
    const texto = (msg.text ?? msg.caption ?? '').trim();
    const comando = texto.split(/[\s@]/)[0].toLowerCase();

    if (comando === '/start') return enviarMensaje(chatId, BIENVENIDA);
    if (comando === '/hoy') return enviarMensaje(chatId, formatearResumen(await resumenDia(chatId)));
    if (comando === '/despensa') return enviarMensaje(chatId, `🧺 Tu despensa\n${despensaComoTexto(await verDespensa(chatId))}`);
    if (comando === '/web') {
      const email = texto.split(/\s+/)[1]?.trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return enviarMensaje(chatId, 'Pasame tu mail así: /web tu@mail.com\nCon ese mail vas a entrar al dashboard web.');
      }
      const { error } = await db().from('usuarios').update({ email }).eq('chat_id', chatId);
      if (error) return enviarMensaje(chatId, `No pude guardar el mail: ${error.message}`);
      return enviarMensaje(chatId, `✅ Listo, vinculé ${email}. Entrá al dashboard y pedí el link de acceso con ese mail.`);
    }

    await escribiendo(chatId);

    const partes: Part[] = [];
    let paraHistorial = texto;

    if (comando === '/semana') {
      partes.push({ text: 'Haceme un resumen corto de mi semana (usá resumen_semana) con 1-2 observaciones útiles.' });
      paraHistorial = '/semana';
    }
    if (msg.photo?.length) {
      const mayor = msg.photo[msg.photo.length - 1];
      partes.push({ inlineData: { mimeType: 'image/jpeg', data: await descargarArchivo(mayor.file_id) } });
      paraHistorial = `[foto] ${texto}`.trim();
    }
    const audio = msg.voice ?? msg.audio;
    if (audio) {
      partes.push({ inlineData: { mimeType: audio.mime_type ?? 'audio/ogg', data: await descargarArchivo(audio.file_id) } });
      partes.push({ text: '(El usuario mandó un audio: interpretalo como si lo hubiera escrito.)' });
      paraHistorial = '[audio]';
    }
    if (texto && comando !== '/semana') partes.push({ text: texto });

    if (!partes.length) return enviarMensaje(chatId, 'Por ahora entiendo texto, fotos y audios 🙏');

    const respuesta = await responder(chatId, partes, paraHistorial);
    await enviarMensaje(chatId, respuesta);
  } catch (e) {
    console.error('[procesarUpdate]', e);
    await enviarMensaje(chatId, 'Uy, se me trabó algo procesando eso 😵. Probá de nuevo en un rato.').catch(() => {});
  }
}
