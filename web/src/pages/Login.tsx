import type { SupabaseClient } from '@supabase/supabase-js';
import { LoaderCircle, Mail } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { ease, fadeUp, stagger } from '../motion/presets';

export function Login({ sb }: { sb: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'form' | 'enviando' | 'enviado'>('form');
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    setError(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) { setError(error.message); setEstado('form'); }
    else setEstado('enviado');
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-[-10%] size-[460px] rounded-full bg-salmon-200/70 blur-[110px]" />
        <div className="absolute right-[-12%] bottom-[-10%] size-[460px] rounded-full bg-celeste-200/80 blur-[110px]" />
      </div>

      <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="card relative w-full max-w-sm p-7">
        <motion.div variants={fadeUp} className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="font-display text-2xl font-bold">Nutri</span>
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          {estado === 'enviado' ? (
            <motion.div key="ok" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }}>
              <motion.span initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                className="grid size-14 place-items-center rounded-2xl bg-celeste-50 text-celeste-800">
                <Mail className="size-7" />
              </motion.span>
              <h1 className="mt-4 font-display text-2xl font-bold">Revisá tu mail</h1>
              <p className="mt-1 text-tinta-suave">Te mandamos un link a <b className="text-tinta">{email}</b>. Abrilo desde este dispositivo.</p>
              <button onClick={() => setEstado('form')} className="mt-5 text-sm font-semibold text-celeste-800 hover:underline">Usar otro mail</button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={enviar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
              <motion.h1 variants={fadeUp} className="font-display text-2xl font-bold">Entrá a tu dashboard</motion.h1>
              <motion.p variants={fadeUp} className="mt-1 text-sm text-tinta-suave">
                Usá el mail que vinculaste en Telegram con <code className="rounded bg-crema px-1">/web tu@mail.com</code>
              </motion.p>
              <motion.label variants={fadeUp} className="mt-5 block">
                <span className="sr-only">Mail</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@mail.com" autoComplete="email"
                  className="w-full rounded-2xl bg-crema px-4 py-3.5 outline-none placeholder:text-tinta-suave/70 focus:ring-2 focus:ring-celeste-400" />
              </motion.label>
              {error && <p className="mt-2 text-sm text-salmon-800">{error}</p>}
              <motion.button variants={fadeUp} whileTap={{ scale: 0.97 }} disabled={estado === 'enviando'}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-salmon-400 py-3.5 font-semibold text-tinta transition-colors hover:bg-salmon-600 hover:text-white disabled:opacity-60">
                {estado === 'enviando' ? <><LoaderCircle className="size-4 animate-spin" /> Enviando…</> : 'Mandame el link'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="#FFC9BE" strokeWidth="5" />
      <motion.circle cx="16" cy="16" r="12.5" fill="none" stroke="#FF9A85" strokeWidth="5" strokeLinecap="round"
        style={{ rotate: -90, transformOrigin: '16px 16px' }}
        initial={{ pathLength: 0 }} animate={{ pathLength: 0.72 }} transition={{ duration: 1.2, ease, delay: 0.2 }} />
      <circle cx="16" cy="16" r="5.5" fill="#6CC4EC" />
    </svg>
  );
}
