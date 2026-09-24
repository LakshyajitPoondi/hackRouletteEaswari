import { useState } from 'react'
import { Link } from 'react-router-dom'
import { manualCertificatePdf } from '../services/api'

export function AdminCertificatesPage() {
  const [name, setName] = useState('John Doe')
  const [college, setCollege] = useState('Example Engineering College')
  const [error, setError] = useState('')
  async function generate(download: boolean) {
    setError('')
    try { await manualCertificatePdf(name.trim(), college.trim(), download) }
    catch (err) { setError(err instanceof Error ? err.message : 'Certificate generation failed') }
  }
  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ STEP 3</span><h1>GENERATE CERTIFICATE<span>.</span></h1><p>Type a name and college to test your active template.</p></div><Link className="button button-outline" to="/admin/certificates/templates">EDIT TEMPLATE →</Link></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section className="admin-info-card email-form"><h2>TEST CERTIFICATE</h2><label>Participant name<input value={name} onChange={event => setName(event.target.value)} /></label><label>College name<input value={college} onChange={event => setCollege(event.target.value)} /></label><div className="certificate-actions"><button disabled={!name.trim() || !college.trim()} onClick={() => void generate(false)}>PREVIEW CERTIFICATE</button><button disabled={!name.trim() || !college.trim()} onClick={() => void generate(true)}>GENERATE PDF</button></div><p>The PDF is generated immediately from the active template. No participant record is required.</p></section>
  </>
}
