import { Dumbbell } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { fechaAR } from '../../../lib/fechas';
import { Numero } from '../components/Numero';
import { useDatos } from '../lib/contexto';
import { diaCorto, fechaLarga, num } from '../lib/formato';
import type { DiaResumen } from '../lib/types';
import { COLOR_MACRO, ease, fadeUp, pop, spring, springSuave, stagger } from '../motion/presets';

const ALTO = 220; // px del área de barras

export function Semana() {
  const hoy = fechaAR();
  const perfil = useDatos((a) => a.perfil(), [], ['usuarios'], 'perfil');
  const semana = useDatos((a) => a.semana(hoy), [hoy], ['comidas', 'entrenamientos'], `semana-${hoy}`);
  const [sel, setSel] = useState<string | null>(null);

  const metaKcal = perfil.data?.kcal_meta ?? 0;
  const metaP = perfil.data?.proteina_meta ?? 0;
  const dias = semana.data ?? [];
  const escala = Math.max(metaKcal * 1.2, ...dias.map((d) => d.kcal), 1);

  const stats = useMemo(() => {
    const reg = dias.filter((d) => d.registrado);
    const prom = (k: 'kcal' | 'proteina') => (reg.length ? reg.reduce((a, d) => a + d[k], 0) / reg.length : 0);
    const enMeta = reg.filter((d) => Math.abs(d.kcal - metaKcal) <= metaKcal * 0.1 && d.proteina >= metaP * 0.9).length;
    return { kcal: prom('kcal'), proteina: prom('proteina'), enMeta, registrados: reg.length, entrenos: dias.reduce((a, d) => a + d.entrenos, 0) };
  }, [dias, metaKcal, metaP]);

  const diaSel = dias.find((d) => d.fecha === sel) ?? null;

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.header variants={fadeUp}>
        <p className="text-sm font-medium text-tinta-suave">Últimos 7 días</p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Tu semana</h1>
      </motion.header>

      <motion.div variants={stagger(0.06)} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat titulo="Promedio diario" valor={stats.kcal} unidad="kcal" sub={metaKcal ? `meta ${num(metaKcal)}` : undefined} />
        <Stat titulo="Proteína promedio" valor={stats.proteina} unidad="g" sub={metaP ? `meta ${metaP} g` : undefined} acento="salmon" />
        <Stat titulo="Días en meta" valor={stats.enMeta} unidad={`/ ${stats.registrados}`} sub="kcal ±10% y proteína" acento="celeste" />
        <Stat titulo="Entrenamientos" valor={stats.entrenos} unidad="" sub="esta semana" />
      </motion.div>

      <motion.section variants={fadeUp} className="card p-5 sm:p-7" aria-label="Calorías por día">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Calorías y de dónde vienen</h2>
          <Leyenda />
        </div>

        {!semana.data ? (
          <div className="skeleton h-[300px]" />
        ) : (
          <div className="relative">
            {/* Línea de meta */}
            {metaKcal > 0 && (
              <motion.div
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-tinta/25"
                style={{ bottom: 56 + (metaKcal / escala) * ALTO }}
                initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease, delay: 0.2 }}
              >
                <span className="absolute -top-3 right-0 rounded-full bg-base px-2 text-[11px] font-semibold text-tinta-suave shadow-suave">meta {num(metaKcal)}</span>
              </motion.div>
            )}

            <motion.ul variants={stagger(0.07)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
              className="grid grid-cols-7 items-end gap-2 sm:gap-4">
              {dias.map((d) => (
                <Columna key={d.fecha} d={d} escala={escala} metaP={metaP} esHoy={d.fecha === hoy}
                  activo={sel === d.fecha} onClick={() => setSel(sel === d.fecha ? null : d.fecha)} />
              ))}
            </motion.ul>
          </div>
        )}

        <AnimatePresence mode="wait">
          {diaSel && (
            <motion.div key={diaSel.fecha} {...pop} className="mt-5 rounded-2xl bg-crema p-4">
              <p className="font-semibold first-letter:uppercase">{fechaLarga(diaSel.fecha)}</p>
              {diaSel.registrado ? (
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave">
                  <span><b className="num text-tinta">{num(diaSel.kcal)}</b> kcal</span>
                  <span className="text-salmon-800">P <b className="num">{diaSel.proteina}</b> g</span>
                  <span className="text-celeste-800">C <b className="num">{diaSel.carbos}</b> g</span>
                  <span className="text-ambar-700">G <b className="num">{diaSel.grasas}</b> g</span>
                  {diaSel.entrenos > 0 && <span className="flex items-center gap-1"><Dumbbell className="size-3.5" /> entrenó</span>}
                </p>
              ) : (
                <p className="mt-1 text-sm text-tinta-suave">Sin registros ese día.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}

function Columna({ d, escala, metaP, esHoy, activo, onClick }: { d: DiaResumen; escala: number; metaP: number; esHoy: boolean; activo: boolean; onClick: () => void }) {
  // Composición de la barra en kcal por macro
  const kP = d.proteina * 4, kC = d.carbos * 4, kG = d.grasas * 9;
  const totalMacro = kP + kC + kG || 1;
  const pct = d.kcal / escala;
  const pP = metaP ? Math.min(d.proteina / metaP, 1) : 0;

  return (
    <motion.li variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="flex flex-col items-center">
      <button onClick={onClick} aria-pressed={activo} aria-label={`${fechaLarga(d.fecha)}: ${num(d.kcal)} kcal`}
        className="group flex w-full flex-col items-center">
        <div className="relative flex w-full max-w-[56px] items-end" style={{ height: ALTO }}>
          {d.registrado ? (
            <motion.div
              className={`flex w-full flex-col-reverse overflow-hidden rounded-xl ring-offset-2 transition-shadow ${activo ? 'ring-2 ring-tinta/70' : ''}`}
              style={{ height: ALTO * pct, originY: 1 }}
              variants={{ hidden: { scaleY: 0 }, show: { scaleY: 1, transition: springSuave } }}
              whileHover={{ scaleY: 1.02 }}
            >
              <div style={{ flexGrow: kP / totalMacro, background: COLOR_MACRO.proteina.trazo }} />
              <div style={{ flexGrow: kC / totalMacro, background: COLOR_MACRO.carbos.trazo }} />
              <div style={{ flexGrow: kG / totalMacro, background: COLOR_MACRO.grasas.trazo }} />
            </motion.div>
          ) : (
            <div className="h-10 w-full rounded-xl border-2 border-dashed border-tinta/15" title="Sin registros" />
          )}
        </div>

        {/* Mini anillo de proteína: ¿llegaste a tu meta ese día? */}
        <svg viewBox="0 0 24 24" className="mt-2 size-6 -rotate-90" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke={COLOR_MACRO.proteina.pista} strokeWidth="4" />
          <motion.circle cx="12" cy="12" r="9" fill="none" stroke={COLOR_MACRO.proteina.trazo} strokeWidth="4" strokeLinecap="round"
            variants={{ hidden: { pathLength: 0 }, show: { pathLength: pP, transition: { ...springSuave, delay: 0.25 } } }}
            style={{ opacity: pP > 0 ? 1 : 0 }} />
        </svg>
        <span className={`mt-1 flex h-5 items-center text-xs font-semibold capitalize ${esHoy ? 'rounded-full bg-tinta px-2 text-white' : 'text-tinta-suave'}`}>
          {esHoy ? 'hoy' : diaCorto(d.fecha)}
        </span>
      </button>
    </motion.li>
  );
}

function Stat({ titulo, valor, unidad, sub, acento }: { titulo: string; valor: number; unidad: string; sub?: string; acento?: 'salmon' | 'celeste' }) {
  const color = acento === 'salmon' ? 'text-salmon-800' : acento === 'celeste' ? 'text-celeste-800' : 'text-tinta';
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -3, transition: spring }} className="card p-4 sm:p-5">
      <p className="text-xs font-semibold text-tinta-suave">{titulo}</p>
      <p className="mt-1.5">
        <Numero valor={valor} className={`num text-3xl font-bold ${color}`} />
        <span className="ml-1 text-sm text-tinta-suave">{unidad}</span>
      </p>
      {sub && <p className="mt-0.5 text-xs text-tinta-suave">{sub}</p>}
    </motion.div>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs font-medium text-tinta-suave">
      {(['proteina', 'carbos', 'grasas'] as const).map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: COLOR_MACRO[m].trazo }} />
          {m === 'proteina' ? 'Proteína' : m === 'carbos' ? 'Carbos' : 'Grasas'}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <svg viewBox="0 0 12 12" className="size-3 -rotate-90"><circle cx="6" cy="6" r="4.5" fill="none" stroke={COLOR_MACRO.proteina.trazo} strokeWidth="2.5" /></svg>
        meta de proteína
      </li>
    </ul>
  );
}
