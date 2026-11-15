import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { restarDias } from '../../../lib/fechas';
import { buscarEnOpenFoodFacts, type ProductoEscaneado } from './openFoodFacts';
import type { Api, Comida, DiaResumen, Entreno, ItemDespensa, Perfil, Tabla } from './types';

export function crearSupabase(): SupabaseClient {
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function crearApiReal(sb: SupabaseClient): Api {
  let chatId: number | null = null;
  const oyentes = new Set<(t: Tabla) => void>();
  let canal: ReturnType<SupabaseClient['channel']> | null = null;

  const perfil = async (): Promise<Perfil | null> => {
    const p = ok(await sb.from('usuarios').select('*').maybeSingle()) as Perfil | null;
    chatId = p?.chat_id ?? null;
    return p;
  };
  const miChat = async () => chatId ?? (await perfil())?.chat_id ?? Promise.reject(new Error('Tu mail no está vinculado. Mandale /web tu@mail.com al bot.'));

  return {
    modo: 'real',
    perfil,
    async guardarPerfil(cambios) {
      const id = await miChat();
      return ok(await sb.from('usuarios').update({ ...cambios, actualizado: new Date().toISOString() }).eq('chat_id', id).select().single()) as Perfil;
    },
    async dia(fecha) {
      const [c, e] = await Promise.all([
        sb.from('comidas').select('id, momento, descripcion, gramos, kcal, proteina, carbos, grasas, creado').eq('fecha', fecha).order('creado'),
        sb.from('entrenamientos').select('id, tipo, descripcion, duracion_min, intensidad, kcal_estimadas').eq('fecha', fecha).order('creado'),
      ]);
      return { fecha, comidas: (ok(c) ?? []) as Comida[], entrenos: (ok(e) ?? []) as Entreno[] };
    },
    async semana(hasta) {
      const desde = restarDias(hasta, 6);
      const [c, e] = await Promise.all([
        sb.from('comidas').select('fecha, kcal, proteina, carbos, grasas').gte('fecha', desde).lte('fecha', hasta),
        sb.from('entrenamientos').select('fecha').gte('fecha', desde).lte('fecha', hasta),
      ]);
      const cs = (ok(c) ?? []) as (Omit<Comida, 'id'> & { fecha: string })[];
      const es = (ok(e) ?? []) as { fecha: string }[];
      const dias: DiaResumen[] = [];
      for (let i = 6; i >= 0; i--) {
        const f = restarDias(hasta, i);
        const del = cs.filter((x) => x.fecha === f);
        dias.push({
          fecha: f,
          registrado: del.length > 0,
          kcal: Math.round(del.reduce((a, x) => a + Number(x.kcal), 0)),
          proteina: Math.round(del.reduce((a, x) => a + Number(x.proteina), 0)),
          carbos: Math.round(del.reduce((a, x) => a + Number(x.carbos), 0)),
          grasas: Math.round(del.reduce((a, x) => a + Number(x.grasas), 0)),
          entrenos: es.filter((x) => x.fecha === f).length,
        });
      }
      return dias;
    },
    async borrarComida(id) { ok(await sb.from('comidas').delete().eq('id', id)); },
    async borrarEntreno(id) { ok(await sb.from('entrenamientos').delete().eq('id', id)); },
    async despensa() {
      const data = ok(await sb.from('despensa')
        .select('id, nombre, cantidad, tipo, alimento:alimentos(porcion_nombre, porcion_g, kcal_100, proteina_100, carbos_100, grasas_100)')
        .order('tipo').order('nombre'));
      return (data ?? []) as unknown as ItemDespensa[];
    },
    async agregarDespensa(item) {
      const id = await miChat();
      // Si existe en la base de alimentos, lo vinculamos para tener macros por porción
      const match = ok(await sb.rpc('buscar_alimentos', { q: item.nombre, limite: 1 })) as { id: number }[] | null;
      ok(await sb.from('despensa').upsert(
        { chat_id: id, nombre: item.nombre.trim().toLowerCase(), cantidad: item.cantidad || null, tipo: item.tipo, alimento_id: match?.[0]?.id ?? null },
        { onConflict: 'chat_id,nombre' },
      ));
    },
    async quitarDespensa(id) { ok(await sb.from('despensa').delete().eq('id', id)); },
    async productoPorCodigo(codigo) {
      const local = ok(await sb.from('alimentos').select('*').eq('codigo_barras', codigo).maybeSingle()) as
        (Omit<ProductoEscaneado, 'codigo' | 'imagen' | 'esSuplemento' | 'incompleto'> & { categoria: string }) | null;
      if (local) {
        return { ...local, codigo, imagen: null, esSuplemento: local.categoria === 'suplemento', incompleto: false,
          kcal_100: Number(local.kcal_100), proteina_100: Number(local.proteina_100), carbos_100: Number(local.carbos_100), grasas_100: Number(local.grasas_100) };
      }
      return buscarEnOpenFoodFacts(codigo);
    },
    async agregarProducto(p, { cantidad, tipo }) {
      const id = await miChat();
      let alimento = ok(await sb.from('alimentos').select('id').eq('codigo_barras', p.codigo).maybeSingle()) as { id: number } | null;
      if (!alimento) {
        alimento = ok(await sb.from('alimentos').insert({
          nombre: p.nombre, marca: p.marca, codigo_barras: p.codigo, categoria: tipo,
          kcal_100: p.kcal_100, proteina_100: p.proteina_100, carbos_100: p.carbos_100, grasas_100: p.grasas_100,
          porcion_nombre: p.porcion_nombre, porcion_g: p.porcion_g, fuente: 'off', creado_por: id,
        }).select('id').single()) as { id: number };
      }
      const nombre = (p.marca ? `${p.nombre} ${p.marca}` : p.nombre).trim().toLowerCase();
      ok(await sb.from('despensa').upsert(
        { chat_id: id, nombre, cantidad: cantidad || null, tipo, alimento_id: alimento.id },
        { onConflict: 'chat_id,nombre' },
      ));
    },
    escuchar(cb) {
      // Un solo canal compartido para toda la app; cada pantalla agrega/quita su oyente
      oyentes.add(cb);
      if (!canal) {
        canal = sb.channel(`cambios-${crypto.randomUUID()}`);
        for (const t of ['comidas', 'entrenamientos', 'despensa', 'usuarios'] as Tabla[]) {
          canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => oyentes.forEach((o) => o(t)));
        }
        canal.subscribe();
      }
      return () => { oyentes.delete(cb); };
    },
  };
}
