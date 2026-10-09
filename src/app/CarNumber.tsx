import { useState } from 'react';

/** The team's own number artwork when available, else the number in the display face. */
export function CarNumber({ number, badge }: { number: string; badge?: string }) {
  const [failed, setFailed] = useState(false);
  if (!badge || failed) return <span className="car-text">{number}</span>;
  return <img className="car-badge" src={badge} alt={number} onError={() => setFailed(true)} />;
}
