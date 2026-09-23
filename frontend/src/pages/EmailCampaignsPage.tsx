import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { Campaign } from '../types/email'

export function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [detail, setDetail] = useState<Campaign | null>(null)
  const [newTime, setNewTime] = useState('')
  const [zone, setZone] = useState('Asia/Kolkata')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const load = async () => { const rows = await api.campaigns(); setCampaigns(rows); if (detail) setDetail(await api.campaign(detail.id)) }
  useEffect(() => { void load().catch(e => setError(e.message)); const timer = window.setInterval(() => void load().catch(() => {}), 15000); return () => window.clearInterval(timer) }, [detail?.id])
  async function action(fn: () => Promise<unknown>, success: string) {
    try { await fn(); setMessage(success); setError(''); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed') }
  }
  return <><div className="admin-page-heading"><div><span className="eyebrow">/ EMAIL</span><h1>CAMPAIGNS<span>.</span></h1><p>Track each recipient and retry failures.</p></div><Link className="button button-dark" to="/admin/email/compose">NEW CAMPAIGN →</Link></div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success">{message}</div>}
    <div className="participant-panel"><div className="participant-table-wrap"><table className="participants-table email-table"><thead><tr><th>CAMPAIGN</th><th>RECIPIENTS</th><th>SCHEDULED</th><th>STATUS</th><th>SENT</th><th>FAILED</th><th>CREATED BY</th><th>DETAILS</th></tr></thead><tbody>{campaigns.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.recipient_count}</td><td>{row.scheduled_for ? new Date(row.scheduled_for).toLocaleString() : '—'}</td><td>{row.status}</td><td>{row.sent_count}</td><td>{row.failed_count}</td><td>{row.created_by_name}</td><td><button className="text-action" onClick={() => void api.campaign(row.id).then(setDetail).catch(e => setError(e.message))}>VIEW</button></td></tr>)}</tbody></table></div>{campaigns.length === 0 && <div className="empty-state">No campaigns yet.</div>}</div>
    {detail && <section className="admin-info-card"><div className="email-detail-heading"><h2>{detail.name}</h2><button onClick={() => setDetail(null)}>CLOSE</button></div><p>{detail.status} · {detail.sent_count} sent · {detail.failed_count} failed · {detail.recipient_count} recipients</p><div className="certificate-actions">{detail.status === 'SCHEDULED' && <button onClick={() => { if (window.confirm('Cancel this scheduled campaign?')) void action(() => api.cancelCampaign(detail.id), 'Campaign cancelled.') }}>CANCEL SCHEDULE</button>}{['FAILED', 'PARTIALLY_FAILED'].includes(detail.status) && <button onClick={() => { if (window.confirm(`Retry only the ${detail.failed_count} failed deliveries?`)) void action(() => api.retryCampaign(detail.id), 'Failed deliveries retried.') }}>RETRY FAILED</button>}</div>{detail.status === 'SCHEDULED' && <div className="email-form email-reschedule"><label>New date and time<input type="datetime-local" value={newTime} onChange={e => setNewTime(e.target.value)} /></label><label>Timezone<input value={zone} onChange={e => setZone(e.target.value)} /></label><div className="certificate-actions"><button disabled={!newTime} onClick={() => void action(() => api.rescheduleCampaign(detail.id, newTime, zone), 'Campaign rescheduled.')}>RESCHEDULE</button></div></div>}<div className="participant-table-wrap"><table className="participants-table email-table"><thead><tr><th>PARTICIPANT</th><th>EMAIL</th><th>STATUS</th><th>ATTEMPTS</th><th>SENT AT</th><th>FAILURE</th></tr></thead><tbody>{detail.deliveries?.map(d => <tr key={d.id}><td>{d.participant_name}</td><td>{d.email}</td><td>{d.status}</td><td>{d.attempt_count}</td><td>{d.sent_at ? new Date(d.sent_at).toLocaleString() : '—'}</td><td>{d.failure_reason || '—'}</td></tr>)}</tbody></table></div></section>}
  </>
}
