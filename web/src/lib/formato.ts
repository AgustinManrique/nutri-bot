const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const num = (n: number) => nf.format(Math.round(n));

export function fechaLarga(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
}

export function diaCorto(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`)).replace('.', '');
}

export function horaDe(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
    .format(new Date(iso));
}

export const MOMENTOS: Record<string, { etiqueta: string; orden: number }> = {
  desayuno: { etiqueta: 'Desayuno', orden: 1 },
  almuerzo: { etiqueta: 'Almuerzo', orden: 2 },
  pre_entreno: { etiqueta: 'Pre entreno', orden: 3 },
  merienda: { etiqueta: 'Merienda', orden: 4 },
  post_entreno: { etiqueta: 'Post entreno', orden: 5 },
  snack: { etiqueta: 'Snack', orden: 6 },
  cena: { etiqueta: 'Cena', orden: 7 },
};

export function saludo(): string {
  const h = Number(new Intl.DateTimeFormat('es-AR', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()));
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Guarda en localStorage sin romper si no está disponible */
export function unaVez(clave: string): boolean {
  try {
    if (localStorage.getItem(clave)) return false;
    localStorage.setItem(clave, '1');
    return true;
  } catch {
    return true;
  }
}
