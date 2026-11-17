'use client';

import { ArrowDown, ArrowUpRight, Eye, Play, Sparkles, Users } from 'lucide-react';
import type { Reel } from './lib/content-types';

type WorkHeroProps = { campaigns: Reel[]; onCampaign: (campaign: Reel) => void };

function HeroStar({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

export default function WorkHero({ campaigns, onCampaign }: WorkHeroProps) {
  const featured = campaigns.find(campaign => campaign.featured) ?? campaigns[0];
  const secondary = campaigns.find(campaign => campaign.id !== featured?.id);
  // Creator portraits are temporarily disabled:
  // const portraits = Array.from(new Map(campaigns.map(campaign => [campaign.creatorId || campaign.image, campaign])).values()).slice(0, 3);
  const metric = featured?.views || featured?.reach;

  return <section id="work" className="work-hero">
    <div className="container">
      <div className="work-hero-topline"><span className="eyebrow"><span /> THE WORK</span><span>INDEPENDENT IDEAS. A VIVID POINT OF VIEW.</span></div>
      <div className="work-hero-layout">
        <div className="work-hero-copy">
          <h1>Made to<br /><span className="work-hero-accent"><em>mean more.</em><HeroStar className="work-hero-heading-star" /></span></h1>
          <p>When the right voices meet a vivid idea, a brand’s story becomes something people feel. This is what that looks like.</p>
          <div className="work-hero-actions"><a className="work-hero-browse" href="#work-library">Explore the work <ArrowDown size={18} aria-hidden="true" /></a>{featured && <button className="work-hero-watch" onClick={() => onCampaign(featured)}><span><Play size={12} fill="currentColor" aria-hidden="true" /></span> Watch a story</button>}</div>
          {/* Creator portraits are temporarily disabled:
          {portraits.length > 0 && <div className="work-hero-community"><div className="work-hero-avatars">{portraits.map(campaign => <img src={campaign.image} key={campaign.id} alt="" />)}</div><div><strong>Different voices. Shared ambition.</strong><span>Made with creators. Built around connection.</span></div></div>}
          */}
        </div>
        <div className="work-hero-art">
          {featured ? <div className="work-hero-stage">
            <div className="work-hero-orbit" aria-hidden="true" /><div className="work-hero-orbit work-hero-orbit-inner" aria-hidden="true" />
            <span className="work-hero-cross" aria-hidden="true">+</span>
            {secondary && <button className="work-hero-peek" onClick={() => onCampaign(secondary)} aria-label={`Watch ${secondary.title}`}><img src={secondary.image} alt={secondary.title} /><span><strong>{secondary.brand || secondary.category || 'Another point of view'}</strong><ArrowUpRight size={17} aria-hidden="true" /></span></button>}
            <button className="work-hero-film" onClick={() => onCampaign(featured)} aria-label={`Watch ${featured.title}`}>
              <img src={featured.image} alt={featured.title} fetchPriority="high" />
              <span className="work-hero-film-label"><span /> IN THE SPOTLIGHT</span>
              <span className="work-hero-film-play" aria-hidden="true"><Play size={24} fill="currentColor" /></span>
              <span className="work-hero-film-caption"><strong>{featured.brand || 'A vivid story'}</strong>{featured.category && <small>{featured.category}</small>}<span><ArrowUpRight size={22} aria-hidden="true" /></span></span>
            </button>
            {/* <div className="work-hero-stamp" aria-hidden="true"><Sparkles size={23} /><span>CREATOR<br /><strong>POWERED.</strong></span></div> */}
            {metric && <div className="work-hero-result">{featured.views ? <Eye size={22} aria-hidden="true" /> : <Users size={22} aria-hidden="true" />}<div><strong>{metric}</strong><span>{/* {featured.demo ? 'Illustrative ' : ''} */}{featured.views ? 'views' : 'reach'}</span></div></div>}
            <span className="work-hero-art-note" aria-hidden="true">Stories with a little more soul.</span>
          </div> : <div className="work-hero-placeholder"><HeroStar /><p>Your next story<br /><em>starts here.</em></p><span>A little imagination. Endless possibility.</span></div>}
        </div>
      </div>
      <div className="work-hero-footnote"><span><span className="tiny-dot" /> REAL VOICES. SHARED CREATIVE ENERGY.</span>{/* {campaigns.some(campaign => campaign.demo) && <p>Sample concepts and figures are illustrative.</p>} */}</div>
    </div>
  </section>;
}
