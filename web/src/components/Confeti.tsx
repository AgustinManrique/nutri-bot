import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

/** Mini explosión de partículas en el color del macro. Se monta una vez por meta alcanzada. */
export function Confeti({ color }: { color: string }) {
  const reducir = useReducedMotion();
  const piezas = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 60;
        return {
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist - 20,
          rot: Math.random() * 360,
          forma: i % 3,
          delay: Math.random() * 0.08,
        };
      }),
    [],
  );
  if (reducir) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {piezas.map((p, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{
            width: p.forma === 0 ? 8 : 6,
            height: p.forma === 1 ? 10 : 6,
            borderRadius: p.forma === 2 ? 999 : 2,
            background: color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 40], opacity: [1, 1, 0], scale: 1, rotate: p.rot }}
          transition={{ duration: 1.1, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}
