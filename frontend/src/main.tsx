import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './hooks/useAuth'
import { AdminLayout } from './layouts/AdminLayout'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { AdminParticipantsPage } from './pages/AdminParticipantsPage'
import { AdminCertificatesPage } from './pages/AdminCertificatesPage'
import { AdminCertificateTemplatesPage } from './pages/AdminCertificateTemplatesPage'
import { EmailTemplatesPage } from './pages/EmailTemplatesPage'
import { EmailComposePage } from './pages/EmailComposePage'
import { EmailCampaignsPage } from './pages/EmailCampaignsPage'
import { HomePage } from './pages/HomePage'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><AuthProvider><Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/admin/login" element={<AdminLoginPage />} />
  <Route element={<ProtectedRoute />}><Route element={<AdminLayout />}>
    <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
    <Route path="/admin/participants" element={<AdminParticipantsPage />} />
    <Route element={<ProtectedRoute certificateAdminOnly />}>
      <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
      <Route path="/admin/certificates/templates" element={<AdminCertificateTemplatesPage />} />
      <Route path="/admin/email/templates" element={<EmailTemplatesPage />} />
      <Route path="/admin/email/compose" element={<EmailComposePage />} />
      <Route path="/admin/email/campaigns" element={<EmailCampaignsPage />} />
    </Route>
    <Route element={<ProtectedRoute superAdminOnly />}><Route path="/admin/users" element={<AdminUsersPage />} /></Route>
  </Route></Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes></AuthProvider></BrowserRouter></React.StrictMode>)
