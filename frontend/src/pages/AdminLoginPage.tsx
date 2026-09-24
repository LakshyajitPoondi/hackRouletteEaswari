import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminLoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from || '/admin/dashboard'} state={location.state?.returnState} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try { await login(email, password); navigate(location.state?.from || '/admin/dashboard', { replace: true, state: location.state?.returnState }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed') }
    finally { setBusy(false) }
  }

  return <div className="login-screen">
    <div className="login-side">
      <Link to="/" className="login-brand">✳ TECHROULETTE</Link>
      <div><span className="login-side-kicker">/ THE CONTROL ROOM</span><h1>MAKE<br />YOUR<br /><em>MOVE.</em></h1><p>Authorized organizers only.</p></div>
      <span>CODE. SPIN. ADAPT.</span>
    </div>
    <main className="login-form-side">
      <div className="login-panel">
        <span className="eyebrow">ADMIN ACCESS / 01</span>
        <h2>WELCOME<br />BACK.</h2>
        <p>Sign in to manage the event.</p>
        {location.state?.sessionExpired && <div className="admin-notice" role="status">Your admin session ended. Sign in again to continue.</div>}
        <form onSubmit={submit}>
          <label htmlFor="email">EMAIL ADDRESS</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu" />
          <label htmlFor="password">PASSWORD</label>
          <div className="password-field">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
            <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'HIDE' : 'SHOW'}</button>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN →'}</button>
        </form>
        <Link className="back-link" to="/">← BACK TO WEBSITE</Link>
      </div>
    </main>
  </div>
}
