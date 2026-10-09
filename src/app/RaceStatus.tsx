import type { StatusLine } from '../format/format';
import type { StatusFlag } from '../cards/paceRankings.model';

const FLAG_LABEL: Record<StatusFlag, string> = {
  green: 'Green flag',
  yellow: 'Caution',
  red: 'Red flag',
  white: 'White flag',
  checkered: 'Checkered flag',
  'stage-green': 'End of stage',
  'stage-yellow': 'End of stage under caution',
  none: 'No flag',
};

const FLAG_FILL: Record<StatusFlag, string> = {
  green: '#2BB34B',
  yellow: '#FFD100',
  red: '#E4002B',
  white: '#FFFFFF',
  checkered: 'url(#flag-checker)',
  'stage-green': 'url(#flag-checker-green)',
  'stage-yellow': 'url(#flag-checker-yellow)',
  none: 'rgba(255,255,255,0.35)',
};

/** TNT-style waving flag on a pole, colored by track status. */
function FlagIcon({ flag }: { flag: StatusFlag }) {
  return (
    <svg className="race-status-flag" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <defs>
        {[
          ['flag-checker', '#000'],
          ['flag-checker-green', '#2BB34B'],
          ['flag-checker-yellow', '#FFD100'],
        ].map(([id, color]) => (
          <pattern key={id} id={id} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#fff" />
            <rect width="3" height="3" fill={color} />
            <rect x="3" y="3" width="3" height="3" fill={color} />
          </pattern>
        ))}
      </defs>
      <rect x="3" y="2" width="2" height="21" rx="1" fill="currentColor" />
      <path
        d="M5 3.5c3-1.6 5.5 1.6 8.5 0s5-1.4 7.5-.4v9.8c-2.5-1-4.5-1.2-7.5.4s-5.5-1.6-8.5 0z"
        fill={FLAG_FILL[flag]}
        // Outline keeps the flag visible when it matches the series bar (red on Craftsman, green on O'Reilly).
        stroke={flag === 'white' || flag === 'checkered' || flag.startsWith('stage-') ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** TV-style status block: a flag for track status beside stage and race lap counts. */
export function RaceStatus({ lines, flag }: { lines: StatusLine[]; flag: StatusFlag }) {
  if (lines.length === 0) return null;
  return (
    <div className={`race-status flag-${flag}`} role="group" aria-label={`Race status, ${FLAG_LABEL[flag]}`}>
      <span className="race-status-flag-wrap" title={FLAG_LABEL[flag]}>
        <FlagIcon flag={flag} />
      </span>
      <div className="race-status-lines">
        {lines.map((l, i) => (
          <div key={i} className={`race-status-line${i === 0 ? ' is-primary' : ''}`}>
            <span className="race-status-label">{l.label}</span>
            <span className="race-status-value">
              {l.value.includes('|') ? (
                <>
                  {l.value.split('|')[0]}
                  <span className="race-status-sep">|</span>
                  {l.value.split('|')[1]}
                </>
              ) : (
                l.value
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
