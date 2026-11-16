'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode, type CSSProperties } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, ArrowDown, Play, Menu, X, Plus, Instagram, Eye, Users, Check, Download, Sparkles } from 'lucide-react';
import { About, Brands, Creators, Strategy, Footer, type ContactType } from './Sections';

type ContactHandler = (type: ContactType) => void;
type Campaign = {
  id: string; brand: string; creator: string; category: string; title: string;
  views: string; reach: string; image: string; video: string; color: string; description: string;
};
type CampaignHandler = (campaign: Campaign) => void;
type Brief = { name: string; email: string; company: string; message: string; type: ContactType };

const campaigns: Campaign[] = [
  { id: 'everyday', brand: 'Nykaa', creator: 'Anaya Mehra', category: 'BEAUTY & LIFESTYLE', title: 'A little everyday glow.', views: '3.1M', reach: '2.2M', image: '/images/creator-beauty.jpg', video: '/videos/beauty.mp4', color: '#e6f8f2', description: 'A getting-ready story that makes a daily ritual feel a little more special. Built around honest moments, personal expression, and a creator’s own point of view.' },
  { id: 'city', brand: 'boAt', creator: 'Rohan Sen', category: 'MUSIC & CULTURE', title: 'Your city. Your soundtrack.', views: '2.4M', reach: '1.8M', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'An everyday city adventure with a soundtrack of its own. A culture-led concept that brings a product into the moments an audience already cares about.' },
  { id: 'movement', brand: 'PUMA', creator: 'Ishaan Rao', category: 'FITNESS & MOVEMENT', title: 'Find your next gear.', views: '1.8M', reach: '1.2M', image: '/images/creator-fitness.jpg', video: '/videos/fitness.mp4', color: '#e6f8f2', description: 'From the first stretch to the last sprint. An energetic movement story about showing up for yourself, with the brand naturally part of the journey.' },
  { id: 'style', brand: 'Myntra', creator: 'Meera Sethi', category: 'FASHION & SELF-EXPRESSION', title: 'Wear your own kind of bold.', views: '2.7M', reach: '1.9M', image: '/images/creator-fashion.jpg', video: '/videos/fashion.mp4', color: '#e6f8f2', description: 'One personality, a whole new perspective. A fashion concept that gives the creator room to make the style their own and invite their community into the story.' },
  { id: 'moments', brand: 'Spotify', creator: 'Rohan Sen', category: 'LIFESTYLE & DISCOVERY', title: 'A mood for every moment.', views: '1.6M', reach: '980K', image: '/images/creator-lifestyle.jpg', video: '/videos/lifestyle.mp4', color: '#e6f8f2', description: 'Small daily moments become a story worth sharing. A music-led concept that connects personal routines with the joy of discovering something new.' },
];

function Nav({ onContact }: { onContact: ContactHandler }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return <header className="site-header">
    <div className="container nav-inner">
      <a className="brand-logo" href="#home" aria-label="Vivid Media Works home" onClick={() => setOpen(false)}><img src="/images/vivid-logo-light.png" alt="Vivid Media Works" width="152" height="74" /></a>
      <nav className="desktop-nav" aria-label="Main navigation"><a href="#about">Who we are</a><a href="#work">Our work</a><a href="#creators">The creators</a><a href="#strategy">Our approach</a></nav>
      <button className="nav-cta" onClick={() => onContact('brand')}>Let’s talk <ArrowUpRight size={17} /></button>
      <button ref={menuButton} className="menu-toggle icon-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-nav">{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">{[['Who we are', '#about'], ['Our work', '#work'], ['The creators', '#creators'], ['Our approach', '#strategy']].map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={20} /></a>)}<button onClick={() => { setOpen(false); menuButton.current?.focus(); onContact('brand'); }}>Let’s talk <ArrowUpRight size={20} /></button></nav>}
  </header>;
}

function Star({ className = '' }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

function Hero({ onContact, onCampaign }: { onContact: ContactHandler; onCampaign: CampaignHandler }) {
  return <section id="home" className="hero">
    <div className="container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow hero-eyebrow"><span /> SMALL TEAM. BIG CREATOR ENERGY.</div>
        <h1>Don’t just<br />show up.<br /><span>Stand out.</span><Star className="heading-star" /></h1>
        <p>We bring brands, creators, and culture together.<br className="desktop-break" /> For content that connects. And influence that lasts.</p>
        <div className="hero-actions"><button className="button button-lime" onClick={() => onContact('brand')}>Let’s make it vivid <ArrowUpRight size={20} /></button><a className="text-button" href="#work"><span className="small-play"><Play size={12} fill="currentColor" /></span> Explore the work</a></div>
        <div className="hero-social-proof"><div className="mini-avatars"><img src="/images/creator-beauty.jpg" alt="" /><img src="/images/creator-lifestyle.jpg" alt="" /><img src="/images/creator-fashion.jpg" alt="" /><span><Plus size={15} /></span></div><div>Different voices.<br /><strong>One vivid vision.</strong></div></div>
      </div>
      <div className="hero-art" aria-label="An editorial collage of sample creators">
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        <span className="art-cross cross-one">+</span><span className="art-cross cross-two">+</span>
        <button className="hero-photo photo-left" onClick={() => onCampaign(campaigns[1])} aria-label="Preview Your city. Your soundtrack."><img src="/images/creator-lifestyle.jpg" alt="Lifestyle creator in an urban setting" fetchPriority="high" /><span className="photo-mini-label"><Instagram size={13} /> REEL PEOPLE.</span><span className="photo-small-play"><Play size={15} fill="currentColor" /></span></button>
        <button className="hero-photo photo-right" onClick={() => onCampaign(campaigns[0])} aria-label="Preview A little everyday glow."><img src="/images/creator-beauty.jpg" alt="Beauty creator sharing a moment" fetchPriority="high" /><span className="photo-mini-label">REAL CONNECTION.</span></button>
        <button className="hero-photo photo-main" onClick={() => onCampaign(campaigns[3])} aria-label="Preview Wear your own kind of bold."><img src="/images/creator-fashion.jpg" alt="Fashion creator expressing her personal style" fetchPriority="high" /><span className="photo-topline"><span className="live-dot" /> THE VIVID EFFECT <Instagram size={17} /></span><span className="photo-caption">A little influence.<br />A lot of possibility.<span className="caption-arrow"><ArrowUpRight size={22} /></span></span></button>
        <div className="creator-sticker"><Star /><span>CREATOR<br /><strong>POWERED.</strong></span></div>
        <div className="impact-sticker"><span className="impact-icon"><ArrowUpRight size={23} /></span><span>Made to stop<br /><strong>the scroll.</strong></span><svg viewBox="0 0 80 38" aria-hidden="true"><path d="m2 31 14-8 11 5 13-18 10 7L76 2" /><path d="M61 2h15v15" /></svg></div>
        <div className="scribble-note">a little different.<br />a lot more vivid.<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M2 5C17 39 57 36 81 16M69 13l15 1-5 15" /></svg></div>
      </div>
    </div>
    <div className="container hero-bottom"><span>INDEPENDENT MINDS. <strong>CONNECTED BY CULTURE.</strong></span><a href="#about">SCROLL TO GET TO KNOW US <ArrowDown size={15} /></a><span className="hero-location"><span /> BASED IN INDIA. THINKING EVERYWHERE.</span></div>
  </section>;
}

function Campaigns({ onCampaign }: { onCampaign: CampaignHandler }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const move = (direction: number) => {
    const card = track.current?.querySelector('.campaign-card');
    if (card && track.current) track.current.scrollBy({ left: (card.getBoundingClientRect().width + 22) * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const update = () => { const el = track.current; if (el) { setPosition(el.scrollLeft); setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); } };
  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, []);
  return <section id="work" className="campaigns section-space">
    <div className="container">
      <div className="eyebrow"><span /> GOOD CONTENT. GREAT COMPANY.</div>
      <div className="campaign-heading"><h2>Less scrolling.<br /><span className="serif-accent">More stopping.</span></h2><div className="campaign-intro"><p>Stories made for the feed.<br />Connections made to go beyond it.</p><div className="carousel-controls"><button className="icon-button" onClick={() => move(-1)} disabled={position < 4} aria-label="Previous campaigns"><ArrowLeft size={21} /></button><button className="icon-button" onClick={() => move(1)} disabled={atEnd} aria-label="Next campaigns"><ArrowRight size={21} /></button></div></div></div>
      <div className="campaign-track" ref={track} onScroll={update} aria-label="Sample campaign reels" aria-roledescription="carousel" tabIndex={0}>
        {campaigns.map((campaign, i) => <article className="campaign-card" key={campaign.id} aria-label={`${i + 1} of ${campaigns.length}: ${campaign.title}`}>
          <button className="reel-cover" style={{ '--card-tint': campaign.color } as CSSProperties} onClick={() => onCampaign(campaign)} aria-label={`Watch ${campaign.title}`}><img loading="lazy" src={campaign.image} alt={`${campaign.category.toLowerCase()} campaign concept`} /><span className="reel-shade" /><span className={`reel-brand brand-${campaign.brand.toLowerCase()}`}>{campaign.brand}</span><span className="reel-type"><Instagram size={13} /> REEL</span><span className="reel-play"><Play size={22} fill="currentColor" /></span><span className="reel-caption"><span>{campaign.category}</span><strong>{campaign.title}</strong><span className="reel-creator">with {campaign.creator}<ArrowUpRight size={18} /></span></span></button>
          <div className="reel-metrics"><div><Eye size={15} /><strong>{campaign.views}</strong><span>views</span></div><div><Users size={14} /><strong>{campaign.reach}</strong><span>reach</span></div></div>
        </article>)}
      </div>
      <div className="campaign-footnote"><span><span className="tiny-dot" /> A LITTLE TASTE OF WHAT’S POSSIBLE</span><p>Demo showcase · Brands, creators & figures are illustrative.</p></div>
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
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, video[controls], [tabindex="0"]')).filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current || !ref.current.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current || !ref.current.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><button className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><X size={21} /></button>{children}</div></div>;
}

function CampaignModal({ campaign, onClose, onContact }: { campaign: Campaign; onClose: () => void; onContact: ContactHandler }) {
  const [failed, setFailed] = useState(false);
  return <Modal onClose={onClose} title={campaign.title} className="campaign-modal"><div className="modal-video-wrap">{!failed ? <video src={campaign.video} poster={campaign.image} controls playsInline autoPlay muted loop preload="metadata" onError={() => setFailed(true)} aria-label={`Illustrative stock reel for ${campaign.title}`} /> : <div className="reel-fallback"><img src={campaign.image} alt={campaign.title} /><span>Campaign concept preview</span></div>}<span className="video-stock-label">ILLUSTRATIVE STOCK FOOTAGE</span></div><div className="campaign-detail"><div className="eyebrow"><span /> THE CAMPAIGN CONCEPT</div><span className="detail-brand">{campaign.brand}</span><h2>{campaign.title}</h2><p>{campaign.description}</p><div className="detail-creator">Creative direction with <strong>{campaign.creator}</strong></div><div className="detail-metrics"><div><strong>{campaign.views}</strong><span>Example views</span></div><div><strong>{campaign.reach}</strong><span>Example reach</span></div></div><button className="button button-lime" onClick={() => onContact('brand')}>Create a story like this <ArrowUpRight size={18} /></button><p className="disclosure">A demo concept with stock media and fictional creator profiles. Brand associations and metrics are illustrative.</p></div></Modal>;
}

function ContactModal({ initialType, onClose }: { initialType: ContactType; onClose: () => void }) {
  const [type, setType] = useState(initialType);
  const [submitted, setSubmitted] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const downloadButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (submitted) downloadButton.current?.focus(); else nameInput.current?.focus(); }, [submitted]);
  const [brief, setBrief] = useState<Brief>({ name: '', email: '', company: '', message: '', type: initialType });
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const data = new FormData(e.currentTarget); setBrief({ name: String(data.get('name') || ''), email: String(data.get('email') || ''), company: String(data.get('company') || ''), message: String(data.get('message') || ''), type }); setSubmitted(true); };
  const download = () => {
    const text = `VIVID MEDIA WORKS — ${type === 'brand' ? 'CAMPAIGN' : 'CREATOR'} BRIEF\n\nName: ${brief.name}\nEmail: ${brief.email}\n${type === 'brand' ? 'Brand' : 'Social profile'}: ${brief.company}\n\nThe idea\n${brief.message}\n\nCreated in the Vivid Media Works demo. This brief has not been sent.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'vivid-project-brief.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Modal onClose={onClose} title={submitted ? 'Your brief is ready' : 'Let’s make something vivid'} className="contact-modal">
    {!submitted ? <><div className="eyebrow"><span /> GOOD THINGS START WITH A HELLO</div><h2>Got an idea?<br /><span>Let’s make it vivid.</span></h2><div className="contact-type" role="group" aria-label="Enquiry type"><button className={type === 'brand' ? 'selected' : ''} aria-pressed={type === 'brand'} onClick={() => setType('brand')}>I’m a brand <ArrowUpRight size={17} /></button><button className={type === 'creator' ? 'selected' : ''} aria-pressed={type === 'creator'} onClick={() => setType('creator')}>I’m a creator <Sparkles size={17} /></button></div><form onSubmit={submit}><div className="form-row"><label>Your name<input ref={nameInput} name="name" defaultValue={brief.name} placeholder="The name behind the idea" required autoComplete="name" maxLength={100} /></label><label>Email address<input name="email" defaultValue={brief.email} type="email" placeholder="you@example.com" required autoComplete="email" maxLength={200} /></label></div><label>{type === 'brand' ? 'Brand / company' : 'Your social profile'}<input name="company" defaultValue={brief.company} placeholder={type === 'brand' ? 'Who are we creating for?' : '@yourhandle or profile URL'} required maxLength={200} /></label><label>{type === 'brand' ? 'Tell us a little about your idea' : 'Tell us about your content'}<textarea name="message" defaultValue={brief.message} placeholder={type === 'brand' ? 'The big idea, the audience, the what-if…' : 'Your niche, your community, and what you want to create…'} rows={3} required maxLength={3000} /></label><button type="submit" className="button button-lime">Create my brief <ArrowRight size={19} /></button><p className="form-note">Demo mode · Your details stay on this page. Create a brief to download and keep.</p></form></> : <div className="contact-success"><span className="success-icon"><Check size={34} /></span><div className="eyebrow">THE BEGINNING OF SOMETHING VIVID</div><h2>Your brief<br /><span>is ready.</span></h2><p>Thanks, {brief.name.split(' ')[0]}. Your idea is taking shape. Download your brief and keep it ready for your next conversation.</p><button ref={downloadButton} className="button button-lime" onClick={download}>Download my brief <Download size={18} /></button><button className="text-button" onClick={() => setSubmitted(false)}>Back to my brief <ArrowLeft size={16} /></button><p className="form-note">This is a demo. Nothing has been sent or saved to a server.</p></div>}
  </Modal>;
}

export default function App() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contact, setContact] = useState<ContactType | null>(null);
  const onContact: ContactHandler = type => { setCampaign(null); setContact(type); };
  return <><a href="#main" className="skip-link">Skip to content</a><Nav onContact={onContact} /><main id="main"><Hero onContact={onContact} onCampaign={setCampaign} /><About /><Brands /><Campaigns onCampaign={setCampaign} /><Creators onContact={onContact} /><Strategy /></main><Footer onContact={onContact} />{campaign && <CampaignModal campaign={campaign} onClose={() => setCampaign(null)} onContact={onContact} />}{contact && <ContactModal initialType={contact} onClose={() => setContact(null)} />}</>;
}
