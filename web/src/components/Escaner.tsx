import { BarcodeDetector } from 'barcode-detector/ponyfill';
import { Keyboard, LoaderCircle, Pill, Plus, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi, useToast } from '../lib/contexto';
import type { ProductoEscaneado } from '../lib/openFoodFacts';
import { ease, spring } from '../motion/presets';
import { Segmento } from './Segmento';

type Estado =
  | { tipo: 'escaneando' }
  | { tipo: 'buscando'; codigo: string }
  | { tipo: 'encontrado'; producto: ProductoEscaneado }
  | { tipo: 'no-encontrado'; codigo: string };

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] as const;

/**
 * Escáner de productos: lee códigos de barras/QR con la cámara, busca el producto
 * y permite agregarlo a la despensa. Queda abierto para escanear varios seguidos.
 */
export default function Escaner({ onCerrar }: { onCerrar: () => void }) {
  const api = useApi();
  const { avisar } = useToast();
  const reducir = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: 'escaneando' });
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [agregados, setAgregados] = useState(0);
  const [destello, setDestello] = useState(0);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ultimo = useRef<{ codigo: string; t: number } | null>(null);

  const procesar = useCallback(async (crudo: string) => {
    const codigo = crudo.trim();
    // Un QR puede traer una URL: solo nos sirven los que contienen un código numérico de producto
    const ean = /^\d{8,14}$/.test(codigo) ? codigo : codigo.match(/\b\d{8,14}\b/)?.[0];
    if (!ean) { avisar('Ese código no es de un producto', 'info'); return; }
    setDestello((d) => d + 1);
    navigator.vibrate?.(50);
    setEstado({ tipo: 'buscando', codigo: ean });
    try {
      const p = await api.productoPorCodigo(ean);
      setEstado(p ? { tipo: 'encontrado', producto: p } : { tipo: 'no-encontrado', codigo: ean });
    } catch {
      setEstado({ tipo: 'no-encontrado', codigo: ean });
    }
  }, [api, avisar]);

  // Cámara + loop de detección
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let vivo = true;
    const detector = new BarcodeDetector({ formats: [...FORMATOS] });

    const loop = async () => {
      if (!vivo) return;
      const v = video.current;
      if (v && v.readyState >= 2 && estadoRef.current.tipo === 'escaneando') {
        try {
          const [res] = await detector.detect(v);
          const ahora = Date.now();
          if (res && !(ultimo.current?.codigo === res.rawValue && ahora - ultimo.current.t < 4000)) {
            ultimo.current = { codigo: res.rawValue, t: ahora };
            await procesar(res.rawValue);
          }
        } catch { /* frame sin código */ }
      }
      timer = window.setTimeout(loop, 220);
    };

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
        loop();
      })
      .catch(() => { setErrorCamara('No pude abrir la cámara. Revisá el permiso o ingresá el código a mano.'); setManual(true); });

    return () => {
      vivo = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [procesar]);

  // Escape cierra
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCerrar]);

  const seguir = () => setEstado({ tipo: 'escaneando' });
  const escaneando = estado.tipo === 'escaneando';

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label="Escanear productos"
      className="fixed inset-0 z-[60] flex flex-col bg-tinta text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-tinta/70 via-transparent to-tinta/80" />

      {/* Barra superior */}
      <div className="relative flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),16px)]">
        <button onClick={onCerrar} aria-label="Cerrar escáner" className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur">
          <X className="size-5" />
        </button>
        <AnimatePresence>
          {agregados > 0 && (
            <motion.span key={agregados} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring }}
              className="rounded-full bg-salmon-400 px-3 py-1.5 text-sm font-bold text-tinta">
              {agregados} agregado{agregados > 1 ? 's' : ''}
            </motion.span>
          )}
        </AnimatePresence>
        <button onClick={() => setManual((m) => !m)} aria-label="Ingresar código a mano" aria-pressed={manual}
          className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur">
          <Keyboard className="size-5" />
        </button>
      </div>

      <AnimatePresence>
        {manual && <IngresoManual key="manual" onEnviar={(c) => { setManual(false); procesar(c); }} />}
      </AnimatePresence>

      {/* Visor */}
      <div className="relative flex flex-1 items-center justify-center">
        {errorCamara ? (
          <p className="max-w-xs px-6 text-center text-white/80">{errorCamara}</p>
        ) : (
          <motion.div
            key={destello}
            className="relative h-44 w-72"
            initial={destello ? { scale: 1.06 } : false} animate={{ scale: 1 }} transition={spring}
          >
            {/* Esquinas del marco: salmón al leer un código */}
            {(['top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl',
               'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl'] as const).map((c) => (
              <span key={c} className={`absolute size-10 transition-colors duration-300 ${c} ${escaneando ? 'border-white' : 'border-salmon-400'}`} />
            ))}
            {/* Línea que recorre el marco: indica que está buscando */}
            {escaneando && !reducir && (
              <motion.span className="absolute inset-x-4 h-0.5 rounded-full bg-celeste-400 shadow-[0_0_12px_2px_rgb(108_196_236/0.8)]"
                initial={{ top: '10%' }} animate={{ top: ['10%', '90%', '10%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            )}
          </motion.div>
        )}
      </div>

      <p className="relative pb-4 text-center text-sm text-white/80">
        {escaneando ? 'Apuntá al código de barras del producto' : ' '}
      </p>

      {/* Hoja inferior con el resultado */}
      <AnimatePresence mode="wait">
        {estado.tipo !== 'escaneando' && (
          <motion.div
            key={estado.tipo === 'encontrado' ? estado.producto.codigo : estado.tipo}
            initial={{ y: '100%' }} animate={{ y: 0, transition: { ...spring, stiffness: 260 } }} exit={{ y: '100%', transition: { duration: 0.2, ease } }}
            className="relative rounded-t-[2rem] bg-base px-5 pt-5 pb-[max(env(safe-area-inset-bottom),20px)] text-tinta"
          >
            {estado.tipo === 'buscando' && (
              <div className="flex items-center gap-3 py-4">
                <LoaderCircle className="size-5 animate-spin text-celeste-600" />
                <span>Buscando <span className="num font-semibold">{estado.codigo}</span>…</span>
              </div>
            )}
            {estado.tipo === 'no-encontrado' && (
              <div className="py-2">
                <p className="font-display text-lg font-bold">No encontré ese producto</p>
                <p className="mt-1 text-sm text-tinta-suave">Código <span className="num">{estado.codigo}</span>. Podés agregarlo a mano o contárselo al bot y él estima los valores.</p>
                <button onClick={seguir} className="mt-4 w-full rounded-2xl bg-crema py-3 font-semibold">Seguir escaneando</button>
              </div>
            )}
            {estado.tipo === 'encontrado' && (
              <TarjetaProducto
                producto={estado.producto}
                onDescartar={seguir}
                onAgregar={async (opciones) => {
                  await api.agregarProducto(estado.producto, opciones);
                  setAgregados((n) => n + 1);
                  avisar(`Agregado: ${estado.producto.nombre}`);
                  seguir();
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TarjetaProducto({ producto: p, onAgregar, onDescartar }: {
  producto: ProductoEscaneado;
  onAgregar: (o: { cantidad?: string; tipo: 'alimento' | 'suplemento' }) => Promise<void>;
  onDescartar: () => void;
}) {
  const [tipo, setTipo] = useState<'alimento' | 'suplemento'>(p.esSuplemento ? 'suplemento' : 'alimento');
  const [cantidad, setCantidad] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { avisar } = useToast();

  const macros = [
    { k: 'kcal', v: p.kcal_100, c: 'bg-crema text-tinta' },
    { k: 'P', v: p.proteina_100, c: 'bg-salmon-50 text-salmon-800' },
    { k: 'C', v: p.carbos_100, c: 'bg-celeste-50 text-celeste-800' },
    { k: 'G', v: p.grasas_100, c: 'bg-ambar-50 text-ambar-700' },
  ];

  return (
    <div>
      <div className="flex gap-4">
        {p.imagen ? (
          <img src={p.imagen} alt="" className="size-16 shrink-0 rounded-2xl bg-crema object-contain p-1" />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-crema text-tinta-suave">{tipo === 'suplemento' ? <Pill /> : '🛒'}</span>
        )}
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight font-bold">{p.nombre}</p>
          {p.marca && <p className="text-sm text-tinta-suave">{p.marca}</p>}
          {p.porcion_nombre && <p className="text-xs text-tinta-suave">Porción: {p.porcion_nombre}</p>}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-4 gap-2 text-center" aria-label="Valores cada 100 g">
        {macros.map((m, i) => (
          <motion.li key={m.k} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.05 } }}
            className={`rounded-2xl py-2 ${m.c}`}>
            <span className="num block text-lg font-bold">{Math.round(m.v)}</span>
            <span className="text-[11px] font-semibold">{m.k === 'kcal' ? 'kcal' : `${m.k} g`}</span>
          </motion.li>
        ))}
      </ul>
      <p className="mt-1.5 text-center text-[11px] text-tinta-suave">
        cada 100 g{p.incompleto ? ' · datos incompletos en Open Food Facts, revisá la etiqueta' : ''}
      </p>

      <div className="mt-4 flex gap-2">
        <Segmento valor={tipo} onChange={setTipo} grupo="tipo-escaneo" opciones={[{ id: 'alimento', label: 'Alimento' }, { id: 'suplemento', label: 'Suplemento' }]} />
        <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" aria-label="Cantidad (opcional)"
          className="w-28 min-w-0 flex-1 rounded-2xl bg-crema px-3 outline-none focus:ring-2 focus:ring-celeste-400" />
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onDescartar} className="rounded-2xl bg-crema px-4 py-3.5 font-semibold text-tinta-suave">Descartar</button>
        <motion.button whileTap={{ scale: 0.97 }} disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            try { await onAgregar({ cantidad, tipo }); }
            catch (e) { avisar(String((e as Error).message), 'error'); setEnviando(false); }
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-salmon-400 py-3.5 font-semibold text-tinta transition-colors hover:bg-salmon-600 hover:text-white disabled:opacity-60">
          {enviando ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" strokeWidth={2.6} />}
          Agregar a la despensa
        </motion.button>
      </div>
    </div>
  );
}

function IngresoManual({ onEnviar }: { onEnviar: (codigo: string) => void }) {
  const [codigo, setCodigo] = useState('');
  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      onSubmit={(e) => { e.preventDefault(); if (codigo.trim()) onEnviar(codigo); }}
      className="relative mx-4 mt-3 flex gap-2 rounded-2xl bg-white/15 p-2 backdrop-blur"
    >
      <input autoFocus inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Número del código de barras"
        aria-label="Número del código de barras" className="num min-w-0 flex-1 bg-transparent px-2 text-white outline-none placeholder:text-white/60" />
      <button className="rounded-xl bg-salmon-400 px-4 py-2 font-semibold text-tinta">Buscar</button>
    </motion.form>
  );
}
