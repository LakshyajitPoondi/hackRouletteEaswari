import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, certificatePdf } from '../services/api'
import type { CertificateRow } from '../types/certificate'

export function AdminCertificatesPage() {
  const [rows, setRows] = useState<CertificateRow[]>([]); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [eligible, setEligible] = useState(''); const [error, setError] = useState('')
  useEffect(() => { const params = new URLSearchParams({ page: String(page) }); if (eligible) params.set('eligible', eligible); api.certificates(params).then(data => { setRows(data.items); setTotal(data.total) }).catch(err => setError(err.message)) }, [page, eligible])
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ CERTIFICATE SYSTEM</span><h1>CERTIFICATES<span>.</span></h1><p>Preview or download an in-memory PDF. Personalized files are not stored.</p></div><div><Link className="button button-outline" to="/admin/certificates/templates">MANAGE TEMPLATE →</Link> <Link className="button button-dark" to="/admin/email/compose">SEND EMAILS →</Link></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="participant-filters certificate-filters"><label>ELIGIBILITY<select value={eligible} onChange={e => { setEligible(e.target.value); setPage(1) }}><option value="">ALL</option><option value="true">ELIGIBLE</option><option value="false">INELIGIBLE</option></select></label></div>
    <div className="participant-panel"><div className="participant-panel-heading"><span>{total} GOOGLE SHEET RECORDS</span></div><div className="participant-table-wrap"><table className="participants-table certificate-table"><thead><tr><th>PARTICIPANT</th><th>COLLEGE / TEAM</th><th>ELIGIBLE</th><th>TEMPLATE</th><th>ACTIONS</th></tr></thead><tbody>{rows.map(row => <tr key={row.participant_id}><td>{row.participant_name}</td><td>{row.college_name || '—'}{row.team_name && <small>{row.team_name}</small>}</td><td>{row.eligible ? 'YES' : 'NO'}</td><td>{row.template_name || 'NO ACTIVE TEMPLATE'}</td><td><div className="certificate-actions"><button disabled={row.status !== 'READY'} onClick={() => void certificatePdf(`/api/certificates/participants/${row.participant_id}/download`).catch(err => setError(err.message))}>PREVIEW</button><button disabled={row.status !== 'READY'} onClick={() => void certificatePdf(`/api/certificates/participants/${row.participant_id}/download`, true).catch(err => setError(err.message))}>DOWNLOAD</button></div></td></tr>)}</tbody></table></div></div>
    <div className="participant-pagination"><span>PAGE {page} / {Math.max(1, Math.ceil(total / 25))}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>PREVIOUS</button><button disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>NEXT</button></div></div>
  </>
}
