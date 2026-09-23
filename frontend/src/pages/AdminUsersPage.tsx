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
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() { setUsers(await api.users()) }
  useEffect(() => { refresh().catch(err => setError(err.message)) }, [])
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
  return <><div className="admin-page-heading"><div><span className="eyebrow">/ ACCESS CONTROL</span><h1>ADMIN USERS<span>.</span></h1><p>Manage who can enter the control room.</p></div><div className="admin-phase-badge"><strong>{users.length.toString().padStart(2, '0')}</strong><br />TOTAL USERS</div></div>{error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}<div className="users-layout"><section className="admin-panel"><div className="panel-title"><span>01 / TEAM ACCESS</span><h2>CURRENT USERS</h2></div><div className="users-table-wrap"><table className="users-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><select aria-label={`Role for ${user.name}`} value={user.role} disabled={user.id === currentUser?.id} onChange={e => update(user.id, { role: e.target.value as Role })}>{roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select></td><td><span className={`status-pill ${user.is_active ? 'active' : 'inactive'}`}>{user.is_active ? 'ACTIVE' : 'DISABLED'}</span></td><td><button className="text-action" type="button" disabled={user.id === currentUser?.id} onClick={() => update(user.id, { is_active: !user.is_active })}>{user.is_active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div>{users.length === 0 && <p className="empty-state">No admin users found.</p>}</section><section className="admin-panel create-panel"><div className="panel-title"><span>02 / NEW ACCESS</span><h2>ADD A USER</h2></div><form onSubmit={create}><label htmlFor="new-name">FULL NAME</label><input id="new-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Alex Morgan" /><label htmlFor="new-email">EMAIL ADDRESS</label><input id="new-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@college.edu" /><label htmlFor="new-password">TEMPORARY PASSWORD</label><input id="new-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 12 characters" /><label htmlFor="new-role">ACCESS ROLE</label><select id="new-role" value={role} onChange={e => setRole(e.target.value as Role)}>{roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}</select><button className="button button-dark" disabled={busy} type="submit">{busy ? 'CREATING…' : 'CREATE USER →'}</button></form></section></div></>
}
