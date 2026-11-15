import { db, ok } from './db';

export interface ItemDespensa {
  id: number;
  nombre: string;
  cantidad: string | null;
  tipo: 'alimento' | 'suplemento';
  alimento_id: number | null;
  alimentos?: {
    nombre: string;
    kcal_100: number; proteina_100: number; carbos_100: number; grasas_100: number;
    porcion_nombre: string | null; porcion_g: number | null;
  } | null;
}

export async function verDespensa(chatId: number): Promise<ItemDespensa[]> {
  const data = ok(
    await db().from('despensa')
      .select('id, nombre, cantidad, tipo, alimento_id, alimentos(nombre, kcal_100, proteina_100, carbos_100, grasas_100, porcion_nombre, porcion_g)')
      .eq('chat_id', chatId)
      .order('tipo').order('nombre'),
    'verDespensa',
  );
  return (data ?? []) as unknown as ItemDespensa[];
}

export interface ItemNuevo {
  nombre: string;
  cantidad?: string;
  tipo?: 'alimento' | 'suplemento';
  alimento_id?: number;
}

export async function actualizarDespensa(
  chatId: number,
  { agregar = [], quitar = [], vaciar_antes = false }: { agregar?: ItemNuevo[]; quitar?: string[]; vaciar_antes?: boolean },
) {
  if (vaciar_antes) {
    // Al "reemplazar todo" mantenemos los suplementos salvo que se pidan quitar explícitamente
    ok(await db().from('despensa').delete().eq('chat_id', chatId).eq('tipo', 'alimento'), 'vaciarDespensa');
  }
  if (agregar.length) {
    const filas = agregar.map((i) => ({
      chat_id: chatId,
      nombre: i.nombre.trim().toLowerCase(),
      cantidad: i.cantidad ?? null,
      tipo: i.tipo ?? 'alimento',
      alimento_id: i.alimento_id ?? null,
      actualizado: new Date().toISOString(),
    }));
    ok(await db().from('despensa').upsert(filas, { onConflict: 'chat_id,nombre' }), 'agregarDespensa');
  }
  for (const nombre of quitar) {
    ok(await db().from('despensa').delete().eq('chat_id', chatId).ilike('nombre', `%${nombre.trim()}%`), 'quitarDespensa');
  }
  return verDespensa(chatId);
}

/** Versión compacta para meter en el prompt */
export function despensaComoTexto(items: ItemDespensa[]): string {
  if (!items.length) return '(vacía / no me contaste qué tenés)';
  const fmt = (i: ItemDespensa) => `${i.nombre}${i.cantidad ? ` (${i.cantidad})` : ''}`;
  const sup = items.filter((i) => i.tipo === 'suplemento').map(fmt);
  const ali = items.filter((i) => i.tipo === 'alimento').map(fmt);
  return [
    ali.length ? `Alimentos: ${ali.join(', ')}` : '',
    sup.length ? `Suplementos: ${sup.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
