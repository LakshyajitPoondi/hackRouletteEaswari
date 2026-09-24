import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { EmailTemplate } from '../types/email'

export function EmailComposePage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [recipient, setRecipient] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [subject, setSubject] = useState('Your Tech Roulette certificate')
  const [body, setBody] = useState('Hi {{participant_name}},\n\nAttached is your Tech Roulette certificate for {{college_name}}.')
  const [attach, setAttach] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ brevo_configured: boolean; email_mode: string } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { api.emailTemplates().then(setTemplates).catch(err => setError(err.message)); api.manualStatus().then(setStatus).catch(err => setError(err.message)) }, [])
  function selectTemplate(id: string) {
    const template = templates.find(item => item.id === Number(id))
    if (template) { setSubject(template.subject); setBody(template.body) }
  }
  async function send() {
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await api.manualSend({ to: recipient.trim(), participant_name: participantName.trim(), college_name: collegeName.trim(), subject, body, attach_certificate: attach })
      setMessage(`Email sent successfully to ${result.recipient}. Brevo message ID: ${result.message_id}`)
      localStorage.setItem('techroulette-last-manual-send', 'SUCCESS')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email sending failed')
      localStorage.setItem('techroulette-last-manual-send', 'FAILED')
    } finally { setBusy(false) }
  }
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ STEP 4 AND 5</span><h1>COMPOSE EMAIL<span>.</span></h1><p>Enter one recipient and send immediately through Brevo.</p></div><Link className="button button-outline" to="/admin/email/templates">EMAIL TEMPLATES →</Link></div>
    {status && !status.brevo_configured && <div className="admin-notice"><span>ⓘ</span><p>Brevo is not ready. The server needs EMAIL_MODE=production, BREVO_API_KEY and EMAIL_FROM before a real email can be sent.</p></div>}
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success">{message}</div>}
    <section className="admin-info-card email-form"><h2>ONE EMAIL</h2>
      <label>Recipient email<input type="email" value={recipient} onChange={event => setRecipient(event.target.value)} /></label>
      <label>Participant name<input value={participantName} onChange={event => setParticipantName(event.target.value)} /></label>
      <label>College name<input value={collegeName} onChange={event => setCollegeName(event.target.value)} /></label>
      {templates.length > 0 && <label>Start from an email template (optional)<select defaultValue="" onChange={event => selectTemplate(event.target.value)}><option value="">Custom message</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label>Subject<input value={subject} onChange={event => setSubject(event.target.value)} /></label>
      <label>Message<textarea rows={8} value={body} onChange={event => setBody(event.target.value)} /></label>
      <p>You can use {'{{participant_name}}'} and {'{{college_name}}'} in the subject or message.</p>
      <label className="email-check"><input type="checkbox" checked={attach} onChange={event => setAttach(event.target.checked)} /> Attach generated certificate</label>
      <div className="certificate-actions"><button disabled={busy || !recipient || !participantName.trim() || !collegeName.trim() || !subject.trim() || !body.trim()} onClick={() => void send()}>{busy ? 'SENDING…' : 'SEND EMAIL'}</button></div>
    </section>
  </>
}
