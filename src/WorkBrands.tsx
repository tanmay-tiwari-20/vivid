'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Brand, Reel } from './lib/content-types';

type WorkBrandsProps = { brands: Brand[]; campaigns: Reel[]; onCampaign: (campaign: Reel) => void };

function BrandWordmark({ brand }: { brand: Brand }) {
  const name = brand.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return <span className={`work-brands-wordmark work-brands-wordmark-${name}`}>
    {name === 'spotify' && <svg className="work-brands-symbol" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="currentColor" /><path d="M7 11c6-2 12-1 18 2M8 16c6-2 11-1 16 2M9 21c5-1 9-1 13 1" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round" /></svg>}
    {name === 'myntra' && <svg className="work-brands-symbol" viewBox="0 0 40 40" aria-hidden="true"><path d="m4 33 8-25 8 19L28 8l8 25" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    {name === 'swiggy' && <svg className="work-brands-symbol work-brands-symbol-pin" viewBox="0 0 25 34" aria-hidden="true"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 23 12.5 34 12.5 34S25 23 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="currentColor" /><path d="M6 11h13v4H9v4h8" fill="none" stroke="var(--bg)" strokeWidth="3" /></svg>}
    <span>{brand.name}</span>
  </span>;
}

function BrandCard({ brand, campaign, onCampaign }: { brand: Brand; campaign?: Reel; onCampaign: WorkBrandsProps['onCampaign'] }) {
  const [failedSource, setFailedSource] = useState('');
  return <article className="work-brands-card">
    <div className="work-brands-mark" aria-hidden="true">{brand.logo && failedSource !== brand.logo ? <img src={brand.logo} alt="" loading="lazy" width="200" height="72" onError={() => setFailedSource(brand.logo)} /> : <BrandWordmark brand={brand} />}</div>
    <div className="work-brands-card-heading">
      <div className="work-brands-details"><h3>{brand.name}</h3>{brand.category && <p className="work-brands-category">{brand.category}</p>}</div>
      {brand.websiteUrl && <a className="work-brands-website" href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${brand.name}'s website (opens in a new tab)`}><ArrowUpRight size={18} aria-hidden="true" /></a>}
    </div>
    {brand.description && <p className="work-brands-description">{brand.description}</p>}
    {campaign && <div className="work-brands-card-bottom"><button className="work-brands-story" onClick={() => onCampaign(campaign)} aria-label={`View ${brand.name}'s story: ${campaign.title}`}>View story <ArrowUpRight size={15} aria-hidden="true" /></button></div>}
  </article>;
}

export default function WorkBrands({ brands, campaigns, onCampaign }: WorkBrandsProps) {
  const publishedBrands = brands.filter(brand => brand.published);
  if (!publishedBrands.length) return null;
  return <section className="work-brands" id="brands" aria-labelledby="work-brands-heading"><div className="container">
    <div className="work-brands-heading"><div><span className="work-brands-kicker"><span aria-hidden="true" /> THE BRAND DIRECTORY</span><h2 id="work-brands-heading">In good <em>company.</em></h2></div><p className="work-brands-intro">From education to emerging tech,<br />meet the brands behind the work.</p></div>
    <div className="work-brands-grid" data-count={publishedBrands.length}>{publishedBrands.map(brand => <BrandCard key={brand.id} brand={brand} campaign={campaigns.find(campaign => campaign.published && campaign.brandId === brand.id)} onCampaign={onCampaign} />)}</div>
  </div></section>;
}
