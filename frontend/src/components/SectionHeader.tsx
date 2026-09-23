export function SectionHeader({ number, label, title, note }: { number: string; label: string; title: string; note?: string }) {
  return <div className="section-heading">
    <div className="section-heading-top"><span className="section-index">/{number}</span><span className="eyebrow">{label}</span></div>
    <div className="section-heading-main"><h2>{title}</h2>{note && <p>{note}</p>}</div>
  </div>
}
