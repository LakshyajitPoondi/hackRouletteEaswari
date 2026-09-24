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
    <div className="admin-page-heading"><div><span className="eyebrow">/ OVERVIEW</span><h1>ADMIN WORKFLOW<span>.</span></h1><p>Set up a template, generate a test PDF, then send one email.</p></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="metric-grid">{indicators.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong className="manual-status">{status ? value : 'LOADING'}</strong></div>)}</div>
    <div className="admin-info-card"><h2>1. Certificate template</h2><p>Upload a PDF or image, drag the participant name and college name into place, then save.</p><Link className="button button-dark" to="/admin/certificates/templates">SET UP TEMPLATE →</Link></div>
    <div className="admin-info-card"><h2>2. Generate certificate</h2><p>Type sample details, preview the result, and download a PDF.</p><Link className="button button-dark" to="/admin/certificates">GENERATE CERTIFICATE →</Link></div>
    <div className="admin-info-card"><h2>3. Send email</h2><p>Enter one recipient, write a message, and optionally attach the certificate.</p><Link className="button button-dark" to="/admin/email/compose">COMPOSE EMAIL →</Link></div>
  </>
}
