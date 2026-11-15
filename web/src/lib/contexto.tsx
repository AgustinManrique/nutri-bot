import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Api, Tabla } from './types';

const ApiCtx = createContext<Api | null>(null);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiCtx.Provider value={api}>{children}</ApiCtx.Provider>;
}

export function useApi(): Api {
  const api = useContext(ApiCtx);
  if (!api) throw new Error('useApi fuera de ApiProvider');
  return api;
}

/**
 * Carga datos y los vuelve a pedir cuando cambia alguna de las tablas indicadas
 * (realtime de Supabase o simulación en demo). Mantiene el dato anterior mientras recarga,
 * así las animaciones van del valor previo al nuevo en vez de pasar por un skeleton.
 */
const cache = new Map<string, unknown>();

export function useDatos<T>(cargar: (api: Api) => Promise<T>, deps: unknown[], tablas: Tabla[], clave?: string) {
  const api = useApi();
  // Con clave, al volver a una pantalla se muestra el último dato al instante (sin skeleton) y se refresca por detrás
  const [data, setDataRaw] = useState<T | null>(() => (clave ? (cache.get(clave) as T) ?? null : null));
  const claveRef = useRef(clave);
  claveRef.current = clave;
  const setData = useCallback((v: T | null | ((prev: T | null) => T | null)) => {
    setDataRaw((prev) => {
      const nuevo = typeof v === 'function' ? (v as (p: T | null) => T | null)(prev) : v;
      if (claveRef.current && nuevo != null) cache.set(claveRef.current, nuevo);
      return nuevo;
    });
  }, []);
  const [error, setError] = useState<string | null>(null);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const refrescar = useCallback(() => {
    cargarRef.current(api).then((d) => { setData(d); setError(null); }).catch((e) => setError(String(e.message ?? e)));
  }, [api, setData]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refrescar, [refrescar, ...deps]);

  useEffect(() => api.escuchar((t) => { if (tablas.includes(t)) refrescar(); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, refrescar, tablas.join()]);

  return { data, error, refrescar, setData };
}

// ---------- Toasts ----------
export interface Toast { id: number; texto: string; tono: 'ok' | 'info' | 'error' }
const ToastCtx = createContext<{ toasts: Toast[]; avisar: (texto: string, tono?: Toast['tono']) => void; cerrar: (id: number) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const cerrar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const avisar = useCallback((texto: string, tono: Toast['tono'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, texto, tono }]);
    setTimeout(() => cerrar(id), 3200);
  }, [cerrar]);
  return <ToastCtx.Provider value={{ toasts, avisar, cerrar }}>{children}</ToastCtx.Provider>;
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast fuera de ToastProvider');
  return c;
}
