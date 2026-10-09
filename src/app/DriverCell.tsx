import { CarNumber } from './CarNumber';

interface Who {
  carNumber: string;
  carBadge: string;
  firstName?: string;
  lastName: string;
}

/** Car badge + name cells shared by the data tabs. */
export function CarCell({ who }: { who: Who }) {
  return (
    <td className="car">
      <CarNumber number={who.carNumber} badge={who.carBadge} />
    </td>
  );
}

export function NameCell({ who, short = false }: { who: Who; short?: boolean }) {
  return (
    <td className="left">
      {!short && who.firstName && <span className="dash-first">{who.firstName}</span>}
      <span className="dash-last">{who.lastName}</span>
    </td>
  );
}

export const rowClass = (r: { highlight?: boolean }) => (r.highlight ? 'is-highlight' : undefined);
