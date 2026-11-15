export const TZ = 'America/Argentina/Buenos_Aires';

/** Fecha de hoy en Argentina, formato YYYY-MM-DD */
export function fechaAR(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function horaAR(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function restarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function diaSemana(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`));
}
