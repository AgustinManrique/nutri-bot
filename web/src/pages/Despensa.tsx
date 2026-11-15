import { Pill, Plus, ScanBarcode, X } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { lazy, Suspense, useState } from 'react';
import { macrosDe } from '../../../lib/nutricion';
import { useApi, useDatos, useToast } from '../lib/contexto';
import type { ItemDespensa } from '../lib/types';
import { fadeUp, pop, spring, stagger } from '../motion/presets';
import { Segmento } from '../components/Segmento';

// El escáner (y su lector wasm) se descarga recién cuando lo abrís
const Escaner = lazy(() => import('../components/Escaner'));

type Filtro = 'todo' | 'alimento' | 'suplemento';
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'alimento', label: 'Alimentos' },
  { id: 'suplemento', label: 'Suplementos' },
];

export function Despensa() {
  const api = useApi();
  const { avisar } = useToast();
  const despensa = useDatos((a) => a.despensa(), [], ['despensa'], 'despensa');
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [tipo, setTipo] = useState<'alimento' | 'suplemento'>('alimento');
  const [enviando, setEnviando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);

  const items = (despensa.data ?? []).filter((i) => filtro === 'todo' || i.tipo === filtro);

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    try {
      await api.agregarDespensa({ nombre, cantidad, tipo });
      setNombre(''); setCantidad('');
      avisar(`Agregado: ${nombre.trim()}`);
      despensa.refrescar();
    } catch (err) {
      avisar(String((err as Error).message), 'error');
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async (i: ItemDespensa) => {
    despensa.setData((d) => d?.filter((x) => x.id !== i.id) ?? d);
    try { await api.quitarDespensa(i.id); }
    catch (err) { avisar(String((err as Error).message), 'error'); despensa.refrescar(); }
  };

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-6">
      <motion.header variants={fadeUp}>
        <p className="text-sm font-medium text-tinta-suave">Alacena, heladera y suplementos</p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Despensa</h1>
        <p className="mt-2 max-w-prose text-sm text-tinta-suave">El bot usa esto para sugerirte qué comer y cuándo usar un suplemento. También podés decírselo por Telegram: “tengo pollo, arroz y whey”.</p>
      </motion.header>

      <motion.button
        variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setEscaneando(true)}
        className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-r from-salmon-400 to-salmon-200 p-4 text-left text-tinta shadow-calida sm:p-5"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-base/70"><ScanBarcode className="size-6" /></span>
        <span>
          <span className="block font-display text-lg font-bold">Escanear productos</span>
          <span className="text-sm text-tinta/75">Apuntá la cámara al código de barras y se cargan con sus macros</span>
        </span>
      </motion.button>

      <AnimatePresence>
        {escaneando && (
          <Suspense fallback={null}>
            <Escaner onCerrar={() => { setEscaneando(false); despensa.refrescar(); }} />
          </Suspense>
        )}
      </AnimatePresence>

      <motion.form variants={fadeUp} onSubmit={agregar} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
        <label className="sr-only" htmlFor="d-nombre">Qué tenés</label>
        <input id="d-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: pechuga de pollo"
          className="min-w-0 flex-1 rounded-2xl bg-crema px-4 py-3 outline-none placeholder:text-tinta-suave/70 focus:ring-2 focus:ring-celeste-400" />
        <label className="sr-only" htmlFor="d-cant">Cantidad</label>
        <input id="d-cant" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad (opcional)"
          className="rounded-2xl bg-crema px-4 py-3 outline-none placeholder:text-tinta-suave/70 focus:ring-2 focus:ring-celeste-400 sm:w-44" />
        <div className="flex gap-3">
          <Segmento valor={tipo} onChange={setTipo} opciones={[{ id: 'alimento', label: 'Alimento' }, { id: 'suplemento', label: 'Suplemento' }]} grupo="tipo-nuevo" />
          <motion.button whileTap={{ scale: 0.95 }} aria-label="Agregar" disabled={enviando || !nombre.trim()}
            className="flex items-center gap-1.5 rounded-2xl bg-salmon-400 px-4 py-3 font-semibold text-tinta transition-colors hover:bg-salmon-600 hover:text-white disabled:opacity-50">
            <Plus className="size-4" strokeWidth={2.6} /> <span className="hidden sm:inline">Agregar</span>
          </motion.button>
        </div>
      </motion.form>

      <motion.div variants={fadeUp}>
        <Segmento valor={filtro} onChange={setFiltro} opciones={FILTROS} grupo="filtro" grande />
      </motion.div>

      {!despensa.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>
      ) : (
        <LayoutGroup>
          <motion.ul layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((i) => <Chip key={i.id} item={i} onQuitar={() => quitar(i)} />)}
            </AnimatePresence>
          </motion.ul>
          {items.length === 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border-2 border-dashed border-celeste-200 p-8 text-center text-tinta-suave">
              {filtro === 'suplemento' ? 'No cargaste suplementos.' : 'Tu despensa está vacía.'}
            </motion.p>
          )}
        </LayoutGroup>
      )}
    </motion.div>
  );
}

function Chip({ item, onQuitar }: { item: ItemDespensa; onQuitar: () => void }) {
  const sup = item.tipo === 'suplemento';
  const porcion = item.alimento?.porcion_g ? macrosDe(item.alimento, Number(item.alimento.porcion_g)) : null;
  return (
    <motion.li
      layout
      {...pop}
      exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.18 } }}
      whileHover={{ y: -3, transition: spring }}
      className={`group relative rounded-3xl border p-4 ${sup ? 'border-celeste-200 bg-celeste-50' : 'border-tinta/5 bg-base shadow-suave'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-tight first-letter:uppercase">{item.nombre}</p>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onQuitar} aria-label={`Quitar ${item.nombre}`}
          className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-tinta-suave transition hover:bg-salmon-50 hover:text-salmon-800">
          <X className="size-4" />
        </motion.button>
      </div>
      {item.cantidad && <p className="mt-0.5 text-sm text-tinta-suave">{item.cantidad}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
        {sup && <span className="flex items-center gap-1 rounded-full bg-base px-2 py-0.5 text-celeste-800"><Pill className="size-3" /> suplemento</span>}
        {porcion && porcion.proteina >= 3 && (
          <span className="rounded-full bg-salmon-50 px-2 py-0.5 text-salmon-800">
            {Math.round(porcion.proteina)} g prot / {item.alimento?.porcion_nombre?.replace(/^1\s+/, '')}
          </span>
        )}
      </div>
    </motion.li>
  );
}
