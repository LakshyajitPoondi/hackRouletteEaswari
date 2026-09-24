import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ superAdminOnly = false, certificateAdminOnly = false }: { superAdminOnly?: boolean; certificateAdminOnly?: boolean }) {
  const { user, loading, sessionExpired } = useAuth()
  const location = useLocation()
  if (loading) return <div className="admin-loading">CHECKING SESSION…</div>
  if (!user) return <Navigate to="/admin/login" state={{ from: location.pathname, returnState: location.state, sessionExpired }} replace />
  if (superAdminOnly && user.role !== 'SUPER_ADMIN') return <Navigate to="/admin/dashboard" replace />
  if (certificateAdminOnly && user.role === 'STAFF') return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}
