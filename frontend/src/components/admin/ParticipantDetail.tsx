import { useEffect, useState, type FormEvent } from 'react'
import { api, certificatePdf } from '../../services/api'
import type { CertificateRow } from '../../types/certificate'
import type { AttendanceStatus, Participant, ParticipantChanges } from '../../types/participant'

interface Props {
  participant: Participant
  canManage: boolean
  onClose: () => void
  onSaved: (participant: Participant) => void
}

export function ParticipantDetail({ participant, canManage, onClose, onSaved }: Props) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const [form, setForm] = useState<ParticipantChanges>({
    full_name: participant.full_name, email: participant.email, phone: participant.phone,
    college: participant.college, department: participant.department, year: participant.year,
    team_name: participant.team_name, attendance_status: participant.attendance_status,
    certificate_eligible: participant.certificate_eligible, is_disqualified: participant.is_disqualified,
    notes: participant.notes,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [certificate, setCertificate] = useState<CertificateRow | null>(null)
  useEffect(() => { if (canManage) api.participantCertificate(participant.id).then(setCertificate).catch(err => setError(err.message)) }, [participant.id, canManage])
  function change<K extends keyof ParticipantChanges>(key: K, value: ParticipantChanges[K]) {
    setForm(previous => ({ ...previous, [key]: value }))
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    const changes = Object.fromEntries((Object.keys(form) as (keyof ParticipantChanges)[])
      .filter(key => form[key] !== participant[key]).map(key => [key, form[key]])) as ParticipantChanges
    if (Object.keys(changes).length === 0) { setBusy(false); return }
    try { onSaved(await api.updateParticipant(participant.id, changes)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save participant') }
    finally { setBusy(false) }
  }
  async function attendance(value: AttendanceStatus) {
    setError(''); setBusy(true)
    try { onSaved(await api.updateParticipant(participant.id, { attendance_status: value })); change('attendance_status', value) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update attendance') }
    finally { setBusy(false) }
  }
  return <div className="detail-overlay" role="presentation" onMouseDown={onClose}>
    <section className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="participant-title" onMouseDown={event => event.stopPropagation()}>
      <header className="detail-header"><div><span className="eyebrow">PARTICIPANT / #{participant.id}</span><h2 id="participant-title">{participant.full_name}</h2></div><button type="button" className="detail-close" onClick={onClose} aria-label="Close participant details" autoFocus>✕</button></header>
      <div className="detail-body">
        <div className="detail-meta"><span className={`attendance-badge ${participant.attendance_status.toLowerCase()}`}>{participant.attendance_status}</span>{participant.is_disqualified && <span className="status-pill inactive">DISQUALIFIED</span>}<span>REGISTERED {new Date(participant.registration_timestamp).toLocaleString()}</span></div>
        <div className="detail-quick"><strong>EVENT-DAY CHECK-IN</strong><div><button type="button" disabled={busy} onClick={() => attendance('PRESENT')}>✓ MARK PRESENT</button><button type="button" disabled={busy} onClick={() => attendance('ABSENT')}>− MARK ABSENT</button></div></div>
        {canManage && <div className="detail-quick"><strong>CERTIFICATE / {certificate?.status || 'LOADING'}</strong><p>{certificate?.template_name || 'Activate a template first'}</p><div>{certificate?.status === 'READY' && <button type="button" onClick={() => void certificatePdf(`/api/certificates/participants/${participant.id}/download`).catch(err => setError(err.message))}>PREVIEW ON DEMAND</button>}</div></div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {canManage ? <form className="detail-form" onSubmit={save}>
          <label>FULL NAME<input required maxLength={160} value={form.full_name || ''} onChange={e => change('full_name', e.target.value)} /></label>
          <label>EMAIL<input required type="email" value={form.email || ''} onChange={e => change('email', e.target.value)} /></label>
          <label>PHONE<input maxLength={32} value={form.phone || ''} onChange={e => change('phone', e.target.value || null)} /></label>
          <label>COLLEGE<input maxLength={160} value={form.college || ''} onChange={e => change('college', e.target.value || null)} /></label>
          <label>DEPARTMENT<input maxLength={160} value={form.department || ''} onChange={e => change('department', e.target.value || null)} /></label>
          <label>YEAR<input maxLength={32} value={form.year || ''} onChange={e => change('year', e.target.value || null)} /></label>
          <label>TEAM<input maxLength={160} value={form.team_name || ''} onChange={e => change('team_name', e.target.value || null)} /></label>
          <label>ATTENDANCE<select value={form.attendance_status} onChange={e => change('attendance_status', e.target.value as AttendanceStatus)}><option value="REGISTERED">REGISTERED</option><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option></select></label>
          <label className="detail-checkbox"><input type="checkbox" checked={!!form.certificate_eligible} onChange={e => change('certificate_eligible', e.target.checked)} /> CERTIFICATE ELIGIBLE</label>
          <label className="detail-checkbox"><input type="checkbox" checked={!!form.is_disqualified} onChange={e => change('is_disqualified', e.target.checked)} /> DISQUALIFIED</label>
          <label className="detail-wide">ADMIN NOTES / DISQUALIFICATION REASON<textarea rows={4} maxLength={5000} value={form.notes || ''} onChange={e => change('notes', e.target.value || null)} /></label>
          <button type="submit" className="button button-dark" disabled={busy}>{busy ? 'SAVING…' : 'SAVE CHANGES →'}</button>
        </form> : <div className="staff-detail"><h3>REGISTRATION DETAILS</h3><dl><dt>Email</dt><dd>{participant.email}</dd><dt>Phone</dt><dd>{participant.phone || '—'}</dd><dt>College</dt><dd>{participant.college || '—'}</dd><dt>Department</dt><dd>{participant.department || '—'}</dd><dt>Year</dt><dd>{participant.year || '—'}</dd><dt>Team</dt><dd>{participant.team_name || '—'}</dd><dt>Certificate eligible</dt><dd>{participant.certificate_eligible ? 'Yes' : 'No'}</dd><dt>Notes</dt><dd>{participant.notes || '—'}</dd></dl></div>}
      </div>
    </section>
  </div>
}
