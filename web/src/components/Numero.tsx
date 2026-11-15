import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useEffect } from 'react';

const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/**
 * Número que cuenta desde su valor anterior hasta el nuevo.
 * Comunica causalidad: cargaste algo → el número sube.
 */
export function Numero({ valor, className, prefijoSigno = false }: { valor: number; className?: string; prefijoSigno?: boolean }) {
  const reducir = useReducedMotion();
  const mv = useMotionValue(0);
  const suave = useSpring(mv, { stiffness: 110, damping: 22, restDelta: 0.5 });
  const texto = useTransform(suave, (v) => (prefijoSigno && v > 0 ? '+' : '') + nf.format(Math.round(v)));

  useEffect(() => {
    if (reducir) suave.jump(valor);
    else mv.set(valor);
  }, [valor, reducir, mv, suave]);

  return <motion.span className={className}>{texto}</motion.span>;
}
