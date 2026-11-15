import { env } from './env';

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: { first_name?: string; username?: string };
  text?: string;
  caption?: string;
  photo?: { file_id: string; width: number; height: number }[];
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string };
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export async function tg<T = unknown>(metodo: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${env.telegramToken}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; result: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}

export async function enviarMensaje(chatId: number, texto: string) {
  // Telegram corta en 4096 caracteres
  for (let i = 0; i < texto.length; i += 4000) {
    await tg('sendMessage', { chat_id: chatId, text: texto.slice(i, i + 4000) });
  }
}

export async function escribiendo(chatId: number) {
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
}

export async function descargarArchivo(fileId: string): Promise<string> {
  const file = await tg<{ file_path: string }>('getFile', { file_id: fileId });
  const r = await fetch(`https://api.telegram.org/file/bot${env.telegramToken}/${file.file_path}`);
  if (!r.ok) throw new Error(`No pude bajar el archivo de Telegram (${r.status})`);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}
