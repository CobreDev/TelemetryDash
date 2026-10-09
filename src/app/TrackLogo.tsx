import { useState } from 'react';
import { useImageLoaded } from './useImageLoaded';

/**
 * Track logo, loaded by the browser straight from nascar.com (the server can't fetch it).
 * JPG logos come on white backgrounds, so they get a white tile; PNGs are made for dark
 * backgrounds and sit directly on the bar. Hidden if it fails to load. The slot has a fixed
 * size so the race name never shifts when the logo arrives; the logo fades in.
 */
export function TrackLogo({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const img = useImageLoaded();
  if (failed) return null;
  const tile = /\.jpe?g($|\?)/i.test(url);
  return (
    <img
      ref={img.ref}
      className={`track-logo fade-img${tile ? ' on-tile' : ''}${img.loaded ? ' is-loaded' : ''}`}
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onLoad={img.onLoad}
      onError={() => setFailed(true)}
    />
  );
}
