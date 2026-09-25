import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../services/api'
import type { AdminUser, Role } from '../types/admin'
import { useAuth } from '../hooks/useAuth'

const roles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF']

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('STAFF')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pendingDisable, setPendingDisable] = useState<AdminUser | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() { setUsers(await api.users()) }
  useEffect(() => { if (currentUser?.role === 'SUPER_ADMIN') refresh().catch(err => setError(err.message)) }, [currentUser?.role])

  async function create(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    try { await api.createUser({ name, email, password, role }); await refresh(); setName(''); setEmail(''); setPassword(''); setRole('STAFF'); setMessage('Admin user created.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create user') }
    finally { setBusy(false) }
  }

  async function update(id: number, changes: { role?: Role; is_active?: boolean }) {
    setError(''); setMessage('')
    try { await api.updateUser(id, changes); await refresh(); setMessage('User updated.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update user') }
  }

  async function disable() {
    if (!pendingDisable) return
    setError(''); setMessage(''); setBusy(true)
    try { await api.disableUser(pendingDisable.id); await refresh(); setMessage(`${pendingDisable.email} disabled.`); setPendingDisable(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not disable user'); setPendingDisable(null) }
    finally { setBusy(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    if (newPassword.length < 12) { setError('Password is too short (minimum 12 characters)'); return }
    setBusy(true)
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword, confirm_new_password: confirmPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setMessage('Password updated successfully.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update password') }
    finally { setBusy(false) }
  }

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ ACCESS CONTROL</span><h1>USER MANAGEMENT<span>.</span></h1><p>Manage your account{currentUser?.role === 'SUPER_ADMIN' ? ' and team access' : ''}.</p></div>{currentUser?.role === 'SUPER_ADMIN' && <div className="admin-phase-badge"><strong>{users.length.toString().padStart(2, '0')}</strong><br />TOTAL USERS</div>}</div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {message && <div className="form-success" role="status">{message}</div>}
    <div className="users-layout">
      {currentUser?.role === 'SUPER_ADMIN' && <section className="admin-panel"><div className="panel-title"><span>01 / TEAM ACCESS</span><h2>CURRENT USERS</h2></div><div className="users-table-wrap"><table className="users-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><select aria-label={`Role for ${user.name}`} value={user.role} disabled={user.id === currentUser?.id} onChange={e => update(user.id, { role: e.target.value as Role })}>{roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></td><td><span className={`status-pill ${user.is_active ? 'active' : 'inactive'}`}>{user.is_active ? 'ACTIVE' : 'DISABLED'}</span></td><td><button className="text-action" type="button" disabled={user.id === currentUser?.id} onClick={() => user.is_active ? setPendingDisable(user) : update(user.id, { is_active: true })}>{user.is_active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div>{users.length === 0 && <p className="empty-state">No admin users found.</p>}</section>}
      <div className="user-side-panels">
        {currentUser?.role === 'SUPER_ADMIN' && <section className="admin-panel create-panel"><div className="panel-title"><span>02 / NEW ACCESS</span><h2>ADD A USER</h2></div><form onSubmit={create}><label htmlFor="new-name">FULL NAME</label><input id="new-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Alex Morgan" /><label htmlFor="new-email">EMAIL ADDRESS</label><input id="new-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@college.edu" /><label htmlFor="new-password">TEMPORARY PASSWORD</label><input id="new-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 12 characters" /><label htmlFor="new-role">ACCESS ROLE</label><select id="new-role" value={role} onChange={e => setRole(e.target.value as Role)}>{roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select><button className="button button-dark" disabled={busy} type="submit">{busy ? 'CREATING…' : 'CREATE USER →'}</button></form></section>}
        <section className="admin-panel create-panel"><div className="panel-title"><span>03 / MY ACCOUNT</span><h2>CHANGE MY PASSWORD</h2><small>{currentUser?.email}</small></div><form onSubmit={changePassword}><label htmlFor="current-password">CURRENT PASSWORD</label><input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /><label htmlFor="my-new-password">NEW PASSWORD</label><input id="my-new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} /><label htmlFor="confirm-password">CONFIRM NEW PASSWORD</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /><button className="button button-dark" disabled={busy} type="submit">{busy ? 'UPDATING…' : 'UPDATE PASSWORD →'}</button></form></section>
      </div>
    </div>
    {pendingDisable && <div className="user-modal-backdrop"><div className="user-modal" role="alertdialog" aria-modal="true" aria-labelledby="disable-title" aria-describedby="disable-description"><h2 id="disable-title">DISABLE USER?</h2><p id="disable-description">Disable <strong>{pendingDisable.email}</strong>? This user will no longer be able to log in.</p><div className="user-modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setPendingDisable(null)}>CANCEL</button><button type="button" className="button button-dark" disabled={busy} onClick={disable}>{busy ? 'DISABLING…' : 'DISABLE USER'}</button></div></div></div>}
  </>
}
