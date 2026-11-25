'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Asterisk, ChartNoAxesCombined, ChevronDown, UsersRound } from 'lucide-react';
import Link from 'next/link';
import type { Brand /* , Creator */ } from './lib/content-types';
// import { ContentFilters, EmptyContent } from './ContentBrowser';

export type ContactType = 'brand' | 'creator';

type ContactProps = {
  onContact: (type: ContactType) => void;
};

const services = [
  { icon: UsersRound, number: '01', title: 'The right voices.', text: 'We bring brands and creators together through a shared point of view. Because the best partnerships feel like a natural fit.' },
  { icon: AudioLines, number: '02', title: 'Stories that stick.', text: 'Ideas with personality. Content with purpose. We turn brand stories into something people want to watch, share, and remember.' },
  { icon: ChartNoAxesCombined, number: '03', title: 'Impact you can see.', text: 'From the first brief to the final report, we connect creative thinking with a clear plan and a sharper understanding of what works.' },
];

export function About() {
  return (
    <section className="vmw-about container" id="about" aria-labelledby="about-heading">
      <div className="vmw-about-intro">
        <div className="vmw-section-kicker"><span className="eyebrow">THE VIVID WAY</span><span className="vmw-kicker-number">01 — ABOUT US</span></div>
        <div><h2 id="about-heading" className="vmw-about-statement">We don’t just put your brand in the feed. <span className="vmw-muted-text">We make it part of</span> <span className="vmw-lime-text">the conversation.</span></h2><Link className="vmw-text-link" href="/about" style={{ marginTop: 24 }}>Get to know Vivid <ArrowUpRight size={17} /></Link></div>
      </div>
      <div className="vmw-services">
        {services.map(({ icon: Icon, number, title, text }) => (
          <article className="vmw-service" key={number}>
            <div className="vmw-service-top"><Icon size={25} strokeWidth={1.4} /><span>{number}</span></div>
            <h3>{title}</h3><p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BrandWordmark({ brand }: { brand: Brand }) {
  const name = brand.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return <span className={`vmw-brand-wordmark vmw-brand-${name}`}>
    {name === 'spotify' && <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="currentColor"/><path d="M7 11c6-2 12-1 18 2M8 16c6-2 11-1 16 2M9 21c5-1 9-1 13 1" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg>}
    {name === 'myntra' && <span className="vmw-myntra-mark" aria-hidden="true">M</span>}
    {name === 'swiggy' && <svg viewBox="0 0 25 34" aria-hidden="true"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 23 12.5 34 12.5 34S25 23 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="currentColor"/><path d="M6 11h13v4H9v4h8" fill="none" stroke="var(--bg)" strokeWidth="3"/></svg>}
    <span className="vmw-brand-label">{brand.name}</span>
  </span>;
}

function BrandMark({ brand }: { brand: Brand }) {
  const [failedSource, setFailedSource] = useState('');
  return brand.logo && failedSource !== brand.logo
    ? <img className="vmw-brand-logo" src={brand.logo} alt={brand.name} loading="lazy" width="220" height="96" onError={() => setFailedSource(brand.logo)} />
    : <BrandWordmark brand={brand} />;
}

function BrandTile({ brand, duplicate = false }: { brand: Brand; duplicate?: boolean }) {
  return <article className="vmw-brand-tile">
    <div className="vmw-brand-tile-mark" aria-hidden="true"><BrandMark brand={brand} /></div>
    <div className="vmw-brand-tile-bottom">
      <div className="vmw-brand-tile-details"><h3>{brand.name}</h3>{brand.category && <p>{brand.category}</p>}</div>
      {brand.websiteUrl && <a className="vmw-brand-tile-link" href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : undefined} aria-label={`Visit ${brand.name}'s website (opens in a new tab)`}><ArrowUpRight size={19} aria-hidden="true" /></a>}
    </div>
    {brand.description && <p className="vmw-brand-tile-description">{brand.description}</p>}
  </article>;
}

function BrandRail({ brands, reverse, paused }: { brands: Brand[]; reverse: boolean; paused: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const rail = viewport.current;
    const firstGroup = group.current;
    if (!rail || !firstGroup || paused) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let loopWidth = firstGroup.offsetWidth;
    let position = rail.scrollLeft;

    const animate = (time: number) => {
      frame = 0;
      if (!visible || motion.matches || document.hidden || !loopWidth) return;
      if (!initialized.current) {
        position = reverse ? 128 : 0;
        initialized.current = true;
      }
      // Native scrolling keeps swipe browsing and keyboard focus in the same coordinate space.
      const distance = lastTime ? Math.min(time - lastTime, 48) * .026 : 0;
      lastTime = time;
      position = (position + (reverse ? -distance : distance) + loopWidth) % loopWidth;
      rail.scrollLeft = position;
      frame = window.requestAnimationFrame(animate);
    };
    const syncAnimation = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      position = rail.scrollLeft;
      if (visible && !motion.matches && !document.hidden) frame = window.requestAnimationFrame(animate);
    };
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncAnimation();
    }, { rootMargin: '80px' });
    const resize = new ResizeObserver(() => {
      loopWidth = firstGroup.offsetWidth;
      syncAnimation();
    });
    intersection.observe(rail);
    resize.observe(firstGroup);
    motion.addEventListener('change', syncAnimation);
    document.addEventListener('visibilitychange', syncAnimation);
    return () => {
      window.cancelAnimationFrame(frame);
      intersection.disconnect();
      resize.disconnect();
      motion.removeEventListener('change', syncAnimation);
      document.removeEventListener('visibilitychange', syncAnimation);
    };
  }, [brands, reverse, paused]);

  return <div className="vmw-brand-rail" ref={viewport}>
    <div className="vmw-brand-rail-track">
      <div className="vmw-brand-rail-group" ref={group}>{brands.map(brand => <BrandTile key={brand.id} brand={brand} />)}</div>
      <div className="vmw-brand-rail-group vmw-brand-rail-copy" aria-hidden="true">{brands.map(brand => <BrandTile key={brand.id} brand={brand} duplicate />)}</div>
    </div>
  </div>;
}

export function Brands({ brands, fullPage = false }: { brands: Brand[]; fullPage?: boolean }) {
  const [browsing, setBrowsing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const browsingTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(browsingTimer.current), []);
  const resumeAfterBrowsing = () => {
    window.clearTimeout(browsingTimer.current);
    setBrowsing(true);
    browsingTimer.current = window.setTimeout(() => setBrowsing(false), 2500);
  };
  const publishedBrands = useMemo(() => brands.filter(brand => brand.published), [brands]);
  const rows = useMemo(() => {
    const split = Math.ceil(publishedBrands.length / 2);
    return [publishedBrands.slice(0, split), publishedBrands.slice(split)];
  }, [publishedBrands]);
  if (!publishedBrands.length) return null;
  const moving = publishedBrands.length > 6;

  if (!fullPage) return <section className="vmw-brands vmw-brands-showcase" id="brands" aria-labelledby="brands-heading">
    <div className="container vmw-brand-showcase-heading">
      <div><h2 className="section-heading" id="brands-heading">Big names.<br /><span className="vmw-brand-heading-accent">Vivid connections.</span></h2></div>
      <div className="vmw-brand-showcase-intro"><span className="vmw-brand-lineup-label"><Asterisk size={17} aria-hidden="true" /> THE COMPANY WE KEEP</span><p>Different worlds. Shared ambition.<br />Meet the brands we bring into the conversation.</p></div>
    </div>
    <div className={`vmw-brand-showcase-rails${moving ? '' : ' is-static'}`}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={event => { if (event.pointerType !== 'mouse') { window.clearTimeout(browsingTimer.current); setBrowsing(true); } }}
      onPointerUp={event => { if (event.pointerType !== 'mouse') resumeAfterBrowsing(); }}
      onPointerCancel={event => { if (event.pointerType !== 'mouse') resumeAfterBrowsing(); }}
      onWheel={event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) resumeAfterBrowsing(); }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      {moving ? rows.map((row, index) => <BrandRail key={index} brands={row} reverse={index === 1} paused={browsing || hovered || focused} />) : <div className="container vmw-brand-showcase-grid">{publishedBrands.map(brand => <BrandTile key={brand.id} brand={brand} />)}</div>}
    </div>
    <div className="container vmw-brand-showcase-footer">
      <div className="vmw-brand-showcase-note"><span className="vmw-brand-count">{String(publishedBrands.length).padStart(2, '0')}</span><p>Distinct brands.<br /><strong>One shared creative energy.</strong></p></div>
      <div className="vmw-brand-showcase-actions">
        <Link className="vmw-text-link" href="/work">See the stories <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </div>
  </section>;

  return (
    <section className="vmw-brands vmw-brands-dynamic vmw-brands-work" id="brands" aria-labelledby="brands-heading">
      <div className="container vmw-brand-directory">
        <div className="vmw-brand-directory-heading">
          <div><span className="eyebrow">BRANDS IN THE SPOTLIGHT</span><h2 className="section-heading" id="brands-heading">The brands behind<br/><span className="vmw-lime-text">the stories.</span></h2></div>
          <p>A closer look at the names, ideas, and ambitions that make every story distinct.</p>
        </div>
        <div className="vmw-brand-grid">
          {publishedBrands.map(brand => <article className="vmw-brand-card" key={brand.id}>
            <div className="vmw-brand-card-mark" aria-hidden="true"><BrandMark brand={brand} /></div>
            <div className="vmw-brand-card-details"><h3>{brand.name}</h3>{brand.category && <p className="vmw-brand-category">{brand.category}</p>}{brand.description && <p className="vmw-brand-description">{brand.description}</p>}</div>
            {brand.websiteUrl && <a className="vmw-brand-website" href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${brand.name}'s website (opens in a new tab)`}>Visit website <ArrowUpRight size={16} /></a>}
          </article>)}
        </div>
      </div>
    </section>
  );
}

/* Creators are temporarily disabled. Keep this section available for restoration.
export function Creators({ onContact, creators, onCreator, fullPage = false }: ContactProps & { creators: Creator[]; onCreator: (creator: Creator) => void; fullPage?: boolean }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = Array.from(new Set(creators.map(creator => creator.category)));
  const filtered = creators.filter(creator => (category === 'All' || creator.category === category) && `${creator.name} ${creator.category} ${creator.handle} ${creator.bio}`.toLowerCase().includes(query.toLowerCase().trim()));
  return (
    <section className={`vmw-creators container${fullPage ? ' collection-page' : ''}`} id="creators" aria-labelledby="creators-heading">
      <div className="vmw-creators-header">
        <div><span className="eyebrow">THE PEOPLE BEHIND THE IMPACT</span><h2 className="section-heading" id="creators-heading">Main character<br/><span className="vmw-lime-text">energy.</span></h2></div>
        <div className="vmw-creators-intro"><p>Different voices. Distinct perspectives.<br/>A shared talent for making you feel something.</p>{fullPage ? <button className="vmw-text-link" onClick={() => onContact('brand')}>Find your next collaborator <ArrowUpRight size={17}/></button> : <Link className="vmw-text-link" href="/creators">Meet all the creators <ArrowUpRight size={17}/></Link>}</div>
      </div>
      {fullPage && <ContentFilters query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} label="creators" count={filtered.length} />}
      {filtered.length ? <div className="vmw-creators-grid">
        {filtered.map((creator, index) => (
          <article className="vmw-creator content-enter" key={creator.id}>
            <button className="vmw-creator-portrait" onClick={() => onCreator(creator)} aria-label={`Meet ${creator.name}`}>
              <img src={creator.image} alt={`${creator.name}, ${creator.category.toLowerCase()} creator`} loading="lazy" width="600" height="800"/>
              <span className="vmw-creator-index">{String(index + 1).padStart(2, '0')}</span><span className="vmw-creator-arrow"><ArrowUpRight size={22}/></span>
              <span className="vmw-creator-specialty">{creator.specialty}</span>
            </button>
            <div className="vmw-creator-details"><h3><button onClick={() => onCreator(creator)}>{creator.name}</button></h3><p>{creator.category}</p>{(creator.handle || creator.followers) && <div className="creator-card-meta"><span>{creator.handle}</span><span>{creator.followers && `${creator.followers} followers`}</span></div>}</div>
          </article>
        ))}
      </div> : <EmptyContent title={query || category !== 'All' ? 'No creators match this search.' : 'Fresh voices are on their way.'} text={query || category !== 'All' ? 'Try a different name or category.' : 'Our circle is always growing. Come back soon to meet the next creators.'} />}
      <div className="vmw-creators-bottom"><p>{creators.some(creator => creator.demo) ? 'Sample profiles use illustrative names and stock portraits.' : 'Individual voices. A shared creative spark.'}</p><button className="vmw-text-link" onClick={() => onContact('creator')}>Got your own kind of vivid? Join the circle <ArrowUpRight size={17}/></button></div>
    </section>
  );
}

*/

const strategySteps = [
  { title: 'First, we get you.', text: 'Your brand. Your people. Your next big goal. We ask the right questions and listen closely, so every creative decision starts with a clear understanding of what matters.' },
  { title: 'Find your kind of people.', text: 'We look beyond follower counts to find creators with the right audience, perspective, and connection to your brand. A good fit makes the story feel effortless.' },
  { title: 'Make something worth feeling.', text: 'Together, we shape ideas that give creators room to be themselves. Then we bring the details together — the brief, the production, the timing, and the launch.' },
  { title: 'Keep the momentum going.', text: 'We track what people watched, shared, and connected with. Those insights help us refine the next move and build on what is working for your brand.' },
];

export function Strategy() {
  const [active, setActive] = useState<number | null>(0);
  return (
    <section className="vmw-strategy" id="strategy" aria-labelledby="strategy-heading">
      <div className="container vmw-strategy-layout">
        <div className="vmw-strategy-intro"><span className="eyebrow">THE METHOD BEHIND THE MAGIC</span><h2 className="section-heading" id="strategy-heading">Less guesswork.<br/>More <span className="vmw-lime-text">game plan.</span></h2><p>Great content doesn’t happen by accident.<br/>Here’s how we make every move count.</p><Link className="vmw-text-link" href="/approach" style={{ marginTop: 20 }}>Explore our approach <ArrowUpRight size={17} aria-hidden="true" /></Link><div className="vmw-strategy-signoff"><Asterisk size={56} strokeWidth={1.3}/><span>BUILT ON INSIGHT.<br/>BROUGHT TO LIFE BY PEOPLE.</span></div></div>
        <div className="vmw-strategy-steps">
          {strategySteps.map((step, index) => {
            const open = active === index;
            return <article className={`vmw-strategy-step${open ? ' is-open' : ''}`} key={step.title}>
              <h3><button id={`strategy-toggle-${index}`} className="vmw-strategy-toggle" aria-expanded={open} aria-controls={`strategy-panel-${index}`} onClick={() => setActive(open ? null : index)}><span className="vmw-step-number">0{index + 1}</span><span className="vmw-step-title">{step.title}</span><ChevronDown size={20}/></button></h3>
              <div className="vmw-strategy-panel" id={`strategy-panel-${index}`} role="region" aria-labelledby={`strategy-toggle-${index}`} hidden={!open}><p>{step.text}</p></div>
            </article>;
          })}
        </div>
      </div>
    </section>
  );
}

export function Footer({ onContact }: ContactProps) {
  return (
    <footer id="contact" className="vmw-footer">
      <div className="vmw-footer-cta"><div className="container"><div className="vmw-footer-cta-top"><span>GOT A BIG IDEA? WE’RE ALL EARS.</span><Asterisk size={29} strokeWidth={1.5}/></div><div className="vmw-footer-cta-main"><h2>Let’s make<br/>some noise.</h2><button onClick={() => onContact('brand')} className="vmw-footer-contact" aria-label="Start a conversation with Vivid Media Works"><ArrowUpRight strokeWidth={1.1}/><span>LET’S TALK</span></button></div><div className="vmw-footer-cta-bottom"><p>Good things start with a conversation.</p><span>YOUR NEXT CHAPTER, IN VIVID.</span></div></div></div>
      <div className="container vmw-footer-bottom"><Link href="/" className="vmw-footer-logo" aria-label="Vivid Media Works home"><img src="/images/vivid-logo-light.png" alt="Vivid Media Works" width="1200" height="540"/></Link><nav aria-label="Footer navigation"><Link href="/about">About</Link><Link href="/work">Our work</Link>{/* Creators are temporarily disabled: <Link href="/creators">Creators</Link> */}<Link href="/approach">Our approach</Link><button onClick={() => onContact('brand')}>Let’s talk <ArrowUpRight size={14}/></button></nav></div>
      <div className="container vmw-footer-fineprint"><p>© {new Date().getFullYear()} Vivid Media Works.</p><p>Made to connect. Built to stand out.</p><a href="#main" aria-label="Back to top">BACK TO TOP <ArrowUpRight size={13}/></a></div>
    </footer>
  );
}
