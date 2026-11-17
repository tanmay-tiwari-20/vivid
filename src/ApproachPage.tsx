'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, AudioLines, Check, ChevronDown, Compass, HeartHandshake, Lightbulb, MessageCircle, Plus, Radar, Sparkles, Target, UsersRound } from 'lucide-react';
import type { ContactType } from './Sections';
import styles from './approach.module.css';

const steps = [
  {
    name: 'Understand', subtitle: 'Find the real opportunity.', icon: Compass, label: 'DISCOVERY & STRATEGY',
    title: 'A good story starts with a better question.',
    text: 'What do you want people to think, feel, or do? We get close to your brand, your audience, and the culture around them. Then we turn that understanding into a clear direction for the campaign.',
    outputs: ['Audience & cultural context', 'Campaign objective & key message', 'Content direction & channel mix', 'Agreed measures of success'],
    note: 'A shared direction before a single piece of content is made.',
  },
  {
    name: 'Connect', subtitle: 'Find your kind of people.', icon: HeartHandshake, label: 'CREATOR PARTNERSHIPS',
    title: 'The right voice makes all the difference.',
    text: 'We look beyond follower counts. Audience relevance, creative style, community trust, and brand fit guide the shortlist. We bring creators into the conversation early, so the partnership has a reason to exist.',
    outputs: ['Creator shortlist & fit rationale', 'Audience & content review', 'Partnership scope & deliverables', 'Aligned expectations & timelines'],
    note: 'A natural connection between your brand and their community.',
  },
  {
    name: 'Create', subtitle: 'Give the idea its own voice.', icon: Lightbulb, label: 'CREATIVE & CAMPAIGN DELIVERY',
    title: 'Clear on the brief. Open to possibility.',
    text: 'We shape a creative idea with enough direction to serve your brand and enough space for the creator to make it their own. From concepts and feedback to approvals and launch, we keep the moving parts connected.',
    outputs: ['Creative concept & creator brief', 'Content plan & production schedule', 'Coordinated feedback & approvals', 'Publishing plan & launch checks'],
    note: 'Content with a purpose, a personality, and a plan to go live.',
  },
  {
    name: 'Learn', subtitle: 'Make the next move smarter.', icon: Radar, label: 'MEASUREMENT & INSIGHT',
    title: 'The campaign ends. The insight carries on.',
    text: 'We review the results against the goals we set together, looking at both the numbers and the audience response. What earned attention? What started a conversation? We turn those answers into useful recommendations.',
    outputs: ['Results against agreed objectives', 'Content & creator performance', 'Audience response & key learnings', 'Recommendations for the next brief'],
    note: 'A clear view of what happened and where to go next.',
  },
];

const capabilities = [
  { icon: Target, label: '01 / THE DIRECTION', title: 'Strategy with a point of view.', text: 'Audience insight, cultural context, and a campaign idea that gives your brand a meaningful role in the conversation.', tags: ['Campaign strategy', 'Creative direction'] },
  { icon: UsersRound, label: '02 / THE PEOPLE', title: 'Partnerships that feel right.', text: 'Thoughtful creator discovery and collaboration. We connect your brand with voices whose audiences have a reason to care.', tags: ['Creator selection', 'Partnership management'] },
  { icon: Sparkles, label: '03 / THE DETAILS', title: 'Ideas brought to life.', text: 'From the first brief to the final report, we connect the creative and the practical so the campaign keeps moving.', tags: ['Campaign delivery', 'Reporting & insight'] },
];

const questions = [
  { question: 'What do you need from us to get started?', answer: 'Your brand, the audience you want to reach, and the challenge you want to solve are a great starting point. If you have a budget range, preferred timing, or an existing brief, bring those too. We can work together to shape the rest.' },
  { question: 'How do you choose the right creators?', answer: 'We consider audience relevance, content quality, creative style, community engagement, and alignment with your brand. We explain the thinking behind the shortlist, then align on the right collaborators together.' },
  { question: 'Can you work with our existing creative idea?', answer: 'Yes. We can build from an existing concept or help develop one from the beginning. Either way, we adapt the direction to the creator and the platform so the content feels natural while staying true to the brand.' },
  { question: 'How do you define campaign success?', answer: 'We agree on the objective and the measures before launch. That might mean reach and views, meaningful engagement, audience sentiment, or trackable next actions. The report connects the available results to those goals and identifies what to take into the next campaign.' },
  { question: 'What does the campaign timeline look like?', answer: 'Timing depends on the scope, creator availability, production needs, and approval process. Once we understand the brief, we map out the milestones with you, including creator selection, concepts, content reviews, and publishing.' },
];

function VividStar({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><path d="M50 0 58 32 85 15 68 42 100 50 68 58 85 85 58 68 50 100 42 68 15 85 32 58 0 50 32 42 15 15 42 32Z" fill="currentColor" /></svg>;
}

function Process() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % steps.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = steps.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return <section className={styles.process} id="the-process" aria-labelledby="process-title"><div className="container">
    <div className={styles.sectionHeading}>
      <div><span className={styles.kicker}><span /> THE METHOD BEHIND THE MAGIC</span><h2 id="process-title">A clear plan.<br /><em>Room for the unexpected.</em></h2></div>
      <p>Four connected stages. One shared ambition.<br />Here’s how we take a brief from “what if” to what’s next.</p>
    </div>
    <div className={styles.processGrid}>
      <div className={styles.processNavigation}>
        <div className={styles.stepTabs} role="tablist" aria-label="Campaign process stages" aria-orientation="vertical">
          {steps.map((step, index) => <button key={step.name} ref={element => { tabs.current[index] = element; }} id={`approach-tab-${index}`} role="tab" aria-selected={active === index} aria-controls={`approach-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => navigate(event, index)}><span className={styles.stepNumber}>0{index + 1}</span><span className={styles.tabCopy}><strong>{step.name}</strong><small>{step.subtitle}</small></span><ArrowUpRight size={20} strokeWidth={1.4} aria-hidden="true" /></button>)}
        </div>
        <div className={styles.processAside}><AudioLines size={28} strokeWidth={1.2} aria-hidden="true" /><p>We listen closely.<br /><em>Then make some noise.</em></p></div>
      </div>
      <div className={styles.panels}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return <div key={step.name} id={`approach-panel-${index}`} className={styles.processPanel} role="tabpanel" aria-labelledby={`approach-tab-${index}`} hidden={active !== index} tabIndex={0}>
            <div className={styles.panelTop}><span>{step.label}</span><span className={styles.panelIcon}><Icon size={30} strokeWidth={1.3} aria-hidden="true" /></span></div>
            <h3>{step.title}</h3><p className={styles.panelDescription}>{step.text}</p>
            <div className={styles.outputs}><span>WHAT WE SHAPE TOGETHER</span><ul>{step.outputs.map(output => <li key={output}><Check size={15} strokeWidth={1.8} aria-hidden="true" />{output}</li>)}</ul></div>
            <div className={styles.panelBottom}><p>{step.note}</p><button onClick={() => { const next = (index + 1) % steps.length; setActive(next); tabs.current[next]?.focus(); }} aria-label={`Explore stage ${((index + 1) % steps.length) + 1}: ${steps[(index + 1) % steps.length].name}`}><span>0{index + 1} / 04</span><ArrowRight size={20} aria-hidden="true" /></button></div>
          </div>;
        })}
      </div>
    </div>
    <div className={styles.processFootnote}><span className={styles.dot} /><p>Not a rigid formula. A thoughtful framework, shaped around your brand.</p><span>STRATEGY + CREATIVE FREEDOM</span></div>
  </div></section>;
}

export default function ApproachPage({ onContact }: { onContact: (type: ContactType) => void }) {
  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="approach-title"><div className="container">
      <div className={styles.topline}><span className={styles.kicker}><span /> THE VIVID APPROACH</span><span>A LITTLE METHOD. A LOT OF POSSIBILITY.</span></div>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}><h1 id="approach-title">Good instincts.<br />Clear intent.<br /><em>Vivid results.</em></h1><p>Great influence starts long before the first post. We bring thoughtful strategy, the right people, and a little creative courage together. For stories that connect. And campaigns that move things forward.</p><div className={styles.heroActions}><a className={styles.primaryButton} href="#the-process">See how we work <ArrowDown size={17} aria-hidden="true" /></a><button className={styles.textLink} onClick={() => onContact('brand')}>Bring us your brief <ArrowUpRight size={17} aria-hidden="true" /></button></div><div className={styles.heroNote}><span className={styles.noteLine} /><span>BUILT ON INSIGHT. BROUGHT TO LIFE BY PEOPLE.</span></div></div>
        <div className={styles.heroVisual}>
          <div className={styles.visualHeading}><span>THE ANATOMY OF GOOD INFLUENCE</span><Plus size={17} strokeWidth={1.2} aria-hidden="true" /></div>
          <div className={styles.orbitStage} role="img" aria-label="The Vivid effect: strategy, creators, culture, and impact connected around your brand.">
            <div className={styles.orbitRing} aria-hidden="true" /><div className={styles.orbitInner} aria-hidden="true" />
            <svg className={styles.orbitPath} viewBox="0 0 500 430" fill="none" aria-hidden="true"><path d="M155 66C330 4 457 138 414 284M396 270l17 18 17-18M345 371C176 432 44 296 87 153M69 166l18-17 17 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <div className={styles.orbitCenter} aria-hidden="true"><VividStar /><span>THE<br /><strong>VIVID</strong><br />EFFECT</span></div>
            <div className={`${styles.orbitCard} ${styles.strategyCard}`} aria-hidden="true"><span className={styles.orbitCardIcon}><Compass size={21} strokeWidth={1.3} /></span><span><small>THE DIRECTION</small><strong>Strategy</strong></span><span className={styles.cardDot} /></div>
            <div className={`${styles.orbitCard} ${styles.creatorsCard}`} aria-hidden="true"><span className={styles.orbitCardIcon}><UsersRound size={21} strokeWidth={1.3} /></span><span><small>THE VOICES</small><strong>Creators</strong></span><span className={styles.cardDot} /></div>
            <div className={`${styles.orbitCard} ${styles.cultureCard}`} aria-hidden="true"><span className={styles.orbitCardIcon}><MessageCircle size={21} strokeWidth={1.3} /></span><span><small>THE CONTEXT</small><strong>Culture</strong></span><span className={styles.cardDot} /></div>
            <div className={`${styles.orbitCard} ${styles.impactCard}`} aria-hidden="true"><span className={styles.orbitCardIcon}><ArrowUpRight size={22} strokeWidth={1.3} /></span><span><small>THE PURPOSE</small><strong>Impact</strong></span><span className={styles.cardDot} /></div>
            <span className={styles.orbitPlus} aria-hidden="true">+</span><span className={styles.orbitCaption} aria-hidden="true">Everything connects.</span>
          </div>
          <div className={styles.visualFooter}><span>YOUR BRAND AT THE HEART OF IT.</span><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></div>
        </div>
      </div>
      <div className={styles.heroBottom}><span><span className={styles.dot} /> INTENT IN EVERY IDEA.</span><a href="#our-thinking">A GOOD PLACE TO START <ArrowDown size={14} aria-hidden="true" /></a><span>HUMAN FIRST. ALWAYS.</span></div>
    </div></section>

    <section className={styles.belief} id="our-thinking" aria-labelledby="belief-title"><div className={`container ${styles.beliefGrid}`}><div><span className={styles.kicker}><span /> OUR STARTING POINT</span><h2 id="belief-title">Connection before<br /><em>amplification.</em></h2></div><div className={styles.beliefCopy}><p>Before we ask how many people a story can reach, we ask why anyone would care.</p><p>The strongest campaigns sit where a brand’s purpose, a creator’s perspective, and an audience’s interests meet. That’s the space we look for. Because attention means more when it comes with a reason to connect.</p><div className={styles.beliefSignoff}><Asterisk size={23} strokeWidth={1.2} aria-hidden="true" /><span>Relevance first. Reach with reason.</span></div></div></div></section>

    <Process />

    <section className={styles.capabilities} aria-labelledby="capabilities-title"><div className="container"><div className={styles.sectionHeading}><div><span className={styles.kicker}><span /> ONE CONNECTED TEAM</span><h2 id="capabilities-title">Big picture thinking.<br /><em>Care in every detail.</em></h2></div><p>Strategy, partnerships, and delivery.<br />Connected from the first conversation to the final report.</p></div><div className={styles.capabilityGrid}>{capabilities.map(({ icon: Icon, label, title, text, tags }) => <article className={styles.capability} key={label}><div className={styles.capabilityTop}><Icon size={32} strokeWidth={1.2} aria-hidden="true" /><span>{label}</span></div><h3>{title}</h3><p>{text}</p><div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>)}</div><div className={styles.capabilityBottom}><p>Clear milestones. Open conversations. A shared creative direction.</p><Link className={styles.textLink} href="/work">See it come to life <ArrowUpRight size={17} aria-hidden="true" /></Link></div></div></section>

    <section className={styles.measurement} aria-labelledby="measurement-title"><div className={`container ${styles.measurementGrid}`}><div className={styles.measurementCopy}><span className={styles.kicker}><span /> MEANING BEHIND THE METRICS</span><h2 id="measurement-title">Make it matter.<br /><em>Then measure it.</em></h2><p>Success should mean something specific to your brand. We agree on what matters before we launch, then use the results to shape a more informed next move.</p><div className={styles.measurementNote}><span><Check size={16} aria-hidden="true" /></span><p>A clear objective.<br /><strong>An honest view of the outcome.</strong></p></div></div><div className={styles.measures}><div className={styles.measuresHeader}><span>THE GOAL SHAPES THE SCORECARD</span><ArrowUpRight size={18} aria-hidden="true" /></div><article><span>01</span><div><h3>Earn attention.</h3><p>Reach, views, and watch time help us understand how the story was seen.</p></div><Target size={24} strokeWidth={1.2} aria-hidden="true" /></article><article><span>02</span><div><h3>Build connection.</h3><p>Shares, saves, comments, and audience response show what resonated.</p></div><HeartHandshake size={24} strokeWidth={1.2} aria-hidden="true" /></article><article><span>03</span><div><h3>Inspire the next step.</h3><p>Trackable clicks and actions help connect the content to your campaign goal.</p></div><ArrowUpRight size={26} strokeWidth={1.2} aria-hidden="true" /></article><p className={styles.measurementFootnote}>Measures depend on the campaign objective and available platform data.</p></div></div></section>

    <section className={styles.faq} aria-labelledby="faq-title"><div className={`container ${styles.faqGrid}`}><div className={styles.faqIntro}><span className={styles.kicker}><span /> BEFORE WE SAY HELLO</span><h2 id="faq-title">Good questions.<br /><em>Clear answers.</em></h2><p>A few things you might be wondering<br />before we make something together.</p><button className={styles.textLink} onClick={() => onContact('brand')}>Let’s talk about your idea <ArrowUpRight size={17} aria-hidden="true" /></button></div><div className={styles.questions}>{questions.map(({ question, answer }, index) => <details className={styles.question} key={question} open={index === 0}><summary><span>{question}</span><ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>
  </div>;
}
