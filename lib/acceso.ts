import { db, ok } from './db';
import { env } from './env';
import { enviarMensaje, type TgMessage } from './telegram';

interface EstadoAcceso { habilitado: boolean; es_admin: boolean; solicitado_en: string | null }

/**
 * Control de acceso guardado en la base (sin redeploys):
 * - El primer usuario que escribe, si no hay ningún admin, queda como admin.
 * - Los chat ids de ALLOWED_CHAT_IDS (opcional) también son admins.
 * - Cualquier otro pide acceso y los admins lo aprueban con /aprobar <id>.
 */
export async function verificarAcceso(msg: TgMessage): Promise<boolean> {
  const chatId = msg.chat.id;
  const nombre = msg.from?.first_name ?? null;
  const username = msg.from?.username ?? null;

  await db().from('usuarios').upsert({ chat_id: chatId, nombre, username }, { onConflict: 'chat_id', ignoreDuplicates: true });
  let u = ok(await db().from('usuarios').select('habilitado, es_admin, solicitado_en').eq('chat_id', chatId).single(), 'acceso') as EstadoAcceso;

  if (env.allowedChatIds.includes(chatId) && !u.es_admin) {
    ok(await db().from('usuarios').update({ habilitado: true, es_admin: true }).eq('chat_id', chatId), 'acceso.admin');
    u = { ...u, habilitado: true, es_admin: true };
  }
  if (u.habilitado) return true;

  const { count } = await db().from('usuarios').select('chat_id', { count: 'exact', head: true }).eq('es_admin', true);
  if (!count) {
    ok(await db().from('usuarios').update({ habilitado: true, es_admin: true }).eq('chat_id', chatId), 'acceso.primero');
    await enviarMensaje(chatId, '👑 Sos el primer usuario, así que quedaste como admin. Cuando alguien más le escriba al bot te va a llegar el pedido para aprobarlo.');
    return true;
  }

  if (!u.solicitado_en) {
    ok(await db().from('usuarios').update({ solicitado_en: new Date().toISOString() }).eq('chat_id', chatId), 'acceso.solicitud');
    const quien = `${nombre ?? 'Alguien'}${username ? ` (@${username})` : ''}`;
    for (const admin of await adminIds()) {
      await enviarMensaje(admin, `🙋 ${quien} quiere usar el bot.\n\n/aprobar ${chatId}\n/rechazar ${chatId}`).catch(() => {});
    }
    await enviarMensaje(chatId, '¡Hola! Este bot es por invitación. Ya le avisé al admin, te escribo apenas te apruebe 🙌');
  } else {
    await enviarMensaje(chatId, 'Tu pedido de acceso sigue pendiente. Te aviso apenas te aprueben.');
  }
  return false;
}

async function adminIds(): Promise<number[]> {
  const data = ok(await db().from('usuarios').select('chat_id').eq('es_admin', true), 'admins') ?? [];
  return data.map((x) => Number(x.chat_id));
}

/** Comandos de admin. Devuelve true si el mensaje era uno de ellos. */
export async function comandoAdmin(chatId: number, comando: string, texto: string): Promise<boolean> {
  if (!['/aprobar', '/rechazar', '/usuarios'].includes(comando)) return false;
  const yo = ok(await db().from('usuarios').select('es_admin').eq('chat_id', chatId).single(), 'admin') as { es_admin: boolean };
  if (!yo.es_admin) {
    await enviarMensaje(chatId, 'Ese comando es solo para el admin.');
    return true;
  }

  if (comando === '/usuarios') {
    const lista = ok(await db().from('usuarios').select('chat_id, nombre, username, habilitado, es_admin, solicitado_en').order('creado'), 'usuarios') ?? [];
    const linea = (u: (typeof lista)[number]) =>
      `${u.es_admin ? '👑' : u.habilitado ? '✅' : '⏳'} ${u.nombre ?? '?'}${u.username ? ` @${u.username}` : ''} — ${u.chat_id}`;
    await enviarMensaje(chatId, lista.length ? lista.map(linea).join('\n') : 'No hay usuarios todavía.');
    return true;
  }

  const objetivo = Number(texto.split(/\s+/)[1]);
  if (!objetivo) {
    await enviarMensaje(chatId, `Uso: ${comando} <chat_id>  (lo ves con /usuarios)`);
    return true;
  }
  if (comando === '/aprobar') {
    const { data } = await db().from('usuarios').update({ habilitado: true }).eq('chat_id', objetivo).select('nombre');
    if (!data?.length) return enviarMensaje(chatId, 'No encontré ese usuario.').then(() => true);
    await enviarMensaje(objetivo, '🎉 ¡Te aprobaron! Mandá /start para arrancar.').catch(() => {});
    await enviarMensaje(chatId, `✅ Aprobado: ${data[0].nombre ?? objetivo}`);
  } else {
    await db().from('usuarios').update({ habilitado: false, solicitado_en: null }).eq('chat_id', objetivo).eq('es_admin', false);
    await enviarMensaje(chatId, `🚫 Listo, ${objetivo} no tiene acceso.`);
  }
  return true;
}

/** Usuarios habilitados (para el cron) */
export async function usuariosHabilitados(): Promise<number[]> {
  const data = ok(await db().from('usuarios').select('chat_id').eq('habilitado', true), 'habilitados') ?? [];
  return data.map((x) => Number(x.chat_id));
}
