import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { Zap } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Shell } from './components/Shell';
import { ApiProvider, ToastProvider, useToast } from './lib/contexto';
import { demoApi, simularCargaTelegram } from './lib/demoApi';
import { crearApiReal, crearSupabase } from './lib/supabaseApi';
import type { Api } from './lib/types';
import { pagina } from './motion/presets';
import { Despensa } from './pages/Despensa';
import { Hoy } from './pages/Hoy';
import { Login, Logo } from './pages/Login';
import { Perfil } from './pages/Perfil';
import { Semana } from './pages/Semana';

const ES_DEMO = import.meta.env.VITE_DEMO === '1' || !import.meta.env.VITE_SUPABASE_URL;

function Paginas({ onSalir }: { onSalir?: () => void }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location.pathname} {...pagina}>
        <Routes location={location}>
          <Route path="/" element={<Hoy />} />
          <Route path="/semana" element={<Semana />} />
          <Route path="/despensa" element={<Despensa />} />
          <Route path="/perfil" element={<Perfil onSalir={onSalir} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function BannerDemo() {
  const { avisar } = useToast();
  return (
    <div className="relative z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-tinta px-4 py-2 text-center text-xs text-white">
      <span><b>Modo demo</b> · datos de ejemplo</span>
      <motion.button whileTap={{ scale: 0.95 }}
        onClick={() => avisar(`📲 Desde Telegram: ${simularCargaTelegram()}`, 'info')}
        className="flex items-center gap-1 rounded-full bg-salmon-400 px-2.5 py-1 font-semibold text-tinta hover:bg-salmon-200">
        <Zap className="size-3.5" /> Simular carga por Telegram
      </motion.button>
    </div>
  );
}

function AppDemo() {
  return (
    <ApiProvider api={demoApi}>
      <Shell banner={<BannerDemo />}><Paginas /></Shell>
    </ApiProvider>
  );
}

function AppReal() {
  const sb = useMemo<SupabaseClient>(() => crearSupabase(), []);
  const api = useMemo<Api>(() => crearApiReal(sb), [sb]);
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [vinculado, setVinculado] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (sesion) api.perfil().then((p) => setVinculado(!!p)).catch(() => setVinculado(false));
  }, [sesion, api]);

  if (sesion === undefined || (sesion && vinculado === undefined)) return <Cargando />;
  if (!sesion) return <Login sb={sb} />;
  if (!vinculado) return <NoVinculado email={sesion.user.email ?? ''} onSalir={() => sb.auth.signOut()} />;

  return (
    <ApiProvider api={api}>
      <Shell><Paginas onSalir={() => sb.auth.signOut()} /></Shell>
    </ApiProvider>
  );
}

function Cargando() {
  return <div className="grid min-h-dvh place-items-center"><Logo className="size-14" /></div>;
}

function NoVinculado({ email, onSalir }: { email: string; onSalir: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card max-w-md p-7 text-center">
        <Logo className="mx-auto size-12" />
        <h1 className="mt-4 font-display text-2xl font-bold">Falta vincular tu cuenta</h1>
        <p className="mt-2 text-tinta-suave">Mandale esto al bot en Telegram y recargá la página:</p>
        <code className="mt-3 block rounded-2xl bg-crema px-4 py-3 font-semibold">/web {email}</code>
        <button onClick={onSalir} className="mt-5 text-sm font-semibold text-celeste-800 hover:underline">Entrar con otro mail</button>
      </motion.div>
    </div>
  );
}

export function App() {
  return (
    // reducedMotion="user": si el sistema pide menos movimiento, Motion desactiva transforms automáticamente
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {ES_DEMO ? <MemoryRouter><AppDemo /></MemoryRouter> : <BrowserRouter><AppReal /></BrowserRouter>}
      </ToastProvider>
    </MotionConfig>
  );
}
