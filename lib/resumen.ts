import { db, ok } from './db';
import { diaSemana, fechaAR, restarDias } from './fechas';
import { sumar, type Macros } from './nutricion';

export interface Usuario {
  chat_id: number;
  nombre: string | null;
  sexo: 'M' | 'F' | null;
  edad: number | null;
  peso_kg: number | null;
  altura_cm: number | null;
  actividad: string | null;
  objetivo: string | null;
  kcal_meta: number | null;
  proteina_meta: number | null;
  carbos_meta: number | null;
  grasas_meta: number | null;
  notas: string | null;
}

export async function obtenerUsuario(chatId: number): Promise<Usuario | null> {
  const data = ok(await db().from('usuarios').select('*').eq('chat_id', chatId).maybeSingle(), 'obtenerUsuario');
  return data as Usuario | null;
}

export function tieneMetas(u: Usuario | null): u is Usuario & { kcal_meta: number } {
  return !!u?.kcal_meta;
}

export async function resumenDia(chatId: number, fecha: string = fechaAR()) {
  const [usuario, comidas, entrenos] = await Promise.all([
    obtenerUsuario(chatId),
    db().from('comidas').select('id, momento, descripcion, gramos, kcal, proteina, carbos, grasas')
      .eq('chat_id', chatId).eq('fecha', fecha).order('creado'),
    db().from('entrenamientos').select('id, tipo, descripcion, duracion_min, intensidad, kcal_estimadas')
      .eq('chat_id', chatId).eq('fecha', fecha).order('creado'),
  ]);
  const listaComidas = ok(comidas, 'resumenDia.comidas') ?? [];
  const listaEntrenos = ok(entrenos, 'resumenDia.entrenos') ?? [];

  const consumido = sumar(listaComidas as Macros[]);
  const metas = tieneMetas(usuario)
    ? { kcal: usuario.kcal_meta, proteina: usuario.proteina_meta!, carbos: usuario.carbos_meta!, grasas: usuario.grasas_meta! }
    : null;
  const faltante = metas
    ? {
        kcal: metas.kcal - consumido.kcal,
        proteina: Math.round((metas.proteina - consumido.proteina) * 10) / 10,
        carbos: Math.round((metas.carbos - consumido.carbos) * 10) / 10,
        grasas: Math.round((metas.grasas - consumido.grasas) * 10) / 10,
      }
    : null;

  return { fecha, metas, consumido, faltante, comidas: listaComidas, entrenamientos: listaEntrenos };
}

export type ResumenDia = Awaited<ReturnType<typeof resumenDia>>;

export async function resumenSemana(chatId: number) {
  const hoy = fechaAR();
  const desde = restarDias(hoy, 6);
  const [comidas, entrenos, usuario] = await Promise.all([
    db().from('comidas').select('fecha, kcal, proteina, carbos, grasas').eq('chat_id', chatId).gte('fecha', desde),
    db().from('entrenamientos').select('fecha, tipo, duracion_min').eq('chat_id', chatId).gte('fecha', desde),
    obtenerUsuario(chatId),
  ]);
  const cs = ok(comidas, 'resumenSemana.comidas') ?? [];
  const es = ok(entrenos, 'resumenSemana.entrenos') ?? [];

  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const f = restarDias(hoy, i);
    const delDia = cs.filter((c) => c.fecha === f) as Macros[];
    dias.push({
      fecha: f,
      dia: diaSemana(f),
      registrado: delDia.length > 0,
      ...sumar(delDia),
      entrenamientos: es.filter((e) => e.fecha === f).map((e) => `${e.tipo} ${e.duracion_min ?? '?'}min`),
    });
  }
  const conRegistro = dias.filter((d) => d.registrado);
  const promedio = conRegistro.length
    ? {
        kcal: Math.round(conRegistro.reduce((a, d) => a + d.kcal, 0) / conRegistro.length),
        proteina: Math.round(conRegistro.reduce((a, d) => a + d.proteina, 0) / conRegistro.length),
      }
    : null;
  return {
    metas: tieneMetas(usuario) ? { kcal: usuario.kcal_meta, proteina: usuario.proteina_meta } : null,
    promedio_dias_registrados: promedio,
    dias,
  };
}

function barra(actual: number, meta: number): string {
  const pct = meta > 0 ? Math.min(actual / meta, 1) : 0;
  const llenos = Math.round(pct * 10);
  return '▓'.repeat(llenos) + '░'.repeat(10 - llenos) + ` ${Math.round((actual / (meta || 1)) * 100)}%`;
}

/** Resumen en texto plano para /hoy (sin pasar por el LLM) */
export function formatearResumen(r: ResumenDia): string {
  const c = r.consumido;
  if (!r.metas) {
    return `📅 ${r.fecha}\nConsumido: ${c.kcal} kcal · P ${c.proteina}g · C ${c.carbos}g · G ${c.grasas}g\n\n(Todavía no tengo tus metas: contame peso, altura, edad, sexo, actividad y objetivo.)`;
  }
  const m = r.metas;
  const lineas = [
    `📅 Hoy (${r.fecha})`,
    `🔥 ${c.kcal} / ${m.kcal} kcal  ${barra(c.kcal, m.kcal)}`,
    `🥩 P ${c.proteina} / ${m.proteina} g  ${barra(c.proteina, m.proteina)}`,
    `🍚 C ${c.carbos} / ${m.carbos} g  ${barra(c.carbos, m.carbos)}`,
    `🥑 G ${c.grasas} / ${m.grasas} g  ${barra(c.grasas, m.grasas)}`,
  ];
  if (r.comidas.length) {
    lineas.push('', 'Comidas:');
    for (const x of r.comidas) lineas.push(`• ${x.momento ?? ''} ${x.descripcion ?? ''} — ${Math.round(Number(x.kcal))} kcal`.replace(/\s+/g, ' '));
  }
  if (r.entrenamientos.length) {
    lineas.push('', 'Entrenamiento:');
    for (const e of r.entrenamientos) lineas.push(`• ${e.tipo} ${e.duracion_min ?? '?'} min${e.kcal_estimadas ? ` (~${e.kcal_estimadas} kcal)` : ''}`);
  }
  return lineas.join('\n');
}
