'use client';

import { useState } from 'react';
import { ArrowUpRight, Eye, Instagram, Play, Search, Sparkles, Users } from 'lucide-react';
import type { Brand, Reel } from './lib/content-types';
import { EmptyContent } from './ContentBrowser';
import WorkHero from './WorkHero';
import WorkBrands from './WorkBrands';

type WorkProps = { campaigns: Reel[]; brands: Brand[]; onCampaign: (campaign: Reel) => void };

function Project({ campaign, index, onCampaign }: { campaign: Reel; index: number; onCampaign: WorkProps['onCampaign'] }) {
  return <article className="work-project">
    <button className="work-project-image" onClick={() => onCampaign(campaign)} aria-label={`Watch ${campaign.title}`}>
      <img src={campaign.image} alt={campaign.title} loading="lazy" />
      <span className="work-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span className="work-project-format"><Instagram size={13} aria-hidden="true" /> REEL</span>
      <span className="work-project-play" aria-hidden="true"><Play size={21} fill="currentColor" /></span>
      {campaign.brand && <span className="work-project-tag">{campaign.brand}</span>}
    </button>
    <div className="work-project-heading">
      <div>{campaign.category && <span className="work-project-category">{campaign.category}</span>}<h3><button onClick={() => onCampaign(campaign)}>{campaign.title}</button></h3></div>
      <button className="work-project-open" onClick={() => onCampaign(campaign)} aria-label={`View ${campaign.title}`}><ArrowUpRight size={24} aria-hidden="true" /></button>
    </div>
    {(campaign.creator || campaign.views || campaign.reach) && <div className="work-project-bottom">
      {campaign.creator && <span className="work-project-creator">with {campaign.creator}</span>}
      {(campaign.views || campaign.reach) && <div className="work-project-metrics">
        {campaign.views && <span><Eye size={14} aria-hidden="true" /><strong>{campaign.views}</strong> {campaign.demo ? 'example views' : 'views'}</span>}
        {campaign.reach && <span><Users size={14} aria-hidden="true" /><strong>{campaign.reach}</strong> {campaign.demo ? 'example reach' : 'reach'}</span>}
      </div>}
    </div>}
  </article>;
}

export default function Work({ campaigns, brands, onCampaign }: WorkProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = Array.from(new Set(campaigns.map(campaign => campaign.category).filter(Boolean)));
  const activeCategory = category && categories.includes(category) ? category : null;
  const search = query.toLowerCase().trim();
  const filtered = campaigns.filter(campaign => (!activeCategory || campaign.category === activeCategory) && `${campaign.title} ${campaign.brand} ${campaign.creator} ${campaign.category}`.toLowerCase().includes(search));
  const hasFilters = Boolean(search || activeCategory);

  return <>
    <WorkHero campaigns={campaigns} onCampaign={onCampaign} />

    <section id="work-library" className="work-library" aria-labelledby="work-library-heading">
      <div className="container">
        <div className="work-library-heading"><div><span className="work-kicker">THE COLLECTION</span><h2 id="work-library-heading">The work, up close<span>.</span></h2></div><label className="work-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search stories, brands, or creators" placeholder="Find a story, brand, or creator" value={query} onChange={event => setQuery(event.target.value)} maxLength={150} /></label></div>
        <div className="work-library-toolbar">
          <div className="work-categories" role="group" aria-label="Filter stories by category"><button aria-pressed={!activeCategory} onClick={() => setCategory(null)}>All work</button>{categories.map(value => <button key={value} aria-pressed={activeCategory === value} onClick={() => setCategory(value)}>{value.toLowerCase()}</button>)}</div>
          <span className="work-results" role="status">{String(filtered.length).padStart(2, '0')} {filtered.length === 1 ? 'story' : 'stories'}</span>
        </div>
        {filtered.length > 0 ? <div className="work-projects">{filtered.map((campaign, index) => <Project key={campaign.id} campaign={campaign} index={index} onCampaign={onCampaign} />)}</div> : <div className="work-empty"><EmptyContent title={hasFilters ? 'No stories match just yet.' : 'The next story is on its way.'} text={hasFilters ? 'Try another brand, creator, or category to find your kind of story.' : 'Check back soon for fresh ideas and new connections.'} />{hasFilters && <button className="work-reset" onClick={() => { setQuery(''); setCategory(null); }}>Show all stories <ArrowUpRight size={17} aria-hidden="true" /></button>}</div>}
        <div className="work-library-note"><Sparkles size={20} aria-hidden="true" /><p>Different stories. One thing in common: a connection that counts.</p><a className="work-back-top" href="#work">Back to top <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      </div>
    </section>

    <WorkBrands brands={brands} campaigns={campaigns} onCampaign={onCampaign} />
  </>;
}
