'use client';

import { useState } from 'react';
import { ArrowUpRight, Search, Sparkles, Users } from 'lucide-react';
import type { Creator } from './lib/content-types';
import type { ContactType } from './Sections';
import { EmptyContent } from './ContentBrowser';
import CreatorsHero from './CreatorsHero';

type CreatorsPageProps = { creators: Creator[]; onCreator: (creator: Creator) => void; onContact: (type: ContactType) => void };

function CreatorProfile({ creator, index, onCreator }: { creator: Creator; index: number; onCreator: CreatorsPageProps['onCreator'] }) {
  const [failedSource, setFailedSource] = useState('');
  return <article className="creators-profile">
    <button className="creators-profile-portrait" onClick={() => onCreator(creator)} aria-label={`Meet ${creator.name}`}>
      {failedSource === creator.image ? <span className="creators-profile-placeholder" aria-hidden="true"><Sparkles size={40} /><strong>{creator.name.split(/\s+/).map(value => value[0]).slice(0, 2).join('')}</strong></span> : <img src={creator.image} alt={creator.name} loading="lazy" onError={() => setFailedSource(creator.image)} />}
      <span className="creators-profile-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <span className="creators-profile-arrow" aria-hidden="true"><ArrowUpRight size={20} /></span>
    </button>
    <div className="creators-profile-body">
      {creator.category && <span className="creators-profile-category">{creator.category}</span>}
      <h3><button onClick={() => onCreator(creator)}>{creator.name}</button></h3>
      {creator.specialty && <p className="creators-profile-specialty">{creator.specialty}</p>}
      {creator.bio && <p className="creators-profile-bio">{creator.bio}</p>}
      {(creator.handle || creator.followers) && <div className="creators-profile-meta">{creator.handle && <span>{creator.handle}</span>}{creator.followers && <span><Users size={13} aria-hidden="true" />{creator.followers} {creator.demo ? 'illustrative followers' : 'followers'}</span>}</div>}
      <button className="creators-profile-link" onClick={() => onCreator(creator)}>Meet the creator <ArrowUpRight size={17} aria-hidden="true" /></button>
    </div>
  </article>;
}

export default function CreatorsPage({ creators, onCreator, onContact }: CreatorsPageProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const categories = Array.from(new Set(creators.map(creator => creator.category).filter(Boolean)));
  const activeCategory = category && categories.includes(category) ? category : null;
  const search = query.toLowerCase().trim();
  const filtered = creators.filter(creator => (!activeCategory || activeCategory === creator.category) && `${creator.name} ${creator.handle} ${creator.category} ${creator.bio} ${creator.specialty}`.toLowerCase().includes(search));
  const hasFilters = Boolean(search || activeCategory);

  return <>
    <CreatorsHero creators={creators} onCreator={onCreator} />
    <section className="creators-directory" id="creator-directory" aria-labelledby="creators-directory-heading"><div className="container">
      <div className="creators-directory-heading"><div><span className="creators-kicker"><span /> THE COLLECTIVE</span><h2 id="creators-directory-heading">Find your kind<br />of people<span>.</span></h2></div><div className="creators-directory-intro"><p>Distinct personalities. Fresh perspectives.<br />A shared instinct for making you feel something.</p><button onClick={() => onContact('brand')}>Find your next collaborator <ArrowUpRight size={17} aria-hidden="true" /></button></div></div>
      <div className="creators-toolbar"><div className="creators-categories" role="group" aria-label="Filter creators by category"><button aria-pressed={!activeCategory} onClick={() => setCategory(null)}>All voices</button>{categories.map(value => <button key={value} aria-pressed={activeCategory === value} onClick={() => setCategory(value)}>{value.toLowerCase()}</button>)}</div><label className="creators-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search creators by name, handle, or specialty" placeholder="Find a name, a voice, a vibe…" value={query} onChange={event => setQuery(event.target.value)} maxLength={150} /></label></div>
      <div className="creators-directory-summary"><span role="status">{String(filtered.length).padStart(2, '0')} {filtered.length === 1 ? 'voice' : 'voices'} to discover</span>{creators.some(creator => creator.demo) && <p>Sample profiles use illustrative names and stock portraits.</p>}</div>
      {filtered.length ? <div className="creators-profile-grid">{filtered.map((creator, index) => <CreatorProfile key={creator.id} creator={creator} index={index} onCreator={onCreator} />)}</div> : <div className="creators-empty"><EmptyContent title={hasFilters ? 'Your kind of voice is out there.' : 'Fresh voices are on their way.'} text={hasFilters ? 'Try a different name, specialty, or category to meet more of the collective.' : 'Our circle is always growing. Come back soon to meet the next creators.'} />{hasFilters && <button className="creators-reset" onClick={() => { setQuery(''); setCategory(null); }}>Meet the whole collective <ArrowUpRight size={17} aria-hidden="true" /></button>}</div>}
      <div className="creators-directory-note"><Sparkles size={19} aria-hidden="true" /><p>Different niches. Different stories. A shared creative spark.</p><a href="#creators">Back to the faces <ArrowUpRight size={16} aria-hidden="true" /></a></div>
    </div></section>
    <section className="creators-invite" aria-labelledby="creators-invite-heading"><div className="container"><div className="creators-invite-panel">
      <div className="creators-invite-copy"><span className="creators-kicker">FOR THE NEXT WAVE</span><h2 id="creators-invite-heading">Got your own<br /><em>kind of vivid?</em></h2><p>Your perspective is your superpower. Bring your ideas, your personality, and your own way of seeing the world.</p><button onClick={() => onContact('creator')}>Join the circle <ArrowUpRight size={19} aria-hidden="true" /></button></div>
      <div className="creators-invite-art" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg><span>YOUR VOICE.<br /><strong>YOUR VISION.</strong></span><small>There’s room for your kind of different.</small></div>
    </div></div></section>
  </>;
}
