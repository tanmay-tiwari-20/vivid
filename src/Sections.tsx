'use client';

import { useState } from 'react';
import { ArrowUpRight, AudioLines, Asterisk, ChartNoAxesCombined, ChevronDown, Pause, Play, UsersRound } from 'lucide-react';

export type ContactType = 'brand' | 'creator';

type ContactProps = {
  onContact: (type: ContactType) => void;
};

type Brand = {
  name: string;
  className: string;
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
        <h2 id="about-heading" className="vmw-about-statement">We don’t just put your brand in the feed. <span className="vmw-muted-text">We make it part of</span> <span className="vmw-lime-text">the conversation.</span></h2>
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

const brands: Brand[] = [
  { name: 'boAt', className: 'boat' },
  { name: 'PUMA', className: 'puma' },
  { name: 'nykaa', className: 'nykaa' },
  { name: 'Spotify', className: 'spotify' },
  { name: 'Myntra', className: 'myntra' },
  { name: 'Swiggy', className: 'swiggy' },
];

function BrandWordmark({ brand }: { brand: Brand }) {
  return <span className={`vmw-brand-wordmark vmw-brand-${brand.className}`}>
    {brand.name === 'Spotify' && <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="currentColor"/><path d="M7 11c6-2 12-1 18 2M8 16c6-2 11-1 16 2M9 21c5-1 9-1 13 1" stroke="var(--bg)" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg>}
    {brand.name === 'Myntra' && <span className="vmw-myntra-mark" aria-hidden="true">M</span>}
    {brand.name === 'Swiggy' && <svg viewBox="0 0 25 34" aria-hidden="true"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 23 12.5 34 12.5 34S25 23 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="currentColor"/><path d="M6 11h13v4H9v4h8" fill="none" stroke="var(--bg)" strokeWidth="3"/></svg>}
    {brand.name}
  </span>;
}

export function Brands() {
  const [paused, setPaused] = useState(false);
  return (
    <section className="vmw-brands" aria-labelledby="brands-heading">
      <div className="container vmw-brands-heading"><h2 id="brands-heading">BIG IDEAS. FAMILIAR NAMES.</h2></div>
      <div className={`vmw-brands-window${paused ? ' is-paused' : ''}`}>
        <div className="vmw-brands-track">
          {[0, 1].map((copy) => <div className="vmw-brands-set" key={copy} aria-hidden={copy === 1 ? true : undefined}>{brands.map((brand) => <BrandWordmark key={`${copy}-${brand.name}`} brand={brand} />)}</div>)}
        </div>
      </div>
      <div className="container vmw-brands-bottom"><p>Illustrative brand lineup · Demo concept</p><button className="vmw-marquee-control" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume brand carousel' : 'Pause brand carousel'}>{paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}<span>{paused ? 'Resume' : 'Pause'}</span></button></div>
    </section>
  );
}

const creators = [
  { name: 'Meera Sethi', category: 'FASHION & SELF-EXPRESSION', image: '/images/creator-fashion.jpg', specialty: 'A style all her own.' },
  { name: 'Rohan Sen', category: 'LIFESTYLE & CULTURE', image: '/images/creator-lifestyle.jpg', specialty: 'Everyday, reimagined.' },
  { name: 'Ishaan Rao', category: 'FITNESS & MOVEMENT', image: '/images/creator-fitness.jpg', specialty: 'Energy that moves you.' },
  { name: 'Anaya Mehra', category: 'BEAUTY & WELLNESS', image: '/images/creator-beauty.jpg', specialty: 'Confidence, on camera.' },
];

export function Creators({ onContact }: ContactProps) {
  return (
    <section className="vmw-creators container" id="creators" aria-labelledby="creators-heading">
      <div className="vmw-creators-header">
        <div><span className="eyebrow">THE PEOPLE BEHIND THE IMPACT</span><h2 className="section-heading" id="creators-heading">Main character<br/><span className="vmw-lime-text">energy.</span></h2></div>
        <div className="vmw-creators-intro"><p>Different voices. Distinct perspectives.<br/>A shared talent for making you feel something.</p><button className="vmw-text-link" onClick={() => onContact('brand')}>Find your next collaborator <ArrowUpRight size={17}/></button></div>
      </div>
      <div className="vmw-creators-grid">
        {creators.map((creator, index) => (
          <article className="vmw-creator" key={creator.name}>
            <button className="vmw-creator-portrait" onClick={() => onContact('brand')} aria-label={`Discuss a collaboration — ${creator.name}, illustrative creator`}>
              <img src={creator.image} alt={`${creator.name}, illustrative ${creator.category.toLowerCase()} creator portrait`} loading="lazy" width="600" height="800"/>
              <span className="vmw-creator-index">0{index + 1}</span><span className="vmw-creator-arrow"><ArrowUpRight size={22}/></span>
              <span className="vmw-creator-specialty">{creator.specialty}</span>
            </button>
            <div className="vmw-creator-details"><h3>{creator.name}</h3><p>{creator.category}</p></div>
          </article>
        ))}
      </div>
      <div className="vmw-creators-bottom"><p>Illustrative creator profiles for this demo.</p><button className="vmw-text-link" onClick={() => onContact('creator')}>Got your own kind of vivid? Join the circle <ArrowUpRight size={17}/></button></div>
    </section>
  );
}

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
        <div className="vmw-strategy-intro"><span className="eyebrow">THE METHOD BEHIND THE MAGIC</span><h2 className="section-heading" id="strategy-heading">Less guesswork.<br/>More <span className="vmw-lime-text">game plan.</span></h2><p>Great content doesn’t happen by accident.<br/>Here’s how we make every move count.</p><div className="vmw-strategy-signoff"><Asterisk size={56} strokeWidth={1.3}/><span>BUILT ON INSIGHT.<br/>BROUGHT TO LIFE BY PEOPLE.</span></div></div>
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
      <div className="container vmw-footer-bottom"><a href="#home" className="vmw-footer-logo" aria-label="Vivid Media Works — back to top"><img src="/images/vivid-logo-dark.png" alt="Vivid Media Works" width="156" height="54"/></a><nav aria-label="Footer navigation"><a href="#about">About</a><a href="#work">Our work</a><a href="#creators">Creators</a><a href="#strategy">Our approach</a><button onClick={() => onContact('brand')}>Let’s talk <ArrowUpRight size={14}/></button></nav></div>
      <div className="container vmw-footer-fineprint"><p>© {new Date().getFullYear()} Vivid Media Works.</p><p>Made to connect. Built to stand out.</p><a href="#home" aria-label="Back to top">BACK TO TOP <ArrowUpRight size={13}/></a></div>
    </footer>
  );
}
