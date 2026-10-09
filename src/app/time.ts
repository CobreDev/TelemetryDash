// Clock times in the web UI: always US Eastern (NASCAR's schedule time), but in the 12- or
// 24-hour style the browser's own locale prefers.

const preferred = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: preferred === 'h23' || preferred === 'h24' ? 'h23' : 'h12',
});

/** "3:00 PM ET", or "15:00 ET" in a 24-hour browser. */
export const clockET = (ms: number) => `${clock.format(ms)} ET`;
