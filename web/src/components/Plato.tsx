import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { unaVez } from '../lib/formato';
import { COLOR_MACRO, springSuave, type Macro } from '../motion/presets';
import { Confeti } from './Confeti';
import { Numero } from './Numero';

interface Props {
  fecha: string;
  consumido: { kcal: number; proteina: number; carbos: number; grasas: number };
  metas: { kcal: number; proteina: number; carbos: number; grasas: number };
}

const ANILLOS: { macro: Macro; r: number }[] = [
  { macro: 'proteina', r: 120 },
  { macro: 'carbos', r: 99 },
  { macro: 'grasas', r: 78 },
];
const GROSOR = 15;
const C = 140; // centro

/**
 * "El plato": tres anillos concéntricos (proteína afuera, grasas adentro) que se llenan
 * hacia la meta y las kcal en el centro. Los anillos se animan desde el valor previo.
 */
export function Plato({ fecha, consumido, metas }: Props) {
  const [pulsos, setPulsos] = useState<Record<Macro, number>>({ proteina: 0, carbos: 0, grasas: 0 });
  const [confeti, setConfeti] = useState<{ macro: Macro; key: number } | null>(null);
  const previo = useRef<Record<Macro, number> | null>(null);

  // Detecta cuándo un macro CRUZA su meta durante la sesión → pulso + confeti (una vez por día)
  useEffect(() => {
    const actual = {
      proteina: consumido.proteina / metas.proteina,
      carbos: consumido.carbos / metas.carbos,
      grasas: consumido.grasas / metas.grasas,
    };
    if (previo.current) {
      for (const { macro } of ANILLOS) {
        if (previo.current[macro] < 1 && actual[macro] >= 1) {
          setPulsos((p) => ({ ...p, [macro]: p[macro] + 1 }));
          if (unaVez(`meta-${fecha}-${macro}`)) setConfeti({ macro, key: Date.now() });
        }
      }
    }
    previo.current = actual;
  }, [consumido, metas, fecha]);

  const restante = metas.kcal - consumido.kcal;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90" role="img"
        aria-label={`Proteína ${Math.round(consumido.proteina)} de ${metas.proteina} g, carbos ${Math.round(consumido.carbos)} de ${metas.carbos} g, grasas ${Math.round(consumido.grasas)} de ${metas.grasas} g`}>
        {ANILLOS.map(({ macro, r }) => {
          const col = COLOR_MACRO[macro];
          const pct = consumido[macro] / metas[macro];
          const pasado = pct > 1.05;
          return (
            <g key={macro}>
              <circle cx={C} cy={C} r={r} fill="none" stroke={col.pista} strokeWidth={GROSOR} />
              <motion.circle
                cx={C} cy={C} r={r} fill="none"
                stroke={pasado ? col.fuerte : col.trazo}
                strokeWidth={GROSOR} strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: Math.min(pct, 1), opacity: pct > 0 ? 1 : 0 }}
                transition={springSuave}
              />
              <AnimatePresence>
                {pulsos[macro] > 0 && (
                  <motion.circle
                    key={pulsos[macro]}
                    cx={C} cy={C} r={r} fill="none" stroke={col.trazo} strokeWidth={GROSOR}
                    style={{ transformOrigin: `${C}px ${C}px` }}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                )}
              </AnimatePresence>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-tinta-suave uppercase">kcal</span>
        <Numero valor={consumido.kcal} className="num text-[2.75rem] font-bold leading-none sm:text-5xl" />
        <span className="mt-1 text-sm text-tinta-suave">de <span className="num">{metas.kcal.toLocaleString('es-AR')}</span></span>
        <motion.span
          key={restante >= 0 ? 'faltan' : 'pasado'}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className={`mt-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${restante >= 0 ? 'bg-celeste-50 text-celeste-800' : 'bg-salmon-50 text-salmon-800'}`}
        >
          {restante >= 0 ? <>faltan <Numero valor={restante} className="num" /></> : <><Numero valor={-restante} className="num" /> de más</>}
        </motion.span>
      </div>

      {confeti && <Confeti key={confeti.key} color={COLOR_MACRO[confeti.macro].trazo} />}
    </div>
  );
}
