'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
import type { Creator } from './lib/content-types';

type CreatorsHeroProps = { creators: Creator[]; onCreator: (creator: Creator) => void };

function CreativeStar({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

function Portrait({ creator, index, onCreator }: { creator: Creator; index: number; onCreator: CreatorsHeroProps['onCreator'] }) {
  const [failedSource, setFailedSource] = useState('');
  return <button className="creators-hero-portrait" onClick={() => onCreator(creator)} aria-label={`Meet ${creator.name}`}>
    {failedSource === creator.image ? <span className="creators-hero-portrait-placeholder" aria-hidden="true"><Sparkles size={32} /><strong>{creator.name.split(/\s+/).map(value => value[0]).slice(0, 2).join('')}</strong></span> : <img src={creator.image} alt={creator.name} width="600" height="800" fetchPriority={index === 0 ? 'high' : undefined} onError={() => setFailedSource(creator.image)} />}
    <span className="creators-hero-portrait-top"><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className="creators-hero-portrait-arrow"><ArrowUpRight size={20} aria-hidden="true" /></span></span>
    <span className="creators-hero-portrait-caption"><strong>{creator.name}</strong>{creator.category && <small>{creator.category}</small>}</span>
  </button>;
}

export default function CreatorsHero({ creators, onCreator }: CreatorsHeroProps) {
  const portraits = [...creators.filter(creator => creator.featured), ...creators.filter(creator => !creator.featured)].slice(0, 3);
  const featuredQuote = portraits[1]?.specialty;

  return <section className="creators-hero" id="creators">
    <div className="container">
      <div className="creators-hero-topline"><span className="creators-hero-kicker"><span /> THE CREATOR COLLECTIVE</span><span>INDIVIDUAL VOICES. SHARED AMBITION.</span></div>
      <div className="creators-hero-heading">
        <h1>Different voices.<br /><em>Vivid energy.</em><CreativeStar className="creators-hero-heading-star" /></h1>
        <div className="creators-hero-intro"><p>Distinct personalities. Fresh perspectives. Meet the people who turn everyday moments into stories worth feeling.</p><a href="#creator-directory">Meet the collective <span><ArrowDown size={17} aria-hidden="true" /></span></a></div>
      </div>
      {portraits.length > 0 ? <div className="creators-hero-montage" data-count={portraits.length}>
        {portraits[0] && <article className="creators-hero-tile creators-hero-tile-primary"><Portrait creator={portraits[0]} index={0} onCreator={onCreator} /></article>}
        {portraits[1] && <article className={`creators-hero-tile creators-hero-tile-feature${featuredQuote ? ' has-quote' : ''}`}><Portrait creator={portraits[1]} index={1} onCreator={onCreator} />{featuredQuote && <div className="creators-hero-quote"><Sparkles size={23} strokeWidth={1.25} aria-hidden="true" /><p>{featuredQuote}</p><span>AN INDIVIDUAL POINT OF VIEW</span></div>}</article>}
        {portraits[2] && <article className="creators-hero-tile creators-hero-tile-third"><Portrait creator={portraits[2]} index={2} onCreator={onCreator} /><span className="creators-hero-energy" aria-hidden="true"><CreativeStar /><span>A LITTLE<br /><strong>DIFFERENT.</strong></span></span></article>}
      </div> : <div className="creators-hero-empty"><CreativeStar /><p>Every voice starts<br /><em>with a point of view.</em></p></div>}
      <div className="creators-hero-footnote"><span><span /> REAL PEOPLE. A SHARED CREATIVE SPARK.</span>{creators.some(creator => creator.demo) && <p>Sample profiles use illustrative names and stock portraits.</p>}</div>
    </div>
  </section>;
}
