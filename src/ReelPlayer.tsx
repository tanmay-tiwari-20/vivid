'use client';

import { useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import type { Reel } from './lib/content-types';

function videoProvider(source: string): { embed?: string; external?: string } {
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'instagram.com') return { external: 'Instagram' };
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return { embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
      return { external: 'YouTube' };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.match(/(?:^\/|\/video\/)(\d+)$/)?.[1];
      return id ? { embed: `https://player.vimeo.com/video/${id}` } : { external: 'Vimeo' };
    }
  } catch { /* Local uploaded files use relative paths. */ }
  return {};
}

export default function ReelPlayer({ reel }: { reel: Reel }) {
  const [failed, setFailed] = useState(false);
  const provider = videoProvider(reel.video);
  return <div className="modal-video-wrap">
    {provider.embed ? <iframe src={provider.embed} title={reel.title} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : provider.external || failed ? <div className="reel-external"><img src={reel.image} alt={reel.title} /><div><span className="external-play"><Play size={28} fill="currentColor" /></span><p>{failed ? 'Open the original reel to keep watching.' : `Watch the full story on ${provider.external}.`}</p><a className="button button-lime" href={reel.video} target="_blank" rel="noopener noreferrer">{provider.external ? `Watch on ${provider.external}` : 'Open original reel'}<ArrowUpRight size={18} /></a></div></div> : <video key={reel.video} src={reel.video} poster={reel.image} controls playsInline autoPlay muted loop preload="metadata" onError={() => setFailed(true)} aria-label={reel.title} />}
    {reel.demo && <span className="video-stock-label">SAMPLE FOOTAGE</span>}
  </div>;
}
