import { LoaderCircle, LogOut } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calcularMetas, type Actividad, type DatosCorporales, type Objetivo, type Sexo } from '../../../lib/nutricion';
import { Numero } from '../components/Numero';
import { useApi, useDatos, useToast } from '../lib/contexto';
import { COLOR_MACRO, fadeUp, stagger } from '../motion/presets';
import { Segmento } from '../components/Segmento';

const ACTIVIDADES: { id: Actividad; label: string; desc: string }[] = [
  { id: 'sedentario', label: 'Sedentario', desc: 'Poco movimiento, sin entrenar' },
  { id: 'ligero', label: 'Ligero', desc: '1–3 entrenamientos por semana' },
  { id: 'moderado', label: 'Moderado', desc: '3–5 entrenamientos por semana' },
  { id: 'alto', label: 'Alto', desc: '6–7 entrenamientos por semana' },
  { id: 'muy_alto', label: 'Muy alto', desc: 'Doble turno o trabajo físico' },
];

export function Perfil({ onSalir }: { onSalir?: () => void }) {
  const api = useApi();
  const { avisar } = useToast();
  const perfil = useDatos((a) => a.perfil(), [], ['usuarios'], 'perfil');
  const [form, setForm] = useState<DatosCorporales | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const p = perfil.data;
    if (p && !form) {
      setForm({
        sexo: p.sexo ?? 'M', edad: p.edad ?? 25, peso_kg: Number(p.peso_kg ?? 70), altura_cm: Number(p.altura_cm ?? 170),
        actividad: p.actividad ?? 'moderado', objetivo: p.objetivo ?? 'mantener',
      });
    }
  }, [perfil.data, form]);

  const calc = useMemo(() => (form ? calcularMetas(form) : null), [form]);
  const set = <K extends keyof DatosCorporales>(k: K, v: DatosCorporales[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const guardar = async () => {
    if (!form || !calc) return;
    setGuardando(true);
    try {
      await api.guardarPerfil({ ...form, kcal_meta: calc.kcal_meta, proteina_meta: calc.proteina_meta, carbos_meta: calc.carbos_meta, grasas_meta: calc.grasas_meta });
      avisar('Perfil y metas guardados');
    } catch (e) {
      avisar(String((e as Error).message), 'error');
    } finally {
      setGuardando(false);
    }
  };

  const guardado = perfil.data;
  const sinCambios = !!guardado && !!calc && guardado.kcal_meta === calc.kcal_meta && guardado.proteina_meta === calc.proteina_meta
    && guardado.peso_kg == form?.peso_kg && guardado.actividad === form?.actividad && guardado.objetivo === form?.objetivo
    && guardado.edad == form?.edad && guardado.altura_cm == form?.altura_cm && guardado.sexo === form?.sexo;

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.header variants={fadeUp} className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-tinta-suave">Datos y metas</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Perfil</h1>
        </div>
        {onSalir && (
          <button onClick={onSalir} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-tinta-suave hover:bg-base hover:text-tinta">
            <LogOut className="size-4" /> Salir
          </button>
        )}
      </motion.header>

      {!form || !calc ? (
        <div className="grid gap-6 lg:grid-cols-2"><div className="skeleton h-96" /><div className="skeleton h-96" /></div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <motion.section variants={fadeUp} className="card space-y-6 p-5 sm:p-7" aria-label="Tus datos">
            <Campo titulo="Sexo">
              <Segmento<Sexo> valor={form.sexo} onChange={(v) => set('sexo', v)} grupo="sexo" grande
                opciones={[{ id: 'M', label: 'Masculino' }, { id: 'F', label: 'Femenino' }]} />
            </Campo>

            <div className="grid grid-cols-3 gap-3">
              <NumeroInput titulo="Edad" valor={form.edad} unidad="años" min={14} max={99} onChange={(v) => set('edad', v)} />
              <NumeroInput titulo="Peso" valor={form.peso_kg} unidad="kg" min={30} max={250} step={0.5} onChange={(v) => set('peso_kg', v)} />
              <NumeroInput titulo="Altura" valor={form.altura_cm} unidad="cm" min={120} max={230} onChange={(v) => set('altura_cm', v)} />
            </div>

            <Campo titulo="Objetivo">
              <Segmento<Objetivo> valor={form.objetivo} onChange={(v) => set('objetivo', v)} grupo="objetivo" grande
                opciones={[{ id: 'bajar', label: 'Bajar' }, { id: 'mantener', label: 'Mantener' }, { id: 'subir', label: 'Subir' }]} />
            </Campo>

            <Campo titulo="Nivel de actividad">
              <div role="radiogroup" className="grid gap-1.5">
                {ACTIVIDADES.map((a) => {
                  const activo = form.actividad === a.id;
                  return (
                    <button key={a.id} role="radio" aria-checked={activo} onClick={() => set('actividad', a.id)}
                      className="relative flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors hover:bg-crema">
                      {activo && <motion.span layoutId="act-activa" className="absolute inset-0 rounded-2xl border-2 border-celeste-400 bg-celeste-50" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                      <span className="relative">
                        <span className={`block font-semibold ${activo ? 'text-celeste-800' : ''}`}>{a.label}</span>
                        <span className="text-sm text-tinta-suave">{a.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Campo>
          </motion.section>

          <motion.section variants={fadeUp} className="card self-start p-5 sm:p-7 lg:sticky lg:top-24" aria-label="Tus metas">
            <h2 className="font-display text-xl font-bold">Tus metas diarias</h2>
            <p className="mt-1 text-sm text-tinta-suave">Se recalculan mientras cambiás tus datos.</p>

            <div className="mt-5 rounded-3xl bg-gradient-to-br from-salmon-50 to-celeste-50 p-5 text-center">
              <Resaltable valor={calc.kcal_meta}>
                <Numero valor={calc.kcal_meta} className="num text-5xl font-bold" />
              </Resaltable>
              <p className="text-sm font-medium text-tinta-suave">kcal por día</p>
            </div>

            <ul className="mt-3 grid grid-cols-3 gap-2">
              {([['proteina', calc.proteina_meta], ['carbos', calc.carbos_meta], ['grasas', calc.grasas_meta]] as const).map(([m, v]) => (
                <li key={m} className={`rounded-2xl p-3 text-center ${COLOR_MACRO[m].soft}`}>
                  <Resaltable valor={v}>
                    <Numero valor={v} className={`num text-2xl font-bold ${COLOR_MACRO[m].texto}`} />
                    <span className="text-xs text-tinta-suave"> g</span>
                  </Resaltable>
                  <p className="text-xs font-semibold text-tinta-suave">{m === 'proteina' ? 'Proteína' : m === 'carbos' ? 'Carbos' : 'Grasas'}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-crema p-3"><dt className="text-tinta-suave">Metabolismo basal</dt><dd className="num text-lg font-bold"><Numero valor={calc.tmb} /> kcal</dd></div>
              <div className="rounded-2xl bg-crema p-3"><dt className="text-tinta-suave">Gasto total (TDEE)</dt><dd className="num text-lg font-bold"><Numero valor={calc.tdee} /> kcal</dd></div>
            </dl>

            <motion.button whileTap={{ scale: 0.97 }} onClick={guardar} disabled={guardando || sinCambios}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-salmon-400 py-3.5 font-semibold text-tinta transition-colors hover:bg-salmon-600 hover:text-white disabled:bg-salmon-100 disabled:text-tinta-suave">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={guardando ? 'g' : sinCambios ? 's' : 'n'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="flex items-center gap-2">
                  {guardando ? <><LoaderCircle className="size-4 animate-spin" /> Guardando…</> : sinCambios ? 'Todo guardado' : 'Guardar cambios'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <p className="mt-3 text-xs text-tinta-suave">Cálculo con Mifflin-St Jeor. Es orientativo: no reemplaza a un nutricionista.</p>
          </motion.section>
        </div>
      )}
    </motion.div>
  );
}

/** Resalta 1 s en celeste cuando el valor cambia: muestra qué metas se movieron */
function Resaltable({ valor, children }: { valor: number; children: React.ReactNode }) {
  const prev = useRef(valor);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== valor) setFlash((f) => f + 1);
    prev.current = valor;
  }, [valor]);
  return (
    <span className="relative inline-block px-1.5">
      <AnimatePresence>
        {flash > 0 && (
          <motion.span key={flash} aria-hidden className="absolute inset-0 rounded-xl bg-celeste-200"
            initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1 }} />
        )}
      </AnimatePresence>
      <span className="relative">{children}</span>
    </span>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-tinta-suave">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function NumeroInput({ titulo, valor, unidad, min, max, step = 1, onChange }: {
  titulo: string; valor: number; unidad: string; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <label className="block rounded-2xl bg-crema p-3 focus-within:ring-2 focus-within:ring-celeste-400">
      <span className="block text-xs font-semibold text-tinta-suave">{titulo}</span>
      <span className="flex items-baseline gap-1">
        <input
          type="number" inputMode="decimal" value={texto} min={min} max={max} step={step}
          onChange={(e) => {
            setTexto(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value !== '' && v >= min && v <= max) onChange(v);
          }}
          className="num w-full min-w-0 bg-transparent text-2xl font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-xs text-tinta-suave">{unidad}</span>
      </span>
    </label>
  );
}
