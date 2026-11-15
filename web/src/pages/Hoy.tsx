import { Check, ChevronLeft, ChevronRight, Dumbbell, Send, Sparkles, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { fechaAR, restarDias } from '../../../lib/fechas';
import { macrosDe } from '../../../lib/nutricion';
import { Numero } from '../components/Numero';
import { Plato } from '../components/Plato';
import { useApi, useDatos, useToast } from '../lib/contexto';
import { fechaLarga, horaDe, MOMENTOS, num, saludo } from '../lib/formato';
import type { Comida, ItemDespensa } from '../lib/types';
import { COLOR_MACRO, ETIQUETA_MACRO, ease, fadeUp, spring, stagger, type Macro } from '../motion/presets';

const BOT = import.meta.env.VITE_BOT_USERNAME as string | undefined;

export function Hoy() {
  const api = useApi();
  const { avisar } = useToast();
  const hoy = fechaAR();
  const [fecha, setFecha] = useState(hoy);
  const [dir, setDir] = useState(0);

  const perfil = useDatos((a) => a.perfil(), [], ['usuarios'], 'perfil');
  const dia = useDatos((a) => a.dia(fecha), [fecha], ['comidas', 'entrenamientos'], `dia-${fecha}`);
  const despensa = useDatos((a) => a.despensa(), [], ['despensa'], 'despensa');

  const totales = useMemo(() => {
    const cs = dia.data?.comidas ?? [];
    const s = (k: keyof Pick<Comida, 'kcal' | 'proteina' | 'carbos' | 'grasas'>) => cs.reduce((a, c) => a + Number(c[k]), 0);
    return { kcal: s('kcal'), proteina: s('proteina'), carbos: s('carbos'), grasas: s('grasas') };
  }, [dia.data]);

  const p = perfil.data;
  const metas = p?.kcal_meta
    ? { kcal: p.kcal_meta, proteina: p.proteina_meta!, carbos: p.carbos_meta!, grasas: p.grasas_meta! }
    : null;

  const mover = (d: number) => {
    const nueva = restarDias(fecha, -d);
    if (nueva > hoy) return;
    setDir(d);
    setFecha(nueva);
  };

  const borrar = async (id: number) => {
    dia.setData((d) => (d ? { ...d, comidas: d.comidas.filter((c) => c.id !== id) } : d)); // optimista
    try { await api.borrarComida(id); avisar('Comida borrada'); }
    catch (e) { avisar(String((e as Error).message), 'error'); dia.refrescar(); }
  };

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-6">
      {/* Encabezado con navegación de días */}
      <motion.header variants={fadeUp} className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-tinta-suave">
            {saludo()}{p?.nombre ? `, ${p.nombre}` : ''}
            <EnVivo />
          </p>
          <div className="relative h-[2.6rem] overflow-hidden sm:h-12">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.h1
                key={fecha}
                custom={dir}
                variants={{
                  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: d * -40, opacity: 0 }),
                }}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.3, ease }}
                className="font-display text-3xl font-bold tracking-tight first-letter:uppercase sm:text-4xl"
              >
                {fecha === hoy ? 'Hoy' : fechaLarga(fecha)}
              </motion.h1>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <BotonRedondo onClick={() => mover(-1)} label="Día anterior"><ChevronLeft className="size-5" /></BotonRedondo>
          <BotonRedondo onClick={() => mover(1)} label="Día siguiente" disabled={fecha === hoy}><ChevronRight className="size-5" /></BotonRedondo>
        </div>
      </motion.header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Columna izquierda: el plato */}
        <motion.section variants={fadeUp} className="card p-6 sm:p-8 lg:sticky lg:top-24 lg:self-start" aria-label="Progreso del día">
          {metas && dia.data ? (
            <>
              <Plato fecha={fecha} consumido={totales} metas={metas} />
              <ul className="mt-6 grid grid-cols-3 gap-2">
                {(['proteina', 'carbos', 'grasas'] as Macro[]).map((m) => (
                  <FilaMacro key={m} macro={m} valor={totales[m]} meta={metas[m]} />
                ))}
              </ul>
            </>
          ) : perfil.data && !metas ? (
            <SinMetas />
          ) : (
            <div className="space-y-6">
              <div className="skeleton mx-auto aspect-square w-full max-w-[320px] rounded-full!" />
              <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}</div>
            </div>
          )}
        </motion.section>

        {/* Columna derecha */}
        <div className="space-y-6">
          {fecha === hoy && metas && dia.data && despensa.data && (
            <motion.div variants={fadeUp}>
              <ParaCerrar faltaProteina={metas.proteina - totales.proteina} faltanKcal={metas.kcal - totales.kcal} despensa={despensa.data} />
            </motion.div>
          )}

          <motion.section variants={fadeUp} className="card p-5 sm:p-6" aria-label="Comidas">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-bold">Comidas</h2>
              {dia.data && <span className="text-sm text-tinta-suave">{dia.data.comidas.length} registros</span>}
            </div>
            {!dia.data ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}</div>
            ) : dia.data.comidas.length === 0 ? (
              <Vacio esHoy={fecha === hoy} />
            ) : (
              <ListaComidas comidas={dia.data.comidas} onBorrar={borrar} />
            )}
          </motion.section>

          <AnimatePresence>
            {dia.data && dia.data.entrenos.length > 0 && (
              <motion.section
                key="entrenos"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="card p-5 sm:p-6" aria-label="Entrenamiento"
              >
                <h2 className="mb-3 font-display text-xl font-bold">Entrenamiento</h2>
                <ul className="space-y-2">
                  {dia.data.entrenos.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-celeste-50 p-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-base text-celeste-800 shadow-suave"><Dumbbell className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{e.tipo}{e.descripcion ? <span className="font-normal text-tinta-suave"> · {e.descripcion}</span> : null}</p>
                        <p className="text-sm text-tinta-suave">{e.duracion_min ?? '?'} min{e.intensidad ? ` · intensidad ${e.intensidad}` : ''}</p>
                      </div>
                      {e.kcal_estimadas ? (
                        <span className="text-right text-sm text-celeste-800" title="Estimado. No se suma a tu meta: ya contempla tu nivel de actividad.">
                          <span className="num font-bold">~{num(e.kcal_estimadas)}</span> kcal
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      {BOT && fecha === hoy && (
        <motion.a
          variants={fadeUp}
          href={`https://t.me/${BOT}`} target="_blank" rel="noreferrer"
          whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          className="mx-auto flex w-fit items-center gap-2 rounded-full bg-salmon-400 px-5 py-3 font-semibold text-tinta shadow-calida transition-colors hover:bg-salmon-600 hover:text-white"
        >
          <Send className="size-4" /> Cargar algo en Telegram
        </motion.a>
      )}
    </motion.div>
  );
}

function EnVivo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-base/70 px-2 py-0.5 text-[11px] font-semibold text-celeste-800" title="Se actualiza solo cuando cargás algo en Telegram">
      <span className="relative flex size-2">
        <motion.span
          className="absolute inset-0 rounded-full bg-celeste-400"
          animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="relative size-2 rounded-full bg-celeste-600" />
      </span>
      en vivo
    </span>
  );
}

function BotonRedondo({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={onClick} aria-label={label} disabled={disabled}
      className="grid size-11 place-items-center rounded-full border border-tinta/5 bg-base text-tinta shadow-suave transition-opacity disabled:opacity-35"
    >
      {children}
    </motion.button>
  );
}

function FilaMacro({ macro, valor, meta }: { macro: Macro; valor: number; meta: number }) {
  const col = COLOR_MACRO[macro];
  const falta = meta - valor;
  const listo = falta <= 0;
  return (
    <li className={`rounded-2xl ${col.soft} p-3`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-tinta-suave">
        <span className={`size-2 rounded-full ${col.bg}`} /> {ETIQUETA_MACRO[macro]}
      </p>
      <p className="mt-1 leading-none whitespace-nowrap">
        <Numero valor={valor} className={`num text-xl font-bold sm:text-2xl ${col.texto}`} />
        <span className="text-[11px] text-tinta-suave sm:text-xs"> / {meta}</span>
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={listo ? 'ok' : 'falta'}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-tinta-suave"
        >
          {listo ? <><Check className={`size-3.5 ${col.texto}`} strokeWidth={3} /> cubierto</> : <>faltan {num(falta)} g</>}
        </motion.p>
      </AnimatePresence>
    </li>
  );
}

function ListaComidas({ comidas, onBorrar }: { comidas: Comida[]; onBorrar: (id: number) => void }) {
  // Los ids que ya estaban en el primer render no se resaltan; los que llegan después (realtime) sí
  const vistos = useRef<Set<number> | null>(null);
  if (!vistos.current) vistos.current = new Set(comidas.map((c) => c.id));

  const grupos = useMemo(() => {
    const m = new Map<string, Comida[]>();
    for (const c of comidas) {
      const k = c.momento ?? 'snack';
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.entries()].sort((a, b) => (MOMENTOS[a[0]]?.orden ?? 9) - (MOMENTOS[b[0]]?.orden ?? 9));
  }, [comidas]);

  return (
    <div className="space-y-5">
      <AnimatePresence initial={false} mode="popLayout">
        {grupos.map(([momento, items]) => (
          <motion.div key={momento} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-2 flex items-baseline justify-between text-xs font-semibold tracking-[0.14em] text-tinta-suave uppercase">
              <span>{MOMENTOS[momento]?.etiqueta ?? momento}</span>
              <span className="num tracking-normal normal-case">{num(items.reduce((a, c) => a + Number(c.kcal), 0))} kcal</span>
            </div>
            <ul className="space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((c) => {
                  const nueva = !vistos.current!.has(c.id);
                  return (
                    <motion.li
                      key={c.id}
                      layout
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0, transition: spring }}
                      exit={{ opacity: 0, x: -32, transition: { duration: 0.2 } }}
                      onAnimationComplete={() => vistos.current!.add(c.id)}
                      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-crema/70 px-3.5 py-2.5"
                    >
                      {nueva && (
                        <motion.span aria-hidden className="absolute inset-0 bg-salmon-100"
                          initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6, delay: 0.3 }} />
                      )}
                      <div className="relative min-w-0 flex-1">
                        <p className="truncate font-medium">{c.descripcion}</p>
                        <p className="flex gap-2.5 text-xs text-tinta-suave">
                          <span>{horaDe(c.creado)}</span>
                          <span className="text-salmon-800">P {Math.round(c.proteina)}</span>
                          <span className="text-celeste-800">C {Math.round(c.carbos)}</span>
                          <span className="text-ambar-700">G {Math.round(c.grasas)}</span>
                        </p>
                      </div>
                      <span className="relative num font-bold">{num(c.kcal)}</span>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => onBorrar(c.id)}
                        aria-label={`Borrar ${c.descripcion}`}
                        className="relative grid size-8 place-items-center rounded-full text-tinta-suave transition hover:bg-salmon-50 hover:text-salmon-800 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </motion.button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Sugerencia simple (sin IA) con lo que hay en la despensa para cubrir la proteína. */
function ParaCerrar({ faltaProteina, faltanKcal, despensa }: { faltaProteina: number; faltanKcal: number; despensa: ItemDespensa[] }) {
  const opciones = useMemo(() => {
    if (faltaProteina < 12) return [];
    const candidatos = despensa
      .filter((i) => i.alimento?.porcion_g && i.alimento.proteina_100 >= 10)
      .map((i) => {
        const m = macrosDe(i.alimento!, Number(i.alimento!.porcion_g));
        const porciones = Math.max(1, Math.min(i.tipo === 'suplemento' ? 2 : 3, Math.round(faltaProteina / m.proteina)));
        return { item: i, porciones, proteina: m.proteina * porciones, kcal: m.kcal * porciones, densidad: m.proteina / Math.max(m.kcal, 1) };
      })
      .sort((a, b) => b.densidad - a.densidad);
    return candidatos.slice(0, 3);
  }, [faltaProteina, despensa]);

  const cubierto = faltaProteina < 12;

  return (
    <motion.section layout className={`card overflow-hidden p-5 sm:p-6 ${cubierto ? '' : 'bg-gradient-to-br from-salmon-50 via-base to-celeste-50'}`} aria-label="Para cerrar el día">
      <AnimatePresence mode="wait" initial={false}>
        {cubierto ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-ok/15 text-ok"><Check className="size-5" strokeWidth={3} /></span>
            <div>
              <p className="font-semibold">Proteína cubierta</p>
              <p className="text-sm text-tinta-suave">{faltanKcal > 0 ? `Te quedan ${num(faltanKcal)} kcal para lo que quieras.` : 'Día cerrado. Buen trabajo.'}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="sug" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-salmon-800 uppercase">
              <Sparkles className="size-4" /> Para cerrar el día
            </p>
            <p className="mt-1.5 font-display text-xl font-bold leading-snug">
              Te faltan <Numero valor={faltaProteina} className="num text-salmon-800" /> g de proteína
            </p>
            {opciones.length ? (
              <motion.ul variants={stagger(0.07)} initial="hidden" animate="show" className="mt-4 grid gap-2">
                {opciones.map((o) => (
                  <motion.li key={o.item.id} variants={fadeUp} className="flex items-center justify-between gap-2 rounded-2xl bg-base/80 px-3.5 py-2.5 shadow-suave">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold first-letter:uppercase">{o.item.nombre}</span>
                      <span className="text-xs text-tinta-suave">
                        {o.porciones} × {o.item.alimento?.porcion_nombre?.replace(/^1\s+/, '') ?? 'porción'} · {num(o.kcal)} kcal{o.item.tipo === 'suplemento' ? ' · suplemento' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-salmon-50 px-2 py-1 text-xs font-bold text-salmon-800">+{Math.round(o.proteina)} g</span>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <p className="mt-2 text-sm text-tinta-suave">Contale al bot qué tenés en la heladera y te armo opciones acá.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Vacio({ esHoy }: { esHoy: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-dashed border-salmon-200 px-5 py-8 text-center">
      <p className="font-display text-lg font-bold">{esHoy ? 'Todavía no cargaste nada hoy' : 'Sin registros este día'}</p>
      <p className="mt-1 text-sm text-tinta-suave">{esHoy ? 'Mandale al bot lo que comiste y aparece acá al instante.' : 'Podés cargarlo diciéndole al bot la fecha.'}</p>
    </motion.div>
  );
}

function SinMetas() {
  return (
    <div className="py-10 text-center">
      <p className="font-display text-xl font-bold">Faltan tus metas</p>
      <p className="mt-1 text-sm text-tinta-suave">Completá tu perfil para calcular calorías y macros.</p>
      <a href="/perfil" className="mt-4 inline-block rounded-full bg-salmon-400 px-5 py-2.5 font-semibold text-tinta hover:bg-salmon-600 hover:text-white">Ir al perfil</a>
    </div>
  );
}
