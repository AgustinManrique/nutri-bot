import { ChartColumn, Refrigerator, Sun, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useToast } from '../lib/contexto';
import { spring } from '../motion/presets';

const LINKS = [
  { to: '/', label: 'Hoy', Icono: Sun },
  { to: '/semana', label: 'Semana', Icono: ChartColumn },
  { to: '/despensa', label: 'Despensa', Icono: Refrigerator },
  { to: '/perfil', label: 'Perfil', Icono: UserRound },
];

function Nav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)] sm:sticky sm:top-0 sm:bottom-auto sm:pt-4 sm:pb-0"
    >
      <ul className="flex gap-1 rounded-full border border-tinta/5 bg-base/85 p-1.5 shadow-suave backdrop-blur-xl">
        {LINKS.map(({ to, label, Icono }) => {
          const activo = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <li key={to}>
              <NavLink
                to={to}
                aria-label={label}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${activo ? 'text-salmon-800' : 'text-tinta-suave hover:text-tinta'}`}
              >
                {/* El indicador "viaja" entre pestañas: muestra de dónde venís y a dónde vas */}
                {activo && (
                  <motion.span layoutId="nav-activo" className="absolute inset-0 rounded-full bg-salmon-50" transition={spring} />
                )}
                <Icono className="relative size-[18px]" strokeWidth={2.2} />
                <span className={`relative ${activo ? '' : 'hidden sm:inline'}`}>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Toasts() {
  const { toasts, cerrar } = useToast();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            layout
            key={t.id}
            onClick={() => cerrar(t.id)}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
            exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
            className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium shadow-calida ${
              t.tono === 'error' ? 'bg-salmon-800 text-white' : t.tono === 'info' ? 'bg-celeste-800 text-white' : 'bg-tinta text-white'
            }`}
          >
            {t.texto}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Shell({ children, banner }: { children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Atmósfera: dos manchas de color difusas detrás del contenido */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px]">
        <div className="absolute -top-40 -left-24 size-[420px] rounded-full bg-salmon-200/60 blur-[100px]" />
        <div className="absolute -top-24 right-[-120px] size-[380px] rounded-full bg-celeste-200/70 blur-[100px]" />
      </div>
      {banner}
      <Nav />
      <main className="relative mx-auto w-full max-w-5xl px-4 pt-6 pb-32 sm:px-6 sm:pt-8 sm:pb-16">{children}</main>
      <Toasts />
    </div>
  );
}
