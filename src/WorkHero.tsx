'use client';

import { ArrowDown, ArrowUpRight, Eye, Play, Users } from 'lucide-react';
import type { Reel } from './lib/content-types';

type WorkHeroProps = { campaigns: Reel[]; onCampaign: (campaign: Reel) => void };

export default function WorkHero({ campaigns, onCampaign }: WorkHeroProps) {
  const featured = campaigns.find(campaign => campaign.featured) ?? campaigns[0];
  const secondary = campaigns.find(campaign => campaign.id !== featured?.id);
  const metric = featured?.views || featured?.reach;

  return <section id="work" className="work-hero" aria-labelledby="work-hero-heading">
    <div className="container">
      <div className="work-hero-layout">
        <div className="work-hero-copy">
          <span className="work-hero-kicker"><span /> OUR WORK</span>
          <h1 id="work-hero-heading">Made to<br /><em>mean more.</em></h1>
          <p>Good stories do more than fill a feed. They bring brands and people closer. Here’s what that looks like.</p>
          <div className="work-hero-actions">
            <a className="work-hero-browse" href="#work-library">Explore the work <ArrowDown size={18} aria-hidden="true" /></a>
            {featured && <button className="work-hero-watch" onClick={() => onCampaign(featured)}><span><Play size={12} fill="currentColor" aria-hidden="true" /></span> Watch a story</button>}
          </div>
          <div className="work-hero-copy-note"><span className="work-hero-note-line" aria-hidden="true" /><span>Different voices.<br /><strong>One vivid point of view.</strong></span></div>
        </div>

        <div className="work-hero-art">
          {featured ? <div className="work-hero-stage">
            <button className="work-hero-film" onClick={() => onCampaign(featured)} aria-label={`Watch ${featured.title}`}>
              <img src={featured.image} alt={featured.title} fetchPriority="high" />
              <span className="work-hero-film-topline"><span className="work-hero-film-label"><span /> FEATURED STORY</span>{metric && <span className="work-hero-result">{featured.views ? <Eye size={14} aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}<strong>{metric}</strong><span>{featured.views ? 'views' : 'reach'}</span></span>}</span>
              <span className="work-hero-film-play" aria-hidden="true"><Play size={23} fill="currentColor" /></span>
              <span className="work-hero-film-caption">
                <span className="work-hero-film-brand">{featured.brand || 'A vivid story'}</span>
                <strong>{featured.title}</strong>
                {featured.category && <small>{featured.category}</small>}
                <span className="work-hero-film-arrow" aria-hidden="true"><ArrowUpRight size={22} /></span>
              </span>
            </button>
            {secondary && <button className="work-hero-peek" onClick={() => onCampaign(secondary)} aria-label={`Watch ${secondary.title}`}>
              <span className="work-hero-peek-image"><img src={secondary.image} alt="" loading="lazy" /><Play size={15} fill="currentColor" aria-hidden="true" /></span>
              <span className="work-hero-peek-copy"><small>{secondary.brand || secondary.category || 'Another story'}</small><strong>{secondary.title}</strong></span>
              <span className="work-hero-peek-arrow" aria-hidden="true"><ArrowUpRight size={21} /></span>
            </button>}
          </div> : <div className="work-hero-placeholder"><span className="work-hero-placeholder-icon" aria-hidden="true"><ArrowUpRight size={40} /></span><p>Your next story<br /><em>starts here.</em></p><span>A little imagination. Endless possibility.</span></div>}
        </div>
      </div>
      <div className="work-hero-footnote"><span>BRANDS. PEOPLE. CULTURE.</span><a href="#work-library">A closer look <ArrowDown size={14} aria-hidden="true" /></a></div>
    </div>
  </section>;
}
