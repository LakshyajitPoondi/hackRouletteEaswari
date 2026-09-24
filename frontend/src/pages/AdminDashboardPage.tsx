import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'

export function AdminDashboardPage() {
  const [status, setStatus] = useState<{ template_ready: boolean; brevo_configured: boolean } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api.manualStatus().then(setStatus).catch(err => setError(err.message)) }, [])
  const indicators = [
    ['Certificate template', status?.template_ready ? 'READY' : 'NOT CONFIGURED'],
    ['Certificate generation', status?.template_ready ? 'READY TO TEST' : 'NEEDS SETUP'],
    ['Brevo email', status?.brevo_configured ? 'CONFIGURED' : 'NOT CONFIGURED'],
    ['Last test send', localStorage.getItem('techroulette-last-manual-send') || 'NONE'],
  ]
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ OVERVIEW</span><h1>ADMIN WORKFLOW<span>.</span></h1><p>Import participants, verify the list, prepare certificates, then send and review results.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="metric-grid">{indicators.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong className="manual-status">{status ? value : 'LOADING'}</strong></div>)}</div>
    <div className="admin-info-card"><h2>1. Upload and verify participants</h2><p>Preview a CSV and import only valid rows.</p><Link className="button button-dark" to="/admin/participants">PARTICIPANTS →</Link></div>
    <div className="admin-info-card"><h2>2. Configure certificate template</h2><p>Upload a PDF or image, drag the name and college into place, then activate it.</p><Link className="button button-dark" to="/admin/certificates/templates">SET UP TEMPLATE →</Link></div>
    <div className="admin-info-card"><h2>3. Test certificate</h2><p>Preview the final PDF with sample details.</p><Link className="button button-dark" to="/admin/certificates">GENERATE CERTIFICATE →</Link></div>
    <div className="admin-info-card"><h2>4. Select, compose, and send</h2><p>Select imported participants, send a test, then review the send results.</p><Link className="button button-dark" to="/admin/email/compose">COMPOSE EMAIL →</Link></div>
  </>
}
