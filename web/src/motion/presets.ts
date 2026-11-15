import type { Transition, Variants } from 'motion/react';

export const ease = [0.22, 1, 0.36, 1] as const;
export const spring: Transition = { type: 'spring', stiffness: 300, damping: 26 };
export const springSuave: Transition = { type: 'spring', stiffness: 90, damping: 18 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export const stagger = (delay = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
});

export const pop = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: spring },
  exit: { scale: 0.92, opacity: 0, transition: { duration: 0.15 } },
};

export const pagina = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

export const COLOR_MACRO = {
  proteina: { trazo: '#FF9A85', fuerte: '#A8402C', pista: '#FFF1EE', texto: 'text-salmon-800', bg: 'bg-salmon-400', soft: 'bg-salmon-50' },
  carbos: { trazo: '#6CC4EC', fuerte: '#1A6489', pista: '#EEF8FD', texto: 'text-celeste-800', bg: 'bg-celeste-400', soft: 'bg-celeste-50' },
  grasas: { trazo: '#F2B84B', fuerte: '#9A6A0C', pista: '#FEF7E8', texto: 'text-ambar-700', bg: 'bg-ambar-400', soft: 'bg-ambar-50' },
} as const;

export type Macro = keyof typeof COLOR_MACRO;
export const ETIQUETA_MACRO: Record<Macro, string> = { proteina: 'Proteína', carbos: 'Carbos', grasas: 'Grasas' };
