import type { RaceControlEntry } from '../cards/raceControl.model';
import { api } from './api';
import { useSeriesApi } from './useApi';

/** "#34 passes #11" with the car numbers set in bold. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#\d+)/).map((part, i) => (/^#\d+$/.test(part) ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

function Entry({ e }: { e: RaceControlEntry }) {
  return (
    <li className={`rc-entry rc-${e.kind} rc-flag-${e.flag}`}>
      <span className="rc-lap">{e.lapLabel}</span>
      <span className="rc-text">
        {e.kind === 'flag' && <i className={`flag-dot flag-${e.flag}`} aria-hidden />}
        {e.kind === 'info' && <span className="rc-tag">Stat</span>}
        <NoteText text={e.text} />
      </span>
    </li>
  );
}

/**
 * NASCAR's race notes plus caution / restart / red / white / checkered flags, newest first.
 * Same width as the Chase card below it; a fixed height that scrolls. Races only.
 */
export function RaceControlCard({ seriesId }: { seriesId: string }) {
  const { data: view } = useSeriesApi(api.raceControl, seriesId);
  if (!view) return null;
  return (
    <section className="panel race-control">
      <div className="panel-head">
        <h2>{view.title}</h2>
      </div>
      {view.entries.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ol className="rc-list">
          {view.entries.map((e) => (
            <Entry key={e.id} e={e} />
          ))}
        </ol>
      )}
    </section>
  );
}
