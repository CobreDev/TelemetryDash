import { useState } from 'react';
import { useImageLoaded } from './useImageLoaded';

/** The team's own number artwork when available, else the number in the display face. */
export function CarNumber({ number, badge }: { number: string; badge?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useImageLoaded();
  if (!badge || failed) return <span className="car-text">{number}</span>;
  return (
    <img
      ref={img.ref}
      className={`car-badge fade-img${img.loaded ? ' is-loaded' : ''}`}
      src={badge}
      alt={number}
      width={78}
      height={70}
      decoding="async"
      onLoad={img.onLoad}
      onError={() => setFailed(true)}
    />
  );
}
