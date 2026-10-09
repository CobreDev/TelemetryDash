import { useState } from 'react';
import { useImageLoaded } from './useImageLoaded';
import type { TvNetwork } from '../data/nascar/networks';

/**
 * The race's TV network: its logo on a white tile (network colors vanish on some series
 * bars, e.g. USA red on Craftsman red), or the name as text if there's no logo or it fails.
 */
export function TvLogo({ network }: { network: TvNetwork }) {
  const [failed, setFailed] = useState(false);
  const img = useImageLoaded();
  if (!network.logoUrl || failed) {
    return (
      <span className="tv-network" title="TV network">
        {network.name}
      </span>
    );
  }
  return (
    <span className={`tv-logo fade-img${img.loaded ? ' is-loaded' : ''}`} title={`On ${network.name}`}>
      <img ref={img.ref} src={network.logoUrl} alt={network.name} referrerPolicy="no-referrer" onLoad={img.onLoad} onError={() => setFailed(true)} />
    </span>
  );
}
