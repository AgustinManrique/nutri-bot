import { motion } from 'motion/react';
import { spring } from '../motion/presets';

export function Segmento<T extends string>({ valor, onChange, opciones, grupo, grande }: {
  valor: T; onChange: (v: T) => void; opciones: { id: T; label: string }[]; grupo: string; grande?: boolean;
}) {
  return (
    <div role="radiogroup" className={`inline-flex rounded-2xl bg-base p-1 shadow-suave ${grande ? '' : 'flex-1 sm:flex-none'}`}>
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={activo} onClick={() => onChange(o.id)}
            className={`relative flex-1 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${activo ? 'text-celeste-800' : 'text-tinta-suave hover:text-tinta'}`}>
            {/* El fondo se desliza a la opción elegida */}
            {activo && <motion.span layoutId={`seg-${grupo}`} className="absolute inset-0 rounded-xl bg-celeste-50" transition={spring} />}
            <span className="relative whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
