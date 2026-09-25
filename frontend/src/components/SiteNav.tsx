import { useState } from 'react'
import { RegisterLink } from './RegisterLink'
import { DecorativeGlyph } from './DecorativeGlyph'
import eecLogo from '../assets/eec-logo-black-text.webp'
import departmentLogo from '../assets/aids-department-logo.png'

const links = ['About', 'Rounds', 'Rules', 'Schedule', 'FAQ']

export function SiteNav() {
  const [open, setOpen] = useState(false)
  return <header className="site-nav">
    <a className="brand" href="#top" aria-label="Easwari Engineering College and the Department of Artificial Intelligence and Data Science, back to top">
      <img className="college-logo" src={eecLogo} alt="Easwari Engineering College" />
      <span className="brand-divider" aria-hidden="true" />
      <img className="department-logo" src={departmentLogo} alt="Artificial Intelligence and Data Science department, Easwari Engineering College" width="320" height="320" />
    </a>
    <button className="nav-toggle" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
    <nav className={open ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
      {links.map(link => <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setOpen(false)}>{link}</a>)}
      <RegisterLink className="nav-register">REGISTER <DecorativeGlyph glyph="arrow-up-right" /></RegisterLink>
    </nav>
  </header>
}
