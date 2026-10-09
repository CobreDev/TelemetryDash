import { useState } from 'react';

/**
 * Track logo, loaded by the browser straight from nascar.com (the server can't fetch it).
 * JPG logos come on white backgrounds, so they get a white tile; PNGs are made for dark
 * backgrounds and sit directly on the bar. Hidden if it fails to load.
 */
export function TrackLogo({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const tile = /\.jpe?g($|\?)/i.test(url);
  return (
    <img
      className={`track-logo${tile ? ' on-tile' : ''}`}
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
