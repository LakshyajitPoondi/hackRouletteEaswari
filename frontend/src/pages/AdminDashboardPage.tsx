import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { DashboardData } from '../types/admin'
import { useAuth } from '../hooks/useAuth'

const metricLabels: [keyof DashboardData['metrics'], string, string][] = [
  ['registrations', 'REGISTRATIONS', '↗'],
  ['present', 'PRESENT', '✓'],
  ['absent', 'ABSENT', '−'],
  ['registered', 'NOT CHECKED IN', '○'],
  ['certificate_eligible', 'CERTIFICATE ELIGIBLE', '✳'],
  ['certificates_sent', 'CERTIFICATES SENT', '✉'],
  ['failed_emails', 'FAILED EMAILS', '!'],
  ['teams', 'TEAMS', '♟'],
  ['email_templates', 'EMAIL TEMPLATES', '▧'],
  ['campaigns', 'CAMPAIGNS', '◷'],
  ['admin_users', 'ADMIN USERS', '♟'],
]

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.dashboard().then(setData).catch(err => setError(err.message))
  }, [])
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ OVERVIEW</span><h1>CONTROL ROOM<span>.</span></h1><p>Welcome back, {user?.name}. Here's your event overview.</p></div><div className="admin-phase-badge">LIVE<br /><strong>OPERATIONS</strong></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="metric-grid">{metricLabels.map(([key, label, icon]) => <div className="metric-card" key={key}><div><span>{label}</span><span>{icon}</span></div><strong>{data ? data.metrics[key] : '—'}</strong><small>{['certificates_sent', 'failed_emails', 'email_templates', 'campaigns', 'admin_users'].includes(key) ? 'APP RECORDS' : 'GOOGLE SHEETS'}</small></div>)}</div>
    <div className="admin-info-card"><span className="eyebrow">EVENT OPERATIONS</span><h2>PARTICIPANTS ARE READY.</h2><p>Review registrations, check in attendees, update certificate eligibility, and export a filtered CSV.</p><Link className="button button-dark" to="/admin/participants">OPEN PARTICIPANTS →</Link></div>
    {user?.role !== 'STAFF' && <div className="admin-info-card"><span className="eyebrow">CERTIFICATE SYSTEM</span><h2>SEND CERTIFICATES.</h2><p>Certificates are generated in memory from Google Sheets data when previewed or emailed.</p><Link className="button button-dark" to="/admin/email/compose">COMPOSE EMAIL →</Link></div>}
  </>
}

