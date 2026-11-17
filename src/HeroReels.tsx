'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Eye, Instagram, Play, Users } from 'lucide-react';
import type { Reel } from './lib/content-types';

function metricCount(value: string): number {
  const match = value.replace(/,/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([kmb])?\+?(?:\s+(?:views|reach))?$/i);
  if (!match) return 0;
  const multiplier = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }[match[2]?.toLowerCase() as 'k' | 'm' | 'b'] || 1;
  return Number(match[1]) * multiplier;
}

function popularReels(campaigns: Reel[]): Reel[] {
  return campaigns.filter(reel => reel.published && reel.featured).sort((a, b) =>
    metricCount(b.views) - metricCount(a.views)
    || metricCount(b.reach) - metricCount(a.reach)
    || Number(b.featured) - Number(a.featured)
  ).slice(0, 3);
}

function ReelStar() {
  return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

function HeroReel({ reel, position, onCampaign }: { reel: Reel; position: 'main' | 'left' | 'right'; onCampaign: (reel: Reel) => void }) {
  const [failedSource, setFailedSource] = useState('');
  const metric = reel.views || reel.reach;
  const metricLabel = reel.views ? 'views' : 'reach';
  return <button className={`hero-reel hero-reel-${position}`} onClick={() => onCampaign(reel)} aria-label={`Play reel: ${reel.title}`}>
    {reel.image && failedSource !== reel.image
      ? <img src={reel.image} alt="" width="450" height="800" fetchPriority={position === 'main' ? 'high' : undefined} onError={() => setFailedSource(reel.image)} />
      : <span className="hero-reel-fallback"><ReelStar /></span>}
    <span className="hero-reel-shade" />
    <span className="hero-reel-brand"><Instagram size={14} aria-hidden="true" />{reel.brand || 'Vivid reel'}</span>
    <span className="hero-reel-play" aria-hidden="true"><Play size={position === 'main' ? 24 : 18} fill="currentColor" /></span>
    <span className="hero-reel-caption">
      {reel.category && <small>{reel.category}</small>}
      <strong>{reel.title}</strong>
      {metric && <span className="hero-reel-stats">{reel.views ? <Eye size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}<span>{metric}</span><small>{metricLabel}</small></span>}
    </span>
  </button>;
}

export default function HeroReels({ campaigns, onCampaign }: { campaigns: Reel[]; onCampaign: (reel: Reel) => void }) {
  const reels = popularReels(campaigns);
  const leading = reels[0];
  const metric = leading?.views || leading?.reach;
  return <div className="hero-art hero-reels" data-count={reels.length} role="group" aria-label="Popular campaign reels">
    <div className="art-orbit orbit-one" aria-hidden="true" /><div className="art-orbit orbit-two" aria-hidden="true" />
    <span className="art-cross cross-one" aria-hidden="true">+</span><span className="art-cross cross-two" aria-hidden="true">+</span>
    <div className="hero-reels-heading"><span className="live-dot" /> REELS IN THE SPOTLIGHT</div>
    {reels[1] && <HeroReel reel={reels[1]} position="left" onCampaign={onCampaign} />}
    {reels[2] && <HeroReel reel={reels[2]} position="right" onCampaign={onCampaign} />}
    {leading ? <HeroReel reel={leading} position="main" onCampaign={onCampaign} /> : <Link className="hero-reels-empty" href="/work"><ReelStar /><strong>Your next<br />vivid story.</strong><span>Explore the work <ArrowUpRight size={18} /></span></Link>}
    <div className="hero-reels-stamp" aria-hidden="true"><ReelStar /><small>PRESS PLAY</small><strong>FEEL<br />SOMETHING.</strong></div>
    {metric && <div className="hero-reels-result"><span className="hero-reels-result-icon"><Play size={20} fill="currentColor" aria-hidden="true" /></span><div><small>THE VIVID EFFECT</small><strong>{metric}</strong><span>{leading.views ? 'views' : 'reach'}</span></div><ArrowUpRight size={20} aria-hidden="true" /></div>}
    <div className="hero-reels-note" aria-hidden="true">Good stories.<br />Great company.<svg viewBox="0 0 100 50" fill="none"><path d="M6 40C48 48 78 29 77 7M64 16 78 4 88 21" /></svg></div>
  </div>;
}
