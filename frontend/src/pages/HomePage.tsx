import { motion } from 'framer-motion'
import { RegisterLink } from '../components/RegisterLink'
import { SectionHeader } from '../components/SectionHeader'
import { SiteNav } from '../components/SiteNav'
import { EventCountdown } from '../components/EventCountdown'
import { event } from '../data/event'

export function HomePage() {
  return <div className="public-site" id="top">
    <SiteNav />
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-topline"><span>EST. FOR THE BOLD ↗</span></div>
        <div className="hero-title-wrap">
          <p className="hero-presenter">THE DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE PRESENTS</p>
          <motion.h1 id="hero-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}><span>TECH</span><span>ROULETTE<span className="hero-period">.</span></span></motion.h1>
          <p className="hero-after-title">THE UNPREDICTABLE HACKATHON</p>
          <div className="hero-orbit" aria-hidden="true"><div className="orbit-ring"><span>✳</span></div><div className="orbit-label">EXPECT THE<br />UNEXPECTED</div></div>
        </div>
        <div className="hero-bottom">
          <div><span className="hero-tag">[ 03 ROUNDS · 01 MISSION ]</span><p className="hero-tagline">{event.tagline}</p><p className="hero-description">{event.description}</p></div>
          <div className="hero-conversion"><EventCountdown /><div className="hero-actions"><RegisterLink className="button button-pink">REGISTER NOW <span>↗</span></RegisterLink><a className="button button-outline" href="#rounds">EXPLORE FORMAT <span>↓</span></a></div></div>
        </div>
        <div className="hero-tape" aria-hidden="true"><div className="hero-tape-track">{[0, 1].map(group => <div className="hero-tape-group" key={group}>{[0, 1, 2].map(copy => <span key={copy}>IDEAS IN MOTION ✳ EXPECT A TWIST ✳ BUILD WHAT'S NEXT ✳&nbsp;</span>)}</div>)}</div></div>
      </section>

      <section className="section about-section" id="about" aria-labelledby="about-heading">
        <SectionHeader number="01" label="THE CONCEPT" title="NOT YOUR USUAL HACKATHON." note="Same energy. New rules of play." />
        <div className="about-grid"><div className="about-symbol" aria-hidden="true"><span className="asterisk-big">✳</span><span className="symbol-sticker">THINK<br />FAST!</span></div><div className="about-copy"><p className="lead" id="about-heading">GOOD IDEAS DON'T STAND STILL.</p><p>{event.about}</p><div className="about-facts"><div><strong>03</strong><span>ROUNDS</span></div><div><strong className="fact-value-infinity">∞</strong><span>POSSIBILITIES</span></div><div><strong>01</strong><span>SHOT TO ADAPT</span></div></div></div></div>
      </section>

      <section className="section rounds-section" id="rounds">
        <SectionHeader number="02" label="HOW IT WORKS" title="THREE ROUNDS. ALL IN." note="The format is simple. The outcome? Anyone's game." />
        <div className="round-grid">{event.rounds.map(round => <article className={`round-card ${round.color}`} key={round.number}><div className="round-card-top"><span>ROUND / {round.number}</span><span className="round-star">✳</span></div><div className="round-number">{round.number}</div><div className="round-card-bottom"><span className="round-kicker">{round.kicker}</span><h3>{round.name}</h3><p>{round.description}</p></div></article>)}</div>
        <div className="rounds-note"><span>↗</span> EVERY ROUND IS A CHANCE TO CHANGE THE GAME.</div>
      </section>

      <section className="section rules-section" id="rules">
        <SectionHeader number="03" label="THE GROUND RULES" title="PLAY FAIR. BUILD BOLD." note="The essentials before you enter the arena." />
        <div className="rules-layout"><div className="rules-sticky"><div className="rules-panel"><span>THE RULEBOOK</span><strong>10</strong><span>THINGS TO KNOW<br />BEFORE YOU GO ↗</span></div></div><ol className="rules-list">{event.rules.map((rule, index) => <li key={rule}><span>{String(index + 1).padStart(2, '0')}</span><p>{rule}</p><span aria-hidden="true">↗</span></li>)}</ol></div>
      </section>

      <section className="section schedule-section" id="schedule">
        <SectionHeader number="04" label="THE RUN OF SHOW" title="MARK YOUR MOVES." note="A preview of the event day. Times may be updated." />
        <div className="schedule-list">{event.schedule.map((item, index) => <div className="schedule-row" key={item.time}><span className="schedule-time">{item.time}</span><span className="schedule-dot" aria-hidden="true">{index === 0 || index === event.schedule.length - 1 ? '✳' : '●'}</span><span className="schedule-title">{item.title}</span><span className="schedule-index">{String(index + 1).padStart(2, '0')} / {String(event.schedule.length).padStart(2, '0')}</span></div>)}</div>
      </section>

      <section className="section faq-section" id="faq">
        <SectionHeader number="05" label="GOOD TO KNOW" title="QUESTIONS? ANSWERED." note="A few things to clear up before you jump in." />
        <div className="faq-list">{event.faqs.map((faq, index) => <details key={faq.question}><summary><span className="faq-index">{String(index + 1).padStart(2, '0')}</span><span>{faq.question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className="final-cta"><div className="cta-top"><span>YOUR MOVE STARTS HERE</span><span>✳</span></div><h2>READY TO<br /><em>ROLL?</em></h2><div className="cta-bottom"><p>Bring your team. Bring your ideas.<br />Leave room for the unexpected.</p><RegisterLink className="button button-dark">REGISTER NOW <span>↗</span></RegisterLink></div></section>
    </main>
    <footer className="site-footer"><a className="footer-brand" href="#top">TECHROULETTE ✳</a><p>CODE. SPIN. ADAPT.</p><a href="/admin/login">ADMIN LOGIN ↗</a><span>DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE</span></footer>
  </div>
}
