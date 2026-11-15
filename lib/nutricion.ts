export type Sexo = 'M' | 'F';
export type Actividad = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';
export type Objetivo = 'bajar' | 'mantener' | 'subir';

export interface DatosCorporales {
  sexo: Sexo;
  edad: number;
  peso_kg: number;
  altura_cm: number;
  actividad: Actividad;
  objetivo: Objetivo;
}

export interface Metas {
  kcal_meta: number;
  proteina_meta: number;
  carbos_meta: number;
  grasas_meta: number;
}

export interface Macros {
  kcal: number;
  proteina: number;
  carbos: number;
  grasas: number;
}

const FACTOR_ACTIVIDAD: Record<Actividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  bajar: 0.85,    // déficit ~15%
  mantener: 1,
  subir: 1.1,     // superávit ~10%
};

/** Mifflin-St Jeor → TDEE → metas de macros */
export function calcularMetas(p: DatosCorporales): Metas & { tdee: number; tmb: number } {
  const tmb = 10 * p.peso_kg + 6.25 * p.altura_cm - 5 * p.edad + (p.sexo === 'M' ? 5 : -161);
  const tdee = tmb * FACTOR_ACTIVIDAD[p.actividad];
  const kcal = Math.round((tdee * AJUSTE_OBJETIVO[p.objetivo]) / 10) * 10;

  const proteinaPorKg = p.objetivo === 'mantener' ? 1.6 : 2.0;
  const proteina = Math.round(p.peso_kg * proteinaPorKg);
  const grasas = Math.round((kcal * 0.25) / 9);
  const carbos = Math.max(0, Math.round((kcal - proteina * 4 - grasas * 9) / 4));

  return {
    tmb: Math.round(tmb),
    tdee: Math.round(tdee),
    kcal_meta: kcal,
    proteina_meta: proteina,
    carbos_meta: carbos,
    grasas_meta: grasas,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface AlimentoBase {
  kcal_100: number | string;
  proteina_100: number | string;
  carbos_100: number | string;
  grasas_100: number | string;
}

export function macrosDe(a: AlimentoBase, gramos: number): Macros {
  const f = gramos / 100;
  return {
    kcal: Math.round(Number(a.kcal_100) * f),
    proteina: r1(Number(a.proteina_100) * f),
    carbos: r1(Number(a.carbos_100) * f),
    grasas: r1(Number(a.grasas_100) * f),
  };
}

export function sumar(lista: Macros[]): Macros {
  const t = lista.reduce(
    (acc, m) => ({
      kcal: acc.kcal + Number(m.kcal),
      proteina: acc.proteina + Number(m.proteina),
      carbos: acc.carbos + Number(m.carbos),
      grasas: acc.grasas + Number(m.grasas),
    }),
    { kcal: 0, proteina: 0, carbos: 0, grasas: 0 },
  );
  return { kcal: Math.round(t.kcal), proteina: r1(t.proteina), carbos: r1(t.carbos), grasas: r1(t.grasas) };
}
