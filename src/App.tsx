'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, ArrowDown, Play, Menu, X, Plus, Instagram, Eye, Users, Check, Download, Sparkles } from 'lucide-react';
import { About, Brands, Strategy, Footer, type ContactType } from './Sections';
// import { Creators } from './Sections'; // Creators are temporarily disabled.
import Link from 'next/link';
import type { Reel, Creator, SiteContent } from './lib/content-types';
import { ContentFilters, EmptyContent, usePublicContent } from './ContentBrowser';
import ReelPlayer from './ReelPlayer';
import Work from './Work';
import HeroReels from './HeroReels';
// import CreatorsPage from './CreatorsPage';
import AboutPage from './AboutPage';
import ApproachPage from './ApproachPage';

type ContactHandler = (type: ContactType) => void;
type Campaign = Reel;
type CampaignHandler = (campaign: Campaign) => void;
type Brief = { name: string; email: string; company: string; message: string; type: ContactType };

function Nav({ onContact, page }: { onContact: ContactHandler; page: string }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const scrollPosition = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
    let previousY = scrollPosition();
    let movement = 0;
    let frame = 0;
    setHidden(false);
    const update = () => {
      frame = 0;
      const currentY = scrollPosition();
      const delta = currentY - previousY;
      previousY = currentY;
      if (open || currentY <= 16 || header.current?.querySelector(':focus-visible')) {
        movement = 0;
        setHidden(false);
        return;
      }
      if (!delta) return;
      movement = Math.sign(delta) === Math.sign(movement) ? movement + delta : delta;
      if (Math.abs(movement) < 8) return;
      setHidden(movement > 0 && currentY > (header.current?.offsetHeight ?? 76));
      movement = 0;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [open, page]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return <div className="nav-space"><header ref={header} className={`site-header${hidden && !open ? ' is-hidden' : ''}`} onFocusCapture={() => setHidden(false)}>
    <div className="container nav-inner">
      <Link className="brand-logo" href="/" aria-label="Vivid Media Works home" onClick={() => setOpen(false)}><img src="/images/vivid-logo.svg" alt="Vivid Media Works" width="289" height="98" /></Link>
      <nav className="desktop-nav" aria-label="Main navigation"><Link href="/about" aria-current={page === 'about' ? 'page' : undefined}>Who we are</Link><Link href="/work" aria-current={page === 'work' ? 'page' : undefined}>Our work</Link>{/* <Link href="/creators" aria-current={page === 'creators' ? 'page' : undefined}>The creators</Link> */}<Link href="/approach" aria-current={page === 'approach' ? 'page' : undefined}>Our approach</Link></nav>
      <button className="nav-cta" onClick={() => onContact('brand')}>Let’s talk <ArrowUpRight size={17} /></button>
      <button ref={menuButton} className="menu-toggle icon-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-nav">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{[
      ['Who we are', '/about'], ['Our work', '/work'],
      // ['The creators', '/creators'],
      ['Our approach', '/approach'],
    ].map(([label, href]) => <Link key={href} href={href} aria-current={href === `/${page}` ? 'page' : undefined} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={20} /></Link>)}<button onClick={() => { setOpen(false); menuButton.current?.focus(); onContact('brand'); }}>Let’s talk <ArrowUpRight size={20} /></button></nav>}
  </header></div>;
}

function Star({ className = '' }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

// function Hero({ onContact, creators, onCreator }: { onContact: ContactHandler; creators: Creator[]; onCreator: (creator: Creator) => void }) {
function Hero({ onContact, campaigns, onCampaign }: { onContact: ContactHandler; campaigns: Reel[]; onCampaign: CampaignHandler }) {
  return <section id="home" className="hero">
    <div className="container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow hero-eyebrow"><span /> SMALL TEAM. BIG CREATOR ENERGY.</div>
        <h1>Don’t just<br />show up.<br /><span>Stand out.</span><Star className="heading-star" /></h1>
        <p>We bring brands, creators, and culture together.<br className="desktop-break" /> For content that connects. And influence that lasts.</p>
        <div className="hero-actions"><button className="button button-lime" onClick={() => onContact('brand')}>Let’s make it vivid <ArrowUpRight size={20} /></button><a className="text-button" href="#work"><span className="small-play"><Play size={12} fill="currentColor" /></span> Explore the work</a></div>
        {/* Creator portraits are temporarily disabled.
        <div className="hero-social-proof"><div className="mini-avatars">{creators.slice(0, 3).map(creator => <img key={creator.id} src={creator.image} alt="" />)}<span><Plus size={15} /></span></div><div>Different voices.<br /><strong>One vivid vision.</strong></div></div>
        */}
      </div>
      {/* <div className={`hero-art${creators.length < 3 ? ' hero-art-sparse' : ''}`} aria-label="Meet our featured creators"> */}
      <HeroReels campaigns={campaigns} onCampaign={onCampaign} />
      {/* Previous hero artwork retained for later.
      <div className="hero-art hero-art-sparse" aria-label="Explore our work">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
        Creator profile cards are temporarily disabled.
        {creators[1] && <button className="hero-photo photo-left" onClick={() => onCreator(creators[1])} aria-label={`Meet ${creators[1].name}`}><img src={creators[1].image} alt={creators[1].name} fetchPriority="high" /><span className="photo-mini-label"><Instagram size={13} /> {creators[1].name}</span><span className="photo-small-play"><ArrowUpRight size={17} /></span></button>}
        {creators[2] && <button className="hero-photo photo-right" onClick={() => onCreator(creators[2])} aria-label={`Meet ${creators[2].name}`}><img src={creators[2].image} alt={creators[2].name} fetchPriority="high" /><span className="photo-mini-label">{creators[2].specialty}</span></button>}
        {creators[0] ? <button className="hero-photo photo-main" onClick={() => onCreator(creators[0])} aria-label={`Meet ${creators[0].name}`}><img src={creators[0].image} alt={creators[0].name} fetchPriority="high" /><span className="photo-topline"><span className="live-dot" /> THE VIVID EFFECT <Instagram size={17} /></span><span className="photo-caption">{creators[0].name}<br /><small>{creators[0].specialty}</small><span className="caption-arrow"><ArrowUpRight size={22} /></span></span></button> : <Link className="hero-photo photo-main hero-placeholder" href="/creators"><Star /><span>Different voices.<br />Endless possibility.<ArrowUpRight /></span></Link>}
        <div className="creator-sticker"><Star /><span>CREATOR<br /><strong>POWERED.</strong></span></div>
        <Link className="hero-photo photo-main hero-placeholder" href="/work"><Star /><span>Vivid ideas.<br />Endless possibility.<ArrowUpRight /></span></Link>
        <div className="impact-sticker"><span className="impact-icon"><ArrowUpRight size={23} /></span><span>Made to stop<br /><strong>the scroll.</strong></span><svg viewBox="0 0 80 38" aria-hidden="true"><path d="m2 31 14-8 11 5 13-18 10 7L76 2" /><path d="M61 2h15v15" /></svg></div>
        <div className="scribble-note">a little different.<br />a lot more vivid.<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M2 5C17 39 57 36 81 16M69 13l15 1-5 15" /></svg></div>
      </div>
      */}
    </div>
    <div className="container hero-bottom"><span>INDEPENDENT MINDS. <strong>CONNECTED BY CULTURE.</strong></span><a href="#about">SCROLL TO GET TO KNOW US <ArrowDown size={15} /></a><span className="hero-location"><span /> BASED IN INDIA. THINKING EVERYWHERE.</span></div>
  </section>;
}

function ReelCard({ campaign, onCampaign }: { campaign: Campaign; onCampaign: CampaignHandler }) {
  return <article className="campaign-card content-enter">
    <button className="reel-cover" style={{ '--card-tint': campaign.color } as CSSProperties} onClick={() => onCampaign(campaign)} aria-label={`Watch ${campaign.title}`}><img loading="lazy" src={campaign.image} alt={campaign.title} /><span className="reel-shade" /><span className={`reel-brand brand-${campaign.brand.toLowerCase().replace(/[^a-z]/g, '')}`}>{campaign.brand}</span><span className="reel-type"><Instagram size={13} /> REEL</span><span className="reel-play"><Play size={22} fill="currentColor" /></span><span className="reel-caption"><span>{campaign.category}</span><strong>{campaign.title}</strong>{/* {campaign.creator && <span className="reel-creator">with {campaign.creator}<ArrowUpRight size={18} /></span>} */}</span></button>
    {(campaign.views || campaign.reach) && <div className="reel-metrics">{campaign.views && <div><Eye size={15} /><strong>{campaign.views}</strong><span>views</span></div>}{campaign.reach && <div><Users size={14} /><strong>{campaign.reach}</strong><span>reach</span></div>}</div>}
  </article>;
}

function Campaigns({ campaigns, onCampaign, fullPage = false }: { campaigns: Campaign[]; onCampaign: CampaignHandler; fullPage?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = Array.from(new Set(campaigns.map(reel => reel.category)));
  // const filtered = campaigns.filter(reel => (category === 'All' || reel.category === category) && `${reel.title} ${reel.brand} ${reel.creator} ${reel.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  const filtered = campaigns.filter(reel => (category === 'All' || reel.category === category) && `${reel.title} ${reel.brand} ${reel.category}`.toLowerCase().includes(query.toLowerCase().trim()));
  const move = (direction: number) => {
    const card = track.current?.querySelector('.campaign-card');
    if (card && track.current) track.current.scrollBy({ left: (card.getBoundingClientRect().width + 22) * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const update = () => { const el = track.current; if (el) { setPosition(el.scrollLeft); setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); } };
  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [campaigns.length]);
  return <section id="work" className={`campaigns section-space${fullPage ? ' collection-page' : ''}`}>
    <div className="container">
      <div className="eyebrow"><span /> GOOD CONTENT. GREAT COMPANY.</div>
      <div className="campaign-heading"><h2>Less scrolling.<br /><span className="serif-accent">More stopping.</span></h2><div className="campaign-intro"><p>Stories made for the feed.<br />Connections made to go beyond it.</p>{!fullPage && <div className="carousel-controls"><button className="icon-button" onClick={() => move(-1)} disabled={position < 4} aria-label="Previous campaigns"><ArrowLeft size={21} /></button><button className="icon-button" onClick={() => move(1)} disabled={atEnd || !campaigns.length} aria-label="Next campaigns"><ArrowRight size={21} /></button></div>}</div></div>
      {fullPage && <ContentFilters query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} label="reels" count={filtered.length} />}
      {filtered.length ? <div className={fullPage ? 'reels-grid' : 'campaign-track'} ref={track} onScroll={update} aria-label={fullPage ? 'All campaign reels' : 'Featured campaign reels'} aria-roledescription={fullPage ? undefined : 'carousel'} tabIndex={fullPage ? undefined : 0}>
        {filtered.map(campaign => <ReelCard key={campaign.id} campaign={campaign} onCampaign={onCampaign} />)}
      </div> : <EmptyContent title={query || category !== 'All' ? 'No reels match this search.' : 'The next story is on its way.'} text={query || category !== 'All' ? 'Try another name, brand, or category.' : 'Check back soon for fresh stories from our creators.'} />}
      <div className="campaign-footnote"><span><span className="tiny-dot" /> {fullPage ? 'STORIES WITH A POINT OF VIEW' : 'A LITTLE TASTE OF WHAT’S POSSIBLE'}</span>{!fullPage && <Link className="vmw-text-link" href="/work">Explore all work <ArrowUpRight size={17} /></Link>}{/* {campaigns.some(reel => reel.demo) && <p>Sample campaigns and figures are illustrative.</p>} */}</div>
    </div>
  </section>;
}

function Modal({ children, onClose, title, className = '' }: { children: ReactNode; onClose: () => void; title: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      if (!ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, video[controls], iframe, [tabindex="0"]')).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current || !ref.current.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current || !ref.current.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={21} /></button>{children}</div></div>;
}

// function CampaignModal({ campaign, onClose, onContact, creator, onCreator }: { campaign: Campaign; onClose: () => void; onContact: ContactHandler; creator?: Creator; onCreator: (creator: Creator) => void }) {
function CampaignModal({ campaign, onClose, onContact }: { campaign: Campaign; onClose: () => void; onContact: ContactHandler }) {
  return <Modal onClose={onClose} title={campaign.title} className="campaign-modal"><ReelPlayer reel={campaign} /><div className="campaign-detail"><div className="eyebrow"><span /> {campaign.category}</div><span className="detail-brand">{campaign.brand}</span><h2>{campaign.title}</h2><p>{campaign.description}</p>{/* {campaign.creator && <div className="detail-creator">Created with {creator ? <button className="creator-inline-link" onClick={() => onCreator(creator)}>{creator.name}<ArrowUpRight size={14} /></button> : <strong>{campaign.creator}</strong>}</div>} */}{(campaign.views || campaign.reach) && <div className="detail-metrics">{campaign.views && <div><strong>{campaign.views}</strong><span>Views</span></div>}{campaign.reach && <div><strong>{campaign.reach}</strong><span>Reach</span></div>}</div>}<button className="button button-lime" onClick={() => onContact('brand')}>Create a story like this <ArrowUpRight size={18} /></button>{/* {campaign.demo && <p className="disclosure">A sample concept with stock media. Creator profiles, brand associations, and figures are illustrative.</p>} */}</div></Modal>;
}

/* Creator profiles are temporarily disabled.
function CreatorModal({ creator, reels, onClose, onContact, onCampaign }: { creator: Creator; reels: Reel[]; onClose: () => void; onContact: ContactHandler; onCampaign: CampaignHandler }) {
  return <Modal onClose={onClose} title={creator.name} className="campaign-modal creator-modal"><div className="creator-profile-image"><img src={creator.image} alt={creator.name} /><span>{creator.specialty}</span></div><div className="campaign-detail"><div className="eyebrow"><span /> {creator.category}</div><h2>{creator.name}</h2>{creator.handle && <p className="creator-handle">{creator.handle}</p>}<p>{creator.bio || creator.specialty}</p>{creator.followers && <div className="detail-metrics"><div><strong>{creator.followers}</strong><span>Followers{creator.demo ? ' · illustrative' : ''}</span></div></div>}{creator.profileUrl && <a className="vmw-text-link creator-social" href={creator.profileUrl} target="_blank" rel="noopener noreferrer">Visit social profile <ArrowUpRight size={17} /></a>}{reels.length > 0 && <div className="creator-related"><h3>Stories with {creator.name.split(' ')[0]}</h3>{reels.map(reel => <button key={reel.id} onClick={() => onCampaign(reel)}><img src={reel.image} alt="" /><span>{reel.title}<small>{reel.brand}</small></span><Play size={15} /></button>)}</div>}<button className="button button-lime" onClick={() => onContact('brand')}>Let’s collaborate <ArrowUpRight size={18} /></button>{creator.demo && <p className="disclosure">An illustrative creator profile using stock photography.</p>}</div></Modal>;
}
*/

function ContactModal({ initialType, onClose }: { initialType: ContactType; onClose: () => void }) {
  const [type, setType] = useState(initialType);
  const [submitted, setSubmitted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const downloadButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (submitted) downloadButton.current?.focus(); else nameInput.current?.focus(); }, [submitted]);
  const [brief, setBrief] = useState<Brief>({ name: '', email: '', company: '', message: '', type: initialType });
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const data = new FormData(e.currentTarget); setBrief({ name: String(data.get('name') || ''), email: String(data.get('email') || ''), company: String(data.get('company') || ''), message: String(data.get('message') || ''), type }); setSubmitted(true); };
  const download = () => {
    const text = `VIVID MEDIA WORKS — ${type === 'brand' ? 'CAMPAIGN' : 'CREATOR'} BRIEF\n\nName: ${brief.name}\nEmail: ${brief.email}\n${type === 'brand' ? 'Brand' : 'Social profile'}: ${brief.company}\n\nThe idea\n${brief.message}\n\nPrepared for Vivid Media Works. Save this brief for your next conversation.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vivid-project-brief.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Modal onClose={onClose} title={submitted ? 'Your brief is ready' : 'Let’s make something vivid'} className="contact-modal">
    {!submitted ? <><div className="eyebrow"><span /> GOOD THINGS START WITH A HELLO</div><h2>Got an idea?<br /><span>Let’s make it vivid.</span></h2><div className="contact-type" role="group" aria-label="Enquiry type"><button className={type === 'brand' ? 'selected' : ''} aria-pressed={type === 'brand'} onClick={() => setType('brand')}>I’m a brand <ArrowUpRight size={17} /></button>{/* <button className={type === 'creator' ? 'selected' : ''} aria-pressed={type === 'creator'} onClick={() => setType('creator')}>I’m a creator <Sparkles size={17} /></button> */}</div><form onSubmit={submit}><div className="form-row"><label>Your name<input ref={nameInput} name="name" defaultValue={brief.name} placeholder="The name behind the idea" required autoComplete="name" maxLength={100} /></label><label>Email address<input name="email" defaultValue={brief.email} type="email" placeholder="you@example.com" required autoComplete="email" maxLength={200} /></label></div><label>{type === 'brand' ? 'Brand / company' : 'Your social profile'}<input name="company" defaultValue={brief.company} placeholder={type === 'brand' ? 'Who are we creating for?' : '@yourhandle or profile URL'} required maxLength={200} /></label><label>{type === 'brand' ? 'Tell us a little about your idea' : 'Tell us about your content'}<textarea name="message" defaultValue={brief.message} placeholder={type === 'brand' ? 'The big idea, the audience, the what-if…' : 'Your niche, your community, and what you want to create…'} rows={3} required maxLength={3000} /></label><button type="submit" className="button button-lime">Create my brief <ArrowRight size={19} /></button><p className="form-note">Create a brief to download and keep for your next conversation.</p></form></> : <div className="contact-success"><span className="success-icon"><Check size={34} /></span><div className="eyebrow">THE BEGINNING OF SOMETHING VIVID</div><h2>Your brief<br /><span>is ready.</span></h2><p>Thanks, {brief.name.split(' ')[0]}. Your idea is taking shape. Download your brief and keep it ready for your next conversation.</p><button ref={downloadButton} className="button button-lime" onClick={download}>Download my brief <Download size={18} /></button><button className="text-button" onClick={() => setSubmitted(false)}>Back to my brief <ArrowLeft size={16} /></button><p className="form-note">Your brief is ready to download and share.</p></div>}
  </Modal>;
}

// export default function App({ initialContent, page = 'home' }: { initialContent: SiteContent; page?: 'home' | 'work' | 'creators' | 'about' | 'approach' }) {
export default function App({ initialContent, page = 'home' }: { initialContent: SiteContent; page?: 'home' | 'work' | 'about' | 'approach' }) {
  const content = usePublicContent(initialContent);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  // const [creatorId, setCreatorId] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactType | null>(null);
  const campaign = content.reels.find(reel => reel.id === campaignId);
  // const creator = content.creators.find(profile => profile.id === creatorId);
  // const featuredCreators = content.creators.filter(profile => profile.featured);
  useEffect(() => {
    if (page !== 'home' || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = document.querySelectorAll<HTMLElement>('.home-page .vmw-service, .home-page .vmw-brand-card, .home-page .campaign-card, .home-page .vmw-creator, .home-page .vmw-strategy-intro');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('home-reveal-pending');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.dataset.homeReveal = '';
        element.classList.add('home-reveal-pending');
        observer.observe(element);
      }
    });
    return () => {
      observer.disconnect();
      elements.forEach(element => {
        element.classList.remove('home-reveal-pending');
        delete element.dataset.homeReveal;
      });
    };
  }, [page, content]);
  // const onContact: ContactHandler = type => { setCampaignId(null); setCreatorId(null); setContact(type); };
  const onContact: ContactHandler = type => { if (type !== 'brand') return; setCampaignId(null); setContact(type); };
  // const onCampaign = (reel: Reel) => { setCreatorId(null); setCampaignId(reel.id); };
  const onCampaign = (reel: Reel) => { setCampaignId(reel.id); };
  // const onCreator = (profile: Creator) => { setCampaignId(null); setCreatorId(profile.id); };
  return <div className={`${page}-page`}>
    <a href="#main" className="skip-link">Skip to content</a><Nav onContact={onContact} page={page} />
    <main id="main">{page === 'home' ? <>
      {/* <Hero onContact={onContact} creators={featuredCreators} onCreator={onCreator} /> */}
      <Hero onContact={onContact} campaigns={content.reels} onCampaign={onCampaign} /><About /><Brands brands={content.brands} />
      <Campaigns campaigns={content.reels.filter(reel => reel.featured)} onCampaign={onCampaign} />
      {/* <Creators creators={featuredCreators} onCreator={onCreator} onContact={onContact} /> */}
      <Strategy />
    </> : page === 'work' ? <Work campaigns={content.reels} brands={content.brands} onCampaign={onCampaign} />
      : page === 'about' ? <AboutPage onContact={onContact} />
      : page === 'approach' ? <ApproachPage onContact={onContact} />
      : null /* <CreatorsPage creators={content.creators} onCreator={onCreator} onContact={onContact} /> */}</main>
    {/* <AboutPage creators={content.creators} onContact={onContact} /> */}
    <Footer onContact={onContact} />
    {/* <CampaignModal key={campaign.id} campaign={campaign} onClose={() => setCampaignId(null)} onContact={onContact} creator={content.creators.find(profile => profile.id === campaign.creatorId)} onCreator={onCreator} /> */}
    {campaign && <CampaignModal key={campaign.id} campaign={campaign} onClose={() => setCampaignId(null)} onContact={onContact} />}
    {/* {creator && <CreatorModal key={creator.id} creator={creator} reels={content.reels.filter(reel => reel.creatorId === creator.id)} onClose={() => setCreatorId(null)} onContact={onContact} onCampaign={onCampaign} />} */}
    {contact && <ContactModal initialType={contact} onClose={() => setContact(null)} />}
  </div>;
}
