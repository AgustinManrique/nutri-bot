import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { db, ok } from './db';
import { despensaComoTexto, verDespensa } from './despensa';
import { env } from './env';
import { diaSemana, fechaAR, horaAR } from './fechas';
import { obtenerUsuario, resumenDia } from './resumen';
import { declaraciones, ejecutarTool } from './tools';

const MAX_VUELTAS = 8;      // máximo de rondas de tool calling por mensaje
const HISTORIAL = 16;       // mensajes previos que se mandan como contexto

let ai: GoogleGenAI | null = null;
const cliente = () => (ai ??= new GoogleGenAI({ apiKey: env.geminiKey }));

async function armarSystemPrompt(chatId: number): Promise<string> {
  const [u, hoy, despensa] = await Promise.all([obtenerUsuario(chatId), resumenDia(chatId), verDespensa(chatId)]);
  const fecha = fechaAR();

  const perfil = u?.kcal_meta
    ? `Perfil: ${u.nombre ?? ''} · ${u.sexo} · ${u.edad} años · ${u.peso_kg} kg · ${u.altura_cm} cm · actividad ${u.actividad} · objetivo ${u.objetivo}
Metas diarias: ${u.kcal_meta} kcal · P ${u.proteina_meta} g · C ${u.carbos_meta} g · G ${u.grasas_meta} g
${u.notas ? `Notas: ${u.notas}` : ''}`
    : 'Perfil INCOMPLETO: todavía no hay metas. Pedile amablemente sexo, edad, peso, altura, nivel de actividad y objetivo (bajar/mantener/subir) y guardalos con actualizar_perfil.';

  const estadoHoy = hoy.metas
    ? `Hoy lleva: ${hoy.consumido.kcal} kcal · P ${hoy.consumido.proteina} · C ${hoy.consumido.carbos} · G ${hoy.consumido.grasas}. ` +
      `Le falta: ${hoy.faltante!.kcal} kcal · P ${hoy.faltante!.proteina} · C ${hoy.faltante!.carbos} · G ${hoy.faltante!.grasas}. ` +
      `${hoy.entrenamientos.length ? `Entrenó hoy: ${hoy.entrenamientos.map((e) => e.tipo).join(', ')}.` : 'No registró entrenamiento hoy.'}`
    : `Hoy lleva: ${hoy.consumido.kcal} kcal.`;

  return `Sos el asistente nutricional personal del usuario. Hablás en español rioplatense, cercano y directo, como un coach que sabe.
Fecha: ${diaSemana(fecha)} ${fecha}, hora ${horaAR()} (Argentina).

${perfil}

${estadoHoy}

Despensa actual:
${despensaComoTexto(despensa)}

CÓMO TRABAJÁS
- Cuando el usuario cuenta lo que comió: para cada cosa llamá buscar_alimento, elegí el mejor match y registrá con registrar_comida (gramos = porciones × porcion_g). Si no existe, crealo con crear_alimento con valores realistas y aclarale que es una estimación.
- Si no dice cantidad, asumí una porción típica y decilo ("tomé 1 porción de ~150 g, avisame si fue más"). Preguntá solo si es muy ambiguo.
- Si manda una foto de un plato, identificá los alimentos y estimá gramos; registralo y aclarale la estimación para que corrija.
- Nunca inventes números de calorías: siempre salen de la base (buscar/crear alimento) o de las tools.
- Si la foto es una captura del resumen de un reloj o app de salud (Samsung Health, Mi Fitness, Garmin, Strava, etc.), NO es comida: leé tipo de actividad, duración, kcal y fecha/hora de la captura y registralo con registrar_entrenamiento usando esas kcal tal cual (no las estimes). Si la captura muestra varios entrenamientos, registralos todos. Confirmá en una línea lo que cargaste.
- Entrenamientos: registralos con registrar_entrenamiento estimando kcal. Las kcal del entrenamiento son informativas: las metas ya contemplan su nivel de actividad, así que NO las sumes al presupuesto diario salvo que el usuario lo pida.
- Despensa: si te cuenta qué tiene en la alacena/heladera o qué suplementos usa, guardalo con actualizar_despensa (vinculá alimento_id cuando lo encuentres). Si dice que algo se terminó, quitalo.
- Para "¿qué como?" o "¿cómo cierro el día?": usá opciones_para_cerrar_dia y armá 1-3 opciones concretas con cantidades usando lo que TIENE, priorizando lo que más le falta (normalmente proteína). Mostrá cómo quedaría el día con cada opción.
- Suplementos: si tiene whey/caseína/etc. y le falta proteína a la tarde-noche, sugerí usarlo con la dosis concreta (ej: "1 scoop = 23 g de proteína"). La creatina no aporta macros; si la tiene, recordale tomarla si no lo hizo.
- Después de registrar algo, cerrá con una línea de cómo va el día (kcal y proteína vs meta).
- Correcciones ("no eran 2, era 1"): buscá el id con resumen_dia, borrá y volvé a registrar.

ESTILO
- Respuestas cortas, aptas para chat de celular. Texto plano, sin markdown (nada de **, #, tablas). Emojis con moderación.
- Sos orientativo, no reemplazás a un nutricionista o médico. Si menciona síntomas, lesiones o condiciones médicas, sugerí consultar a un profesional.`;
}

async function cargarHistorial(chatId: number): Promise<Content[]> {
  const data = ok(
    await db().from('mensajes').select('rol, texto').eq('chat_id', chatId).order('creado', { ascending: false }).limit(HISTORIAL),
    'historial',
  ) ?? [];
  const contents: Content[] = data.reverse().map((m) => ({ role: m.rol, parts: [{ text: m.texto }] }));
  while (contents.length && contents[0].role !== 'user') contents.shift();
  return contents;
}

async function guardarMensajes(chatId: number, textoUsuario: string, textoModelo: string) {
  ok(
    await db().from('mensajes').insert([
      { chat_id: chatId, rol: 'user', texto: textoUsuario },
      { chat_id: chatId, rol: 'model', texto: textoModelo },
    ]),
    'guardarMensajes',
  );
}

/**
 * Procesa un mensaje del usuario: arma contexto, corre el loop de tool calling y devuelve la respuesta final.
 * @param partes  partes para Gemini (texto, imagen, audio)
 * @param textoHistorial  versión en texto para guardar en el historial (ej: "[foto] mi almuerzo")
 */
export async function responder(chatId: number, partes: Part[], textoHistorial: string): Promise<string> {
  const [systemInstruction, historial] = await Promise.all([armarSystemPrompt(chatId), cargarHistorial(chatId)]);
  const contents: Content[] = [...historial, { role: 'user', parts: partes }];

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const resp = await cliente().models.generateContent({
      model: env.geminiModel,
      contents,
      config: { systemInstruction, tools: [{ functionDeclarations: declaraciones }] },
    });

    const llamadas = resp.functionCalls ?? [];
    if (!llamadas.length) {
      const texto = resp.text?.trim() || 'Mmm, no supe qué responder. ¿Me lo repetís?';
      await guardarMensajes(chatId, textoHistorial, texto);
      return texto;
    }

    // Devolvemos el turno del modelo tal cual (preserva thought signatures) y luego los resultados
    const contenidoModelo = resp.candidates?.[0]?.content;
    if (contenidoModelo) contents.push(contenidoModelo);

    const resultados: Part[] = [];
    for (const llamada of llamadas) {
      const salida = await ejecutarTool(llamada.name!, (llamada.args ?? {}) as Record<string, unknown>, chatId);
      console.log(`[tool] ${llamada.name}`, JSON.stringify(llamada.args), '→', JSON.stringify(salida).slice(0, 300));
      resultados.push({ functionResponse: { id: llamada.id, name: llamada.name, response: salida } });
    }
    contents.push({ role: 'user', parts: resultados });
  }

  const texto = 'Me enredé procesando eso 😅. ¿Me lo pasás de nuevo, más simple?';
  await guardarMensajes(chatId, textoHistorial, texto);
  return texto;
}
