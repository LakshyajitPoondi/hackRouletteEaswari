import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../services/api'
import type { CsvParticipant } from '../types/participant'
import type { Campaign, EmailTemplate, RecipientSummary } from '../types/email'

export function EmailComposePage() {
  const location = useLocation()
  const [people, setPeople] = useState<CsvParticipant[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [mode, setMode] = useState('')
  const [selected, setSelected] = useState<Set<number>>(() => new Set((location.state as { participantIds?: number[] } | null)?.participantIds || []))
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('Your Tech Roulette certificate')
  const [body, setBody] = useState('Hi {{participant_name}},\n\nAttached is your Tech Roulette certificate for {{college_name}}.')
  const [attach, setAttach] = useState(true)
  const [testTo, setTestTo] = useState('')
  const [review, setReview] = useState<RecipientSummary | null>(null)
  const [result, setResult] = useState<Campaign | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { api.allCsvParticipants().then(setPeople).catch(err => setError(err.message)); api.emailTemplates().then(setTemplates).catch(err => setError(err.message)); api.emailMode().then(value => setMode(value.mode)).catch(err => setError(err.message)) }, [])
  const filtered = useMemo(() => people.filter(person => `${person.name} ${person.email} ${person.college} ${person.team_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [people, search])
  const chosen = people.filter(person => selected.has(person.id))
  function toggle(id: number) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next }); setReview(null) }
  function selectTemplate(id: string) { const template = templates.find(item => item.id === Number(id)); if (template) { setSubject(template.subject); setBody(template.body) } setReview(null) }
  async function sendTest() {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await api.emailTest({ to: testTo.trim(), sender_name: 'Tech Roulette', reply_to: null, subject, body,
        ...(attach && chosen.length ? { participant_id: chosen[0].id } : {}) })
      setMessage(`Test email accepted for ${response.recipient}. Message ID: ${response.message_id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Test email failed') }
    finally { setBusy(false) }
  }
  async function showReview() {
    setBusy(true); setError('')
    try { setReview(await api.recipientSummary({ selection: 'selected', participant_ids: [...selected], attach_certificate: attach, name: attach ? 'Certificate Email' : 'Participant Email' })) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not review recipients') }
    finally { setBusy(false) }
  }
  async function finish(id: number, status: string) {
    let current = await api.campaign(id)
    setResult(current)
    while (status === 'PROCESSING') {
      setProgress(`${current.sent_count + current.failed_count + current.skipped_count} / ${current.recipient_count} processed · Sent: ${current.sent_count} · Failed: ${current.failed_count} · Skipped: ${current.skipped_count}`)
      const next = await api.continueCampaign(id)
      if (!next.processed && next.status === 'PROCESSING') throw new Error('Sending paused. Open Send History to continue.')
      status = next.status
      current = await api.campaign(id)
      setResult(current)
    }
    setProgress('')
    setReview(null)
    setResult(current)
  }
  async function send() {
    if (!review) return
    setBusy(true); setError(''); setMessage(''); setProgress('Starting send…')
    try {
      const response = await api.createCampaign({ selection: 'selected', participant_ids: [...selected], name: attach ? 'Certificate Email' : 'Participant Email', email_template_id: null, sender_name: 'Tech Roulette', reply_to: null, subject, body, attach_certificate: attach, send_mode: 'now', confirmed: true, expected_recipients: review.recipients_ready })
      await finish(response.id, response.status)
    } catch (err) { setError(err instanceof Error ? err.message : 'Sending stopped. Check Send History for pending recipients.') }
    finally { setBusy(false); setProgress('') }
  }
  async function retryFailed() {
    if (!result) return
    setBusy(true); setError('')
    try { const next = await api.retryCampaign(result.id); await finish(result.id, next.status) }
    catch (err) { setError(err instanceof Error ? err.message : 'Retry failed') }
    finally { setBusy(false) }
  }
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ STEPS 5–8</span><h1>COMPOSE EMAIL<span>.</span></h1><p>Select recipients, write a message, review, and send.</p></div><Link className="button button-outline" to="/admin/email/campaigns">SEND HISTORY →</Link></div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
    {mode === 'development' && <div className="admin-notice"><span>ⓘ</span><p>Email is in development mode. Sends are simulated until EMAIL_MODE is set to production.</p></div>}
    <section className="admin-info-card"><h2>1. SELECT RECIPIENTS</h2>{people.length === 0 ? <p>No participants imported. <Link to="/admin/participants">Upload a CSV →</Link></p> : <><div className="csv-toolbar"><input type="search" aria-label="Search recipients" placeholder="Search participants…" value={search} onChange={event => setSearch(event.target.value)} /><button type="button" onClick={() => { setSelected(previous => new Set([...previous, ...filtered.map(person => person.id)])); setReview(null) }}>SELECT ALL{search && ' MATCHING'}</button><button type="button" onClick={() => { setSelected(new Set()); setReview(null) }}>DESELECT ALL</button><strong>{selected.size} PARTICIPANTS SELECTED</strong></div><div className="email-people">{filtered.map(person => <label key={person.id}><input type="checkbox" checked={selected.has(person.id)} onChange={() => toggle(person.id)} /><span><strong>{person.name}</strong><small>{person.email} · {person.college} · {person.team_name}</small></span></label>)}</div></>}</section>
    {selected.size > 0 && <section className="admin-info-card email-form"><h2>2. WRITE EMAIL</h2>{templates.length > 0 && <label>Email template (optional)<select defaultValue="" onChange={event => selectTemplate(event.target.value)}><option value="">Custom message</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>Subject<input maxLength={300} value={subject} onChange={event => { setSubject(event.target.value); setReview(null) }} /></label><label>Message<textarea rows={8} value={body} onChange={event => { setBody(event.target.value); setReview(null) }} /></label><p>Use {'{{participant_name}}'} and {'{{college_name}}'} to personalize each email.</p><label className="email-check"><input type="checkbox" checked={attach} onChange={event => { setAttach(event.target.checked); setReview(null) }} /> Attach personalized certificate</label><div className="csv-file-row"><label>Test email address<input type="email" placeholder="admin@example.com" value={testTo} onChange={event => setTestTo(event.target.value)} /></label><button type="button" disabled={busy || !testTo || !subject.trim() || !body.trim()} onClick={() => void sendTest()}>SEND TEST EMAIL</button></div><p>The test uses {attach ? `the first selected participant (${chosen[0]?.name}) and their certificate` : 'sample placeholder values'}.</p><button className="button button-dark" type="button" disabled={busy || !subject.trim() || !body.trim()} onClick={() => void showReview()}>REVIEW SEND →</button></section>}
    {review && <section className="admin-info-card"><h2>3. REVIEW AND SEND</h2><p>You selected {selected.size} participants. {review.recipients_ready} are ready to send; {selected.size - review.recipients_ready} were already sent or are unavailable.</p><p>Certificates attached: <strong>{attach ? 'YES' : 'NO'}</strong></p><div className="certificate-actions"><button type="button" disabled={busy} onClick={() => setReview(null)}>CANCEL</button><button type="button" disabled={busy || review.recipients_ready === 0} onClick={() => void send()}>{busy ? 'SENDING…' : `SEND ${review.recipients_ready} EMAILS`}</button></div></section>}
    {progress && <div className="admin-notice" role="status">Sending emails… {progress}</div>}
    {result && <section className="admin-info-card"><h2>EMAIL RESULTS</h2><div className="csv-counts"><strong>Selected {result.recipient_count}</strong><strong>Sent {result.sent_count}</strong><strong>Failed {result.failed_count}</strong>{result.skipped_count > 0 && <strong>Skipped {result.skipped_count}</strong>}</div>{result.status === 'PROCESSING' && <p>Sending paused. <Link to={`/admin/email/campaigns?sent=${result.id}&interrupted=1`}>Continue in Send History →</Link></p>}{result.failed_count > 0 && <><h3>FAILED RECIPIENTS</h3><div className="participant-table-wrap"><table className="participants-table csv-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>REASON</th></tr></thead><tbody>{result.deliveries?.filter(item => item.status === 'FAILED').map(item => <tr key={item.id}><td>{item.participant_name}</td><td>{item.email}</td><td>{item.failure_reason}</td></tr>)}</tbody></table></div><button type="button" className="button button-dark" disabled={busy || !result.deliveries?.some(item => item.status === 'FAILED' && item.attempt_count < 3)} onClick={() => void retryFailed()}>RETRY FAILED</button></>}</section>}
  </>
}
