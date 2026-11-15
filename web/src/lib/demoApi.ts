import { calcularMetas, macrosDe } from '../../../lib/nutricion';
import { fechaAR, restarDias } from '../../../lib/fechas';
import { buscarEnOpenFoodFacts } from './openFoodFacts';
import type { Api, Comida, Entreno, ItemDespensa, Momento, Perfil, Tabla } from './types';

// Datos de ejemplo en memoria: sirven para ver la app sin Supabase (VITE_DEMO=1)

type Base = { kcal_100: number; proteina_100: number; carbos_100: number; grasas_100: number; porcion_nombre: string; porcion_g: number };
const A: Record<string, Base> = {
  avena: { kcal_100: 389, proteina_100: 17, carbos_100: 66, grasas_100: 7, porcion_nombre: '1/2 taza', porcion_g: 40 },
  leche: { kcal_100: 61, proteina_100: 3.2, carbos_100: 4.8, grasas_100: 3.3, porcion_nombre: '1 vaso', porcion_g: 250 },
  banana: { kcal_100: 89, proteina_100: 1.1, carbos_100: 23, grasas_100: 0.3, porcion_nombre: '1 unidad', porcion_g: 120 },
  milanesa: { kcal_100: 220, proteina_100: 22, carbos_100: 13, grasas_100: 9, porcion_nombre: '1 milanesa', porcion_g: 130 },
  papa: { kcal_100: 87, proteina_100: 1.9, carbos_100: 20, grasas_100: 0.1, porcion_nombre: '1 papa', porcion_g: 170 },
  medialuna: { kcal_100: 410, proteina_100: 8, carbos_100: 45, grasas_100: 22, porcion_nombre: '1 unidad', porcion_g: 40 },
  pollo: { kcal_100: 165, proteina_100: 31, carbos_100: 0, grasas_100: 3.6, porcion_nombre: '1 pechuga', porcion_g: 170 },
  arroz: { kcal_100: 130, proteina_100: 2.7, carbos_100: 28, grasas_100: 0.3, porcion_nombre: '1 taza', porcion_g: 160 },
  whey: { kcal_100: 400, proteina_100: 78, carbos_100: 8, grasas_100: 6, porcion_nombre: '1 scoop', porcion_g: 30 },
  huevo: { kcal_100: 143, proteina_100: 12.6, carbos_100: 0.7, grasas_100: 9.5, porcion_nombre: '1 unidad', porcion_g: 50 },
  creatina: { kcal_100: 0, proteina_100: 0, carbos_100: 0, grasas_100: 0, porcion_nombre: '1 dosis', porcion_g: 5 },
  atun: { kcal_100: 116, proteina_100: 26, carbos_100: 0, grasas_100: 1, porcion_nombre: '1 lata', porcion_g: 120 },
};

let seq = 100;
const hoy = () => fechaAR();

function comida(momento: Momento, descripcion: string, a: Base, gramos: number, hora: string): Comida {
  return { id: seq++, momento, descripcion, gramos, ...macrosDe(a, gramos), creado: `${hoy()}T${hora}:00-03:00` };
}

const datos = (() => {
  const base = { sexo: 'M' as const, edad: 23, peso_kg: 78, altura_cm: 178, actividad: 'moderado' as const, objetivo: 'subir' as const };
  const perfil: Perfil = { chat_id: 1, nombre: 'Agus', ...base, ...calcularMetas(base) };
  const comidas: Comida[] = [
    comida('desayuno', 'Avena con leche y banana', A.avena, 60, '08:40'),
    comida('desayuno', '1 vaso de leche', A.leche, 250, '08:41'),
    comida('desayuno', '1 banana', A.banana, 120, '08:41'),
    comida('almuerzo', '2 milanesas al horno', A.milanesa, 260, '13:15'),
    comida('almuerzo', 'Puré de papa', A.papa, 250, '13:16'),
    comida('merienda', '2 medialunas', A.medialuna, 80, '17:30'),
  ];
  const entrenos: Entreno[] = [
    { id: seq++, tipo: 'Pesas', descripcion: 'Piernas, intenso', duracion_min: 70, intensidad: 'alta', kcal_estimadas: 420 },
  ];
  const despensa: ItemDespensa[] = [
    ['pechuga de pollo', '1 kg', 'alimento', A.pollo],
    ['arroz', '1 paquete', 'alimento', A.arroz],
    ['huevos', 'media docena', 'alimento', A.huevo],
    ['avena', 'medio paquete', 'alimento', A.avena],
    ['bananas', '4', 'alimento', A.banana],
    ['atún', '3 latas', 'alimento', A.atun],
    ['leche', '1 l', 'alimento', A.leche],
    ['whey protein', 'medio pote', 'suplemento', A.whey],
    ['creatina', null, 'suplemento', A.creatina],
  ].map(([nombre, cantidad, tipo, alimento]) => ({
    id: seq++, nombre: nombre as string, cantidad: cantidad as string | null,
    tipo: tipo as ItemDespensa['tipo'], alimento: alimento as Base,
  }));
  return { perfil, comidas, entrenos, despensa };
})();

// Variación determinística para los días anteriores
function pseudo(fecha: string, sal: number) {
  let h = sal;
  for (const ch of fecha) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return (h % 1000) / 1000;
}

const oyentes = new Set<(t: Tabla) => void>();
const avisar = (t: Tabla) => setTimeout(() => oyentes.forEach((cb) => cb(t)), 0);
const espera = <T,>(v: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));

/** Simula que el usuario cargó algo desde Telegram (para mostrar el realtime) */
const simulaciones: [Momento, string, Base, number][] = [
  ['post_entreno', '1 scoop de whey', A.whey, 30],
  ['cena', 'Pechuga de pollo con arroz', A.pollo, 200],
  ['cena', 'Arroz blanco', A.arroz, 200],
  ['snack', '2 huevos duros', A.huevo, 100],
];
let simIdx = 0;
export function simularCargaTelegram(): string {
  const [m, d, a, g] = simulaciones[simIdx++ % simulaciones.length];
  const hora = new Date().toTimeString().slice(0, 5);
  datos.comidas.push(comida(m, d, a, g, hora));
  avisar('comidas');
  return d;
}

export const demoApi: Api = {
  modo: 'demo',
  perfil: () => espera(datos.perfil),
  async guardarPerfil(cambios) {
    Object.assign(datos.perfil, cambios);
    avisar('usuarios');
    return espera(datos.perfil, 500);
  },
  dia(fecha) {
    if (fecha === hoy()) return espera({ fecha, comidas: datos.comidas, entrenos: datos.entrenos });
    if (pseudo(fecha, 7) < 0.12) return espera({ fecha, comidas: [], entrenos: [] });
    const k = 1.05 + pseudo(fecha, 3) * 0.45;
    const lista: Comida[] = [
      { ...comida('desayuno', 'Avena', A.avena, Math.round(70 * k), '09:00') },
      { ...comida('desayuno', 'Leche', A.leche, Math.round(250 * k), '09:00') },
      { ...comida('desayuno', 'Banana', A.banana, 120, '09:00') },
      { ...comida('post_entreno', 'Whey', A.whey, 30, '19:30') },
      { ...comida('almuerzo', 'Pollo con arroz', A.pollo, Math.round(220 * k), '13:30') },
      { ...comida('almuerzo', 'Arroz', A.arroz, Math.round(250 * k), '13:30') },
      { ...comida('merienda', 'Tostadas con huevo', A.huevo, Math.round(120 * k), '17:45') },
      { ...comida('cena', 'Milanesas con puré', A.milanesa, Math.round(300 * k), '21:30') },
    ];
    return espera({ fecha, comidas: lista, entrenos: pseudo(fecha, 11) > 0.45 ? [{ ...datos.entrenos[0], id: seq++ }] : [] });
  },
  async semana(hasta) {
    const fechas = Array.from({ length: 7 }, (_, i) => restarDias(hasta, 6 - i));
    const todos = await Promise.all(fechas.map((f) => this.dia(f)));
    const dias = [];
    for (const d of todos) {
      const f = d.fecha;
      const s = (k: 'kcal' | 'proteina' | 'carbos' | 'grasas') => Math.round(d.comidas.reduce((a, c) => a + c[k], 0));
      dias.push({ fecha: f, registrado: d.comidas.length > 0, kcal: s('kcal'), proteina: s('proteina'), carbos: s('carbos'), grasas: s('grasas'), entrenos: d.entrenos.length });
    }
    return dias;
  },
  async borrarComida(id) { datos.comidas = datos.comidas.filter((c) => c.id !== id); avisar('comidas'); },
  async borrarEntreno(id) { datos.entrenos = datos.entrenos.filter((e) => e.id !== id); avisar('entrenamientos'); },
  despensa: () => espera(datos.despensa),
  async agregarDespensa({ nombre, cantidad, tipo }) {
    const n = nombre.trim().toLowerCase();
    const key = Object.keys(A).find((k) => n.includes(k) || k.includes(n));
    datos.despensa = datos.despensa.filter((i) => i.nombre !== n);
    datos.despensa.push({ id: seq++, nombre: n, cantidad: cantidad || null, tipo, alimento: key ? A[key] : null });
    avisar('despensa');
  },
  async quitarDespensa(id) { datos.despensa = datos.despensa.filter((i) => i.id !== id); avisar('despensa'); },
  productoPorCodigo: (codigo) => buscarEnOpenFoodFacts(codigo),
  async agregarProducto(p, { cantidad, tipo }) {
    const nombre = (p.marca ? `${p.nombre} ${p.marca}` : p.nombre).trim().toLowerCase();
    datos.despensa = datos.despensa.filter((i) => i.nombre !== nombre);
    datos.despensa.push({ id: seq++, nombre, cantidad: cantidad || null, tipo, alimento: p.porcion_g ? { ...p } : { ...p, porcion_nombre: '100 g', porcion_g: 100 } });
    avisar('despensa');
  },
  escuchar(cb) { oyentes.add(cb); return () => { oyentes.delete(cb); }; },
};
