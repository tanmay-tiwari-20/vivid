'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Instagram, Play } from 'lucide-react';
import type { Reel } from './lib/content-types';
import { getInstagramReel } from './lib/instagram';

function videoProvider(source: string): { embed?: string; external?: string } {
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'instagram.com' || host === 'm.instagram.com') return { external: 'Instagram' };
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
  const [failedSource, setFailedSource] = useState('');
  const [loadedSource, setLoadedSource] = useState('');
  const [embedScale, setEmbedScale] = useState(1);
  const [embedHeight, setEmbedHeight] = useState(760);
  const instagramStage = useRef<HTMLDivElement>(null);
  const instagramFrame = useRef<HTMLIFrameElement>(null);
  const instagram = getInstagramReel(reel.video);
  useEffect(() => {
    setFailedSource('');
    setLoadedSource('');
    setEmbedHeight(760);
  }, [reel.video]);
  useEffect(() => {
    if (!instagram) return;
    const timer = window.setTimeout(() => setLoadedSource(reel.video), 12_000);
    return () => window.clearTimeout(timer);
  }, [reel.video, instagram?.url]);
  useEffect(() => {
    const stage = instagramStage.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      // Fit the complete native embed, including its controls, into the view.
      setEmbedScale(Math.min(width / 326, height / embedHeight, 1.2));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [instagram?.url, embedHeight]);
  useEffect(() => {
    if (!instagram) return;
    const measure = (event: MessageEvent) => {
      if (event.origin !== 'https://www.instagram.com' || event.source !== instagramFrame.current?.contentWindow) return;
      try {
        const value = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const height = value?.details?.height;
        if (value?.type === 'MEASURE' && typeof height === 'number' && Number.isFinite(height) && height >= 400 && height <= 3000) setEmbedHeight(Math.ceil(height));
      } catch { /* Ignore unrelated provider messages. */ }
    };
    window.addEventListener('message', measure);
    return () => window.removeEventListener('message', measure);
  }, [instagram?.url]);
  const failed = Boolean(failedSource) && failedSource === reel.video;
  const loading = Boolean(instagram) && !failed && loadedSource !== reel.video;
  const provider = videoProvider(reel.video);
  if (instagram) return <div className="modal-video-wrap reel-instagram-player">
    <div className="instagram-player-heading">
      <span className="instagram-player-icon"><Instagram size={20} aria-hidden="true" /></span>
      <strong>Instagram Reel</strong>
    </div>
    <div ref={instagramStage} className="instagram-player-stage" aria-busy={loading}>
      {failed ? <div className="instagram-player-unavailable"><img src={reel.image} alt={reel.title} /><p>This reel couldn’t load here. Open the original below.</p></div> : <div className="instagram-embed-frame" style={{ width: 326 * embedScale, height: embedHeight * embedScale }}>
        <iframe ref={instagramFrame} key={instagram.embed} src={instagram.embed} title={`${reel.title} on Instagram`} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen scrolling="no" referrerPolicy="strict-origin-when-cross-origin" style={{ height: embedHeight, transform: `scale(${embedScale})` }} onLoad={() => setLoadedSource(reel.video)} onError={() => setFailedSource(reel.video)} />
      </div>}
    </div>
    <div className="instagram-player-footer">
      {loading && <span className="instagram-loading-status" role="status"><span className="instagram-loading-ring" aria-hidden="true" />Loading reel…</span>}
      <a className="instagram-watch-link" href={instagram.url} target="_blank" rel="noopener noreferrer"><Instagram size={17} aria-hidden="true" /><span>Watch on Instagram</span><ArrowUpRight size={18} aria-hidden="true" /></a>
    </div>
  </div>;
  return <div className="modal-video-wrap">
    {provider.embed ? <iframe src={provider.embed} title={reel.title} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : provider.external || failed ? <div className="reel-external"><img src={reel.image} alt={reel.title} /><div><span className="external-play"><Play size={28} fill="currentColor" /></span><p>{failed ? 'Open the original reel to keep watching.' : `Watch the full story on ${provider.external}.`}</p><a className="button button-lime" href={reel.video} target="_blank" rel="noopener noreferrer">{provider.external ? `Watch on ${provider.external}` : 'Open original reel'}<ArrowUpRight size={18} /></a></div></div> : <video key={reel.video} src={reel.video} poster={reel.image} controls playsInline autoPlay muted loop preload="metadata" onError={() => setFailedSource(reel.video)} aria-label={reel.title} />}
    {/* {reel.demo && <span className="video-stock-label">SAMPLE FOOTAGE</span>} */}
  </div>;
}
