'use client';

// import { useState } from 'react'; // Creator portraits are temporarily disabled.
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Asterisk, AudioLines, Compass, HeartHandshake, Plus, Sparkles, UsersRound } from 'lucide-react';
// import type { Creator } from './lib/content-types';
import type { ContactType } from './Sections';
import styles from './about.module.css';

const principles = [
  { icon: HeartHandshake, number: '01', title: 'People before platforms.', text: 'A community is more than a number. We look for shared values, genuine trust, and voices that people choose to listen to.' },
  { icon: Sparkles, number: '02', title: 'Originality with intent.', text: 'Good ideas should feel fresh and do something useful. We give creators room to be themselves, with your brand’s purpose at the heart of the story.' },
  { icon: Compass, number: '03', title: 'Clarity at every step.', text: 'Clear briefs. Open conversations. Thoughtful follow-through. We bring the same care to the details as we do to the big creative idea.' },
];

const approach = [
  { title: 'Listen before we create.', label: 'DISCOVERY & STRATEGY', text: 'We start with your brand, the people you want to reach, and what you want to change. Together, we define the audience, the opportunity, and what success should look like.' },
  { title: 'Find a natural connection.', label: 'CREATOR PARTNERSHIPS', text: 'We look at audience fit, content style, and shared values to find the right collaborators. The goal is a partnership that makes sense to the brand, the creator, and their community.' },
  { title: 'Give the story its own voice.', label: 'IDEAS & CAMPAIGN DELIVERY', text: 'We shape the concept and brief, then work with creators on content that feels like them. We coordinate feedback, deliverables, and the launch so everyone knows the next move.' },
  { title: 'Learn. Refine. Go again.', label: 'REPORTING & INSIGHT', text: 'We review how the content performed against the goals we agreed on. From audience response to engagement and reach, we turn the results into useful direction for what comes next.' },
];

/* Creator portraits are temporarily disabled.
function CreatorImage({ creator, index }: { creator: Creator; index: number }) {
  const [failedSource, setFailedSource] = useState('');
  return <Link href="/creators" className={styles.portrait} aria-label={creator.demo ? `Explore the creator collective: ${creator.category.toLowerCase() || 'creative perspectives'}` : `Explore the creator collective, including ${creator.name}`}>
    {failedSource === creator.image ? <span className={styles.portraitFallback}><UsersRound size={42} strokeWidth={1.2} aria-hidden="true" /></span> : <img src={creator.image} alt={creator.demo ? 'Illustrative stock portrait representing creative perspectives' : `${creator.name}, creator portrait`} width="450" height="600" fetchPriority={index === 0 ? 'high' : undefined} onError={() => setFailedSource(creator.image)} />}
    <span className={styles.portraitTopline} aria-hidden="true"><span>0{index + 1} / A FRESH PERSPECTIVE</span><ArrowUpRight size={16} /></span>
    <span className={styles.portraitLabel}><span><small>{creator.demo ? 'CREATIVE PERSPECTIVES' : 'THE VIVID COLLECTIVE'}</small><strong>{creator.demo ? (index === 0 ? 'Made to stand out.' : 'A voice of your own.') : creator.name}</strong></span><ArrowUpRight size={18} aria-hidden="true" /></span>
  </Link>;
}

*/

// export default function AboutPage({ creators, onContact }: { creators: Creator[]; onContact: (type: ContactType) => void }) {
export default function AboutPage({ onContact }: { onContact: (type: ContactType) => void }) {
  // const portraits = [...creators.filter(creator => creator.featured), ...creators.filter(creator => !creator.featured)].filter(creator => creator.image).slice(0, 2);

  return <>
    <section className={styles.hero} aria-labelledby="about-title">
      <div className="container">
        <div className={styles.topline}><span className={styles.kicker}><span /> HELLO. WE’RE VIVID.</span><span>INDEPENDENT MINDS. SHARED AMBITION.</span></div>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <h1 id="about-title">Small team.<br />Big ideas.<br /><span className={styles.headingAccent}><em>Vivid impact.</em><Asterisk size={42} strokeWidth={1.3} aria-hidden="true" /></span></h1>
            <p>We’re Vivid Media Works. An independent influencer marketing agency bringing brands, creators, and culture together. For stories that mean something. And connections that last.</p>
            <div className={styles.heroActions}><a className={styles.primaryButton} href="#our-story">Get to know us <ArrowDown size={17} aria-hidden="true" /></a><Link className={styles.textLink} href="/work">See what we make <ArrowUpRight size={17} aria-hidden="true" /></Link></div>
            <ul className={styles.heroTraits} aria-label="The Vivid mindset"><li><Compass size={16} strokeWidth={1.5} aria-hidden="true" />Independent minds</li><li><HeartHandshake size={16} strokeWidth={1.5} aria-hidden="true" />People first</li><li><Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />Culture curious</li></ul>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.collage} data-portraits={0 /* portraits.length */}>
              <div className={styles.visualTopline}><span>THE ART OF COMING TOGETHER</span></div>
              <div className={styles.creativeStamp} aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg><span><span>A GOOD KIND<br />OF <strong>DIFFERENT.</strong></span></span></div>
              <div className={styles.portraitStrip}>
                {/* Creator portraits are temporarily disabled:
                {portraits.length ? portraits.map((creator, index) => <CreatorImage creator={creator} index={index} key={creator.id} />) : <div className={styles.visualPlaceholder}><UsersRound size={64} strokeWidth={1} aria-hidden="true" /><span>Different voices.<br />Endless possibility.</span></div>}
                */}
                <div className={styles.visualPlaceholder}><UsersRound size={64} strokeWidth={1} aria-hidden="true" /><span>Different voices.<br />Endless possibility.</span></div>
              </div>
              <div className={styles.connectionNote}><span><HeartHandshake size={18} strokeWidth={1.5} aria-hidden="true" /></span>Better, together.</div>
              <div className={styles.visualManifesto}><span>OUR KIND OF INFLUENCE</span><p>Human connection.<br /><em>Creative possibility.</em></p><div><span>BRANDS <Plus size={10} aria-hidden="true" /> CREATORS <Plus size={10} aria-hidden="true" /> CULTURE</span><img src="/images/vivid-mark-dark.png" alt="" width="1024" height="736" /></div></div>
            </div>
            <div className={styles.visualFootnote}><span>DIFFERENT VOICES. ONE VIVID VISION.</span>{/* {portraits.some(creator => creator.demo) && <span>Illustrative stock portraits.</span>} */}</div>
          </div>
        </div>
        <div className={styles.heroBottom}><span><span className={styles.statusDot} /> BASED IN INDIA. THINKING EVERYWHERE.</span><a href="#our-story">MORE THAN A NAME. A MINDSET. <ArrowDown size={14} aria-hidden="true" /></a></div>
      </div>
    </section>

    <section className={`${styles.story} container`} id="our-story" aria-labelledby="our-story-title">
      <div className={styles.storyHeading}><span className={styles.kicker}><span /> THE STORY BEHIND THE SPARK</span><h2 id="our-story-title">Good influence<br />starts with<br /><em>real connection.</em></h2><Asterisk className={styles.storyStar} size={70} strokeWidth={1.1} aria-hidden="true" /></div>
      <div className={styles.storyCopy}><p className={styles.storyLead}>The most memorable brand stories don’t feel like interruptions. They feel like something you want to be part of.</p><p>That belief is at the heart of Vivid. We bring a brand’s ambition together with a creator’s perspective, finding the common ground where a story feels natural, relevant, and worth sharing.</p><p>We’re a close-knit team with a collaborative way of working. Strategy, creator partnerships, and campaign delivery come together in one connected conversation—from the first “what if” to the final piece of content.</p><p>Rooted in India and curious about the world, we pay attention to the everyday moments, emerging voices, and cultural shifts that shape how people connect.</p><div className={styles.storySignoff}><span>OUR NAME. OUR POINT OF VIEW.</span><p>More personality. More purpose. <strong>More vivid.</strong></p></div></div>
    </section>

    <section className={styles.connectionBand} aria-label="What we bring together"><div className={`container ${styles.connectionInner}`}><span>Ambitious brands</span><Asterisk size={26} strokeWidth={1.2} aria-hidden="true" /><span>Distinct voices</span><Asterisk size={26} strokeWidth={1.2} aria-hidden="true" /><span>Meaningful stories</span><ArrowUpRight size={31} strokeWidth={1.2} aria-hidden="true" /></div></section>

    <section className={styles.principles} aria-labelledby="principles-title"><div className="container">
      <div className={styles.sectionHeading}><div><span className={styles.kicker}><span /> WHAT KEEPS US GROUNDED</span><h2 id="principles-title">Big on ideas.<br /><em>Firm on our values.</em></h2></div><p>Trends move fast. These things stay with us.<br />The principles behind every partnership we build.</p></div>
      <div className={styles.principleGrid}>{principles.map(({ icon: Icon, number, title, text }) => <article className={styles.principle} key={number}><div className={styles.principleTop}><Icon size={30} strokeWidth={1.3} aria-hidden="true" /><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
    </div></section>

    <section className={`${styles.approach} container`} id="approach" aria-labelledby="approach-title">
      <div className={styles.approachIntro}><span className={styles.kicker}><span /> FROM HELLO TO WHAT’S NEXT</span><h2 id="approach-title">Thoughtful process.<br /><em>Vivid possibilities.</em></h2><p>Creative freedom works best with a clear plan. Here’s how we bring both to the table.</p><Link className={styles.textLink} href="/work">See it come to life <ArrowUpRight size={17} aria-hidden="true" /></Link><div className={styles.approachNote}><AudioLines size={35} strokeWidth={1.2} aria-hidden="true" /><span>WE LISTEN CLOSELY.<br />THEN MAKE SOME NOISE.</span></div></div>
      <div className={styles.steps}>{approach.map((step, index) => <details className={styles.step} key={step.title} open={index === 0}><summary><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><span className={styles.stepToggle}><Plus size={18} strokeWidth={1.5} aria-hidden="true" /></span></summary><div className={styles.stepContent}><span>{step.label}</span><p>{step.text}</p></div></details>)}</div>
    </section>

    <section className={styles.invitation} aria-labelledby="invitation-title"><div className="container"><div className={styles.invitationHeading}><span className={styles.kicker}><span /> THERE’S ROOM FOR YOUR KIND OF VIVID</span><h2 id="invitation-title">Great things happen<br /><em>in good company.</em></h2><p>Whether you have a brand to grow or a story to tell,<br />we’d love to find out what we can make together.</p></div><div className={styles.invitationGrid} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <article className={styles.brandInvitation}><div className={styles.invitationTop}><span>FOR BRANDS</span><ArrowUpRight size={27} strokeWidth={1.3} aria-hidden="true" /></div><h3>Your ambition.<br />Our creative energy.</h3><p>Let’s find the right voices, shape a meaningful story, and build a campaign around what matters to your brand.</p><button className={styles.invitationButton} onClick={() => onContact('brand')}>Bring us your brief <ArrowUpRight size={18} aria-hidden="true" /></button></article>
      {/* Creator invitations are temporarily disabled:
      <article className={styles.creatorInvitation}><div className={styles.invitationTop}><span>FOR CREATORS</span><Asterisk size={27} strokeWidth={1.3} aria-hidden="true" /></div><h3>Your voice.<br />A world of possibility.</h3><p>You bring the perspective. We bring a collaborative approach to finding partnerships that feel like you.</p><button className={styles.invitationButton} onClick={() => onContact('creator')}>Let’s create together <ArrowUpRight size={18} aria-hidden="true" /></button></article>
      */}
    </div></div></section>
  </>;
}
