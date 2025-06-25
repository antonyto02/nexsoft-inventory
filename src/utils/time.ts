export function getMexicoCityISO(): string {
  const offsetMs = 6 * 60 * 60 * 1000; // GMT-6
  return new Date(Date.now() - offsetMs).toISOString().replace('Z', '-06:00');
}

export function formatMexicoCity(date: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}
