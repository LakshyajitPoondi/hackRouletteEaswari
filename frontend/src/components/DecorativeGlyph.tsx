type Glyph = 'star' | 'arrow-up-right' | 'arrow-down' | 'infinity' | 'dot'

export function DecorativeGlyph({ glyph }: { glyph: Glyph }) {
  if (glyph === 'star') {
    return <svg className="decorative-glyph" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false"><path d="M50 8v84M8 50h84M20 20l60 60M80 20L20 80" stroke="currentColor" strokeWidth="12" strokeLinecap="round" /></svg>
  }
  if (glyph === 'infinity') {
    return <svg className="decorative-glyph" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false"><path d="M50 50C36 30 28 28 18 28 6 28 4 40 4 50s2 22 14 22c10 0 18-2 32-22 14-20 22-22 32-22 12 0 14 12 14 22s-2 22-14 22c-10 0-18-2-32-22Z" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
  if (glyph === 'dot') {
    return <svg className="decorative-glyph" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="32" fill="currentColor" /></svg>
  }
  return <svg className="decorative-glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d={glyph === 'arrow-up-right' ? 'M4 20 20 4M8 4h12v12' : 'M12 3v18m-8-8 8 8 8-8'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" /></svg>
}
