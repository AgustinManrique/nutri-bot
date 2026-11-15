import { Type, type FunctionDeclaration } from '@google/genai';
import { db, ok } from './db';
import { actualizarDespensa, verDespensa, type ItemNuevo } from './despensa';
import { fechaAR } from './fechas';
import { calcularMetas, macrosDe, type DatosCorporales } from './nutricion';
import { obtenerUsuario, resumenDia, resumenSemana } from './resumen';

const FECHA = { type: Type.STRING, description: 'YYYY-MM-DD. Omitir si es hoy.' };

export const declaraciones: FunctionDeclaration[] = [
  {
    name: 'actualizar_perfil',
    description:
      'Guarda o actualiza datos del usuario (peso, altura, objetivo, etc.) y recalcula sus metas diarias. ' +
      'Pasá solo los campos que cambian. Si el usuario dicta metas exactas, pasalas en los campos *_meta.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING },
        sexo: { type: Type.STRING, enum: ['M', 'F'] },
        edad: { type: Type.INTEGER },
        peso_kg: { type: Type.NUMBER },
        altura_cm: { type: Type.NUMBER },
        actividad: { type: Type.STRING, enum: ['sedentario', 'ligero', 'moderado', 'alto', 'muy_alto'] },
        objetivo: { type: Type.STRING, enum: ['bajar', 'mantener', 'subir'] },
        notas: { type: Type.STRING, description: 'Preferencias, cosas que no come, horarios, etc.' },
        kcal_meta: { type: Type.INTEGER },
        proteina_meta: { type: Type.INTEGER },
        carbos_meta: { type: Type.INTEGER },
        grasas_meta: { type: Type.INTEGER },
      },
    },
  },
  {
    name: 'buscar_alimento',
    description: 'Busca un alimento en la base y devuelve sus macros cada 100 g y su porción típica. Usalo SIEMPRE antes de registrar.',
    parameters: {
      type: Type.OBJECT,
      properties: { consulta: { type: Type.STRING, description: 'Nombre simple, ej: "empanada", "whey", "arroz"' } },
      required: ['consulta'],
    },
  },
  {
    name: 'crear_alimento',
    description:
      'Agrega un alimento que NO está en la base, con valores estimados cada 100 g. ' +
      'Usalo solo si buscar_alimento no encontró nada razonable.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING },
        alias: { type: Type.ARRAY, items: { type: Type.STRING } },
        categoria: { type: Type.STRING, enum: ['alimento', 'bebida', 'suplemento'] },
        kcal_100: { type: Type.NUMBER },
        proteina_100: { type: Type.NUMBER },
        carbos_100: { type: Type.NUMBER },
        grasas_100: { type: Type.NUMBER },
        porcion_nombre: { type: Type.STRING },
        porcion_g: { type: Type.NUMBER },
      },
      required: ['nombre', 'kcal_100', 'proteina_100', 'carbos_100', 'grasas_100'],
    },
  },
  {
    name: 'registrar_comida',
    description: 'Registra lo que comió el usuario. Cada item referencia un alimento_id existente y los gramos consumidos.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        momento: { type: Type.STRING, enum: ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack', 'pre_entreno', 'post_entreno'] },
        fecha: FECHA,
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              alimento_id: { type: Type.INTEGER },
              gramos: { type: Type.NUMBER },
              descripcion: { type: Type.STRING, description: 'Cómo lo dijo el usuario, ej: "2 empanadas de carne"' },
            },
            required: ['alimento_id', 'gramos', 'descripcion'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'registrar_entrenamiento',
    description: 'Registra un entrenamiento. Estimá kcal_estimadas según tipo, duración, intensidad y peso del usuario.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tipo: { type: Type.STRING, description: 'pesas, running, fútbol, bici, natación, etc.' },
        descripcion: { type: Type.STRING },
        duracion_min: { type: Type.INTEGER },
        intensidad: { type: Type.STRING, enum: ['baja', 'media', 'alta'] },
        kcal_estimadas: { type: Type.INTEGER },
        fecha: FECHA,
      },
      required: ['tipo'],
    },
  },
  {
    name: 'borrar_registro',
    description: 'Borra una comida o entrenamiento mal cargado (usá los id que devuelve resumen_dia).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tipo: { type: Type.STRING, enum: ['comida', 'entrenamiento'] },
        id: { type: Type.INTEGER },
      },
      required: ['tipo', 'id'],
    },
  },
  {
    name: 'resumen_dia',
    description: 'Devuelve metas, consumido, faltante y detalle (con ids) de comidas y entrenamientos de un día.',
    parameters: { type: Type.OBJECT, properties: { fecha: FECHA } },
  },
  {
    name: 'resumen_semana',
    description: 'Totales por día de los últimos 7 días y promedio.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'actualizar_despensa',
    description:
      'Actualiza lo que el usuario tiene en alacena/heladera y sus suplementos. ' +
      'Usá vaciar_antes=true cuando el usuario pasa la lista completa de lo que tiene ahora (no borra suplementos). ' +
      'Si podés, vinculá cada item con un alimento_id (buscalo antes).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        agregar: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              cantidad: { type: Type.STRING, description: 'Libre: "1 kg", "media docena", "poco"' },
              tipo: { type: Type.STRING, enum: ['alimento', 'suplemento'] },
              alimento_id: { type: Type.INTEGER },
            },
            required: ['nombre'],
          },
        },
        quitar: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nombres de items que se terminaron' },
        vaciar_antes: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: 'opciones_para_cerrar_dia',
    description:
      'Devuelve lo que le falta al usuario para sus metas de hoy junto con su despensa (con macros por porción cuando se conocen). ' +
      'Usalo para sugerir qué comer o qué suplemento tomar para cerrar el día.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

type Args = Record<string, unknown>;

export async function ejecutarTool(nombre: string, args: Args, chatId: number): Promise<Record<string, unknown>> {
  try {
    switch (nombre) {
      case 'actualizar_perfil': return await actualizarPerfil(chatId, args);
      case 'buscar_alimento': {
        const data = ok(await db().rpc('buscar_alimentos', { q: String(args.consulta), limite: 6 }), 'buscar');
        return { resultados: data ?? [], nota: (data ?? []).length ? undefined : 'Sin resultados: considerá crear_alimento.' };
      }
      case 'crear_alimento': {
        const fila = { ...args, alias: args.alias ?? [], fuente: 'estimado_ia', creado_por: chatId };
        const data = ok(await db().from('alimentos').insert(fila).select().single(), 'crear_alimento');
        return { creado: data };
      }
      case 'registrar_comida': return await registrarComida(chatId, args);
      case 'registrar_entrenamiento': {
        const fila = { chat_id: chatId, fecha: (args.fecha as string) || fechaAR(), ...args };
        const data = ok(await db().from('entrenamientos').insert(fila).select().single(), 'registrar_entrenamiento');
        return { registrado: data };
      }
      case 'borrar_registro': {
        const tabla = args.tipo === 'comida' ? 'comidas' : 'entrenamientos';
        ok(await db().from(tabla).delete().eq('chat_id', chatId).eq('id', Number(args.id)), 'borrar');
        return { borrado: true, resumen_hoy: await resumenDia(chatId) };
      }
      case 'resumen_dia': return await resumenDia(chatId, (args.fecha as string) || fechaAR());
      case 'resumen_semana': return await resumenSemana(chatId);
      case 'actualizar_despensa': {
        const despensa = await actualizarDespensa(chatId, {
          agregar: (args.agregar as ItemNuevo[]) ?? [],
          quitar: (args.quitar as string[]) ?? [],
          vaciar_antes: Boolean(args.vaciar_antes),
        });
        return { despensa };
      }
      case 'opciones_para_cerrar_dia': {
        const [r, despensa] = await Promise.all([resumenDia(chatId), verDespensa(chatId)]);
        const items = despensa.map((i) => ({
          nombre: i.nombre,
          tipo: i.tipo,
          cantidad: i.cantidad,
          por_porcion: i.alimentos?.porcion_g
            ? { porcion: i.alimentos.porcion_nombre, gramos: i.alimentos.porcion_g, ...macrosDe(i.alimentos, Number(i.alimentos.porcion_g)) }
            : null,
        }));
        return { faltante: r.faltante, consumido: r.consumido, metas: r.metas, despensa: items };
      }
      default:
        return { error: `Tool desconocida: ${nombre}` };
    }
  } catch (e) {
    console.error(`[tool ${nombre}]`, e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function actualizarPerfil(chatId: number, args: Args) {
  const actual = await obtenerUsuario(chatId);
  const merged = { ...actual, ...args } as Record<string, unknown>;
  const cambios: Record<string, unknown> = { ...args, actualizado: new Date().toISOString() };

  const completos = ['sexo', 'edad', 'peso_kg', 'altura_cm', 'actividad', 'objetivo'].every((k) => merged[k] != null);
  let calculo: ReturnType<typeof calcularMetas> | null = null;
  const metasManuales = ['kcal_meta', 'proteina_meta', 'carbos_meta', 'grasas_meta'].some((k) => args[k] != null);

  if (completos && !metasManuales) {
    calculo = calcularMetas({
      sexo: merged.sexo, edad: Number(merged.edad), peso_kg: Number(merged.peso_kg),
      altura_cm: Number(merged.altura_cm), actividad: merged.actividad, objetivo: merged.objetivo,
    } as DatosCorporales);
    Object.assign(cambios, {
      kcal_meta: calculo.kcal_meta, proteina_meta: calculo.proteina_meta,
      carbos_meta: calculo.carbos_meta, grasas_meta: calculo.grasas_meta,
    });
  }

  const data = ok(
    await db().from('usuarios').upsert({ chat_id: chatId, ...cambios }, { onConflict: 'chat_id' }).select().single(),
    'actualizar_perfil',
  );
  const faltan = ['sexo', 'edad', 'peso_kg', 'altura_cm', 'actividad', 'objetivo'].filter((k) => merged[k] == null);
  return { perfil: data, calculo, faltan_datos: faltan.length ? faltan : undefined };
}

async function registrarComida(chatId: number, args: Args) {
  const items = (args.items as { alimento_id: number; gramos: number; descripcion: string }[]) ?? [];
  if (!items.length) return { error: 'No hay items' };

  const ids = [...new Set(items.map((i) => Number(i.alimento_id)))];
  const alimentos = ok(await db().from('alimentos').select('*').in('id', ids), 'registrar_comida.alimentos') ?? [];
  const porId = new Map(alimentos.map((a) => [Number(a.id), a]));

  const faltantes = ids.filter((id) => !porId.has(id));
  if (faltantes.length) return { error: `alimento_id inexistente: ${faltantes.join(', ')}. Buscalo o crealo primero.` };

  const fecha = (args.fecha as string) || fechaAR();
  const filas = items.map((i) => ({
    chat_id: chatId,
    fecha,
    momento: (args.momento as string) ?? null,
    descripcion: i.descripcion,
    alimento_id: Number(i.alimento_id),
    gramos: Number(i.gramos),
    ...macrosDe(porId.get(Number(i.alimento_id))!, Number(i.gramos)),
  }));
  const insertadas = ok(await db().from('comidas').insert(filas).select('id, descripcion, gramos, kcal, proteina, carbos, grasas'), 'registrar_comida');
  const r = await resumenDia(chatId, fecha);
  return { registrado: insertadas, consumido_hoy: r.consumido, faltante_hoy: r.faltante, metas: r.metas };
}
