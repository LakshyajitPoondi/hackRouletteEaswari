import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { EmailTemplate, RecipientSelection, RecipientSummary } from '../types/email'
import type { Participant } from '../types/participant'

export function EmailComposePage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [people, setPeople] = useState<Participant[]>([])
  const [peoplePage, setPeoplePage] = useState(1)
  const [peopleTotal, setPeopleTotal] = useState(0)
  const [mode, setMode] = useState('development')
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [name, setName] = useState('Tech Roulette certificates')
  const [sender, setSender] = useState('Tech Roulette')
  const [replyTo, setReplyTo] = useState('')
  const [subject, setSubject] = useState('Your Tech Roulette certificate')
  const [body, setBody] = useState('Hi {{participant_name}},\n\nAttached is your Tech Roulette certificate for {{college_name}}.')
  const [attach, setAttach] = useState(true)
  const [selection, setSelection] = useState<RecipientSelection>({ selection: 'all' })
  const [testTo, setTestTo] = useState('')
  const [testParticipantId, setTestParticipantId] = useState('')
  const [summary, setSummary] = useState<RecipientSummary | null>(null)
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.emailTemplates().then(setTemplates).catch(e => setError(e.message))
    api.emailMode().then(data => setMode(data.mode)).catch(e => setError(e.message))
  }, [])
  useEffect(() => { api.participants({ certificate_eligible: 'true' }, peoplePage, 100).then(data => { setPeople(data.items); setPeopleTotal(data.total) }).catch(e => setError(e.message)) }, [peoplePage])
  function chooseTemplate(id: number | null) {
    setTemplateId(id); const chosen = templates.find(t => t.id === id)
    if (chosen) { setSubject(chosen.subject); setBody(chosen.body) }
    setPreview(null)
  }
  function changeSelection(value: RecipientSelection) { setSelection(value); setSummary(null) }
  async function showPreview() { try { setPreview(await api.emailPreview(subject, body)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Preview failed') } }
  async function showSummary() { try { setSummary(await api.recipientSummary(selection)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Summary failed') } }
  async function sendTest() {
    try { const result = await api.emailTest({ to: testTo, sender_name: sender, reply_to: replyTo || null, subject, body, participant_id: attach && testParticipantId ? Number(testParticipantId) : undefined }); setMessage(result.mode === 'development' ? `Development mode: test to ${result.recipient} was logged, not sent.` : `Test email sent to ${result.recipient}.`); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Test failed') }
  }
  async function submit() {
    if (!summary?.recipients_ready) return
    if (!window.confirm(`Send now to ${summary.recipients_ready} recipients? ${summary.invalid_emails} invalid addresses will be skipped.`)) return
    setBusy(true); setError('')
    try {
      await api.createCampaign({ ...selection, name, email_template_id: templateId, sender_name: sender, reply_to: replyTo || null, subject, body, attach_certificate: attach, send_mode: 'now', confirmed: true })
      navigate('/admin/email/campaigns')
    } catch (e) { setError(e instanceof Error ? e.message : 'Campaign failed') }
    finally { setBusy(false) }
  }
  return <><div className="admin-page-heading"><div><span className="eyebrow">/ EMAIL</span><h1>COMPOSE<span>.</span></h1><p>Create a personalized certificate campaign.</p></div><Link className="button button-outline" to="/admin/email/templates">MANAGE TEMPLATES →</Link></div>
    {mode === 'development' && <div className="admin-notice"><span>ⓘ</span><p>Development email mode: campaigns are recorded and processed, but no real email is delivered.</p></div>}
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success">{message}</div>}
    <section className="admin-info-card email-form"><h2>MESSAGE</h2><label>Campaign name<input value={name} onChange={e => setName(e.target.value)} /></label><label>Email template<select value={templateId ?? ''} onChange={e => chooseTemplate(e.target.value ? Number(e.target.value) : null)}><option value="">Custom message</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Sender display name<input value={sender} onChange={e => setSender(e.target.value)} /></label><label>Reply-to address<input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} /></label><label>Subject<input value={subject} onChange={e => { setSubject(e.target.value); setPreview(null) }} /></label><label>Body<textarea rows={9} value={body} onChange={e => { setBody(e.target.value); setPreview(null) }} /></label><label className="email-check"><input type="checkbox" checked={attach} onChange={e => setAttach(e.target.checked)} /> Generate and attach each certificate on demand</label><div className="certificate-actions"><button onClick={() => void showPreview()}>PREVIEW WITH SAMPLE DATA</button></div>{preview && <div className="email-preview"><strong>{preview.subject}</strong><pre>{preview.body}</pre></div>}</section>
    <section className="admin-info-card email-form"><h2>TEST EMAIL</h2><p>Tests go only to the address entered here.</p><label>Test recipient<input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} /></label>{attach && <label>Certificate attachment for test<select value={testParticipantId} onChange={e => setTestParticipantId(e.target.value)}><option value="">No attachment</option>{people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>}<div className="certificate-actions"><button disabled={!testTo} onClick={() => void sendTest()}>SEND TEST EMAIL</button></div></section>
    <section className="admin-info-card email-form"><h2>RECIPIENTS</h2><label>Selection<select value={selection.selection} onChange={e => changeSelection({ selection: e.target.value as RecipientSelection['selection'], resend: selection.resend })}><option value="all">All certificate eligible</option><option value="selected">Selected participants</option><option value="filtered">Filtered participants</option></select></label>{selection.selection === 'selected' && <div className="email-people">{people.map(p => <label key={p.id}><input type="checkbox" checked={selection.participant_ids?.includes(p.id) || false} onChange={e => changeSelection({ ...selection, participant_ids: e.target.checked ? [...selection.participant_ids || [], p.id] : (selection.participant_ids || []).filter(id => id !== p.id) })} /> {p.full_name} · {p.email}</label>)}<div className="certificate-actions"><button disabled={peoplePage <= 1} onClick={() => setPeoplePage(peoplePage - 1)}>PREVIOUS</button><span>PAGE {peoplePage} · {peopleTotal} ELIGIBLE</span><button disabled={peoplePage * 100 >= peopleTotal} onClick={() => setPeoplePage(peoplePage + 1)}>NEXT</button></div></div>}{selection.selection === 'filtered' && <><label>College<input value={selection.college || ''} onChange={e => changeSelection({ ...selection, college: e.target.value })} /></label><label>Attendance<select value={selection.attendance || ''} onChange={e => changeSelection({ ...selection, attendance: e.target.value ? e.target.value as RecipientSelection['attendance'] : undefined })}><option value="">Any</option><option value="PRESENT">Present</option><option value="REGISTERED">Registered</option><option value="ABSENT">Absent</option></select></label></>}<label className="email-check"><input type="checkbox" checked={!!selection.resend} onChange={e => changeSelection({ ...selection, resend: e.target.checked })} /> Explicitly resend to participants with a previous SENT delivery</label><div className="certificate-actions"><button onClick={() => void showSummary()}>CHECK RECIPIENTS</button></div>{summary && <div className="certificate-stats">{[['SELECTED', summary.total_selected], ['INVALID EMAILS', summary.invalid_emails], ['READY', summary.recipients_ready]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>}</section>
    <section className="admin-info-card email-form"><h2>DELIVERY</h2><div className="certificate-actions"><button disabled={busy || !summary?.recipients_ready} onClick={() => void submit()}>{busy ? 'SENDING…' : 'SEND NOW'}</button></div><small>Review the recipient summary first. Final confirmation appears before delivery begins. Emails are processed when you click SEND NOW.</small></section>
  </>
}
