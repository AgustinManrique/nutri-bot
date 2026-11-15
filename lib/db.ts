import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let cliente: SupabaseClient | null = null;

/** Cliente con service role: solo se usa del lado del servidor. */
export function db(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}

/** Tira error legible si la query de Supabase falló */
export function ok<T>(res: { data: T; error: { message: string } | null }, contexto: string): T {
  if (res.error) throw new Error(`${contexto}: ${res.error.message}`);
  return res.data;
}
