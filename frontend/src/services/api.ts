import { apiUrl } from '../config/env'
import type { AdminUser, DashboardData, Role } from '../types/admin'
import type { BulkAction, FilterOptions, Participant, ParticipantChanges, ParticipantFilters, ParticipantPage } from '../types/participant'
import type { CertificateRow, CertificateTemplate } from '../types/certificate'
import type { Campaign, CampaignInput, EmailTemplate, RecipientSelection, RecipientSummary } from '../types/email'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new ApiError(0, 'Cannot connect to the API. Check that the backend is running.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, typeof body.detail === 'string' ? body.detail : 'Request failed')
  }
  return response.status === 204 ? undefined as T : response.json()
}

export const api = {
  login: (email: string, password: string) => request<{ user: AdminUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  me: () => request<AdminUser>('/api/auth/me'),
  dashboard: () => request<DashboardData>('/api/admin/dashboard'),
  users: () => request<AdminUser[]>('/api/admin/users'),
  createUser: (data: { name: string; email: string; password: string; role: Role }) => request<AdminUser>('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: { role?: Role; is_active?: boolean }) => request<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  participants: (filters: ParticipantFilters, page: number, pageSize = 50) => request<ParticipantPage>(`/api/participants?${participantParams(filters, page, pageSize)}`),
  participantOptions: () => request<FilterOptions>('/api/participants/options'),
  participant: (id: number) => request<Participant>(`/api/participants/${id}`),
  updateParticipant: (id: number, changes: ParticipantChanges) => request<Participant>(`/api/participants/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  bulkParticipants: (participant_ids: number[], action: BulkAction) => request<{ updated_count: number }>('/api/participants/bulk-update', { method: 'POST', body: JSON.stringify({ participant_ids, action }) }),
  templates: () => request<CertificateTemplate[]>('/api/certificates/templates'),
  uploadTemplate: (name: string, file: File) => { const body = new FormData(); body.set('name', name); body.set('file', file); return request<CertificateTemplate>('/api/certificates/templates', { method: 'POST', body }) },
  updateTemplate: (id: number, changes: Partial<CertificateTemplate>) => request<CertificateTemplate>(`/api/certificates/templates/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  activateTemplate: (id: number) => request<CertificateTemplate>(`/api/certificates/templates/${id}/activate`, { method: 'POST' }),
  replaceTemplate: (id: number, file: File) => { const body = new FormData(); body.set('file', file); return request<CertificateTemplate>(`/api/certificates/templates/${id}/replace`, { method: 'POST', body }) },
  deleteTemplate: (id: number) => request<void>(`/api/certificates/templates/${id}`, { method: 'DELETE' }),
  certificates: (params: URLSearchParams) => request<{ items: CertificateRow[]; total: number; page: number; page_size: number }>(`/api/certificates?${params}`),
  participantCertificate: (id: number) => request<CertificateRow>(`/api/certificates/participants/${id}`),
  emailMode: () => request<{ mode: string; sending_enabled: boolean }>('/api/email/mode'),
  emailTemplates: () => request<EmailTemplate[]>('/api/email/templates'),
  createEmailTemplate: (data: Pick<EmailTemplate, 'name' | 'subject' | 'body'>) => request<EmailTemplate>('/api/email/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateEmailTemplate: (id: number, data: Pick<EmailTemplate, 'name' | 'subject' | 'body'>) => request<EmailTemplate>(`/api/email/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEmailTemplate: (id: number) => request<void>(`/api/email/templates/${id}`, { method: 'DELETE' }),
  emailPreview: (subject: string, body: string) => request<{ subject: string; body: string }>('/api/email/preview', { method: 'POST', body: JSON.stringify({ name: 'Preview', subject, body }) }),
  emailTest: (data: { to: string; sender_name: string; reply_to: string | null; subject: string; body: string; participant_id?: number }) => request<{ recipient: string; message_id: string; mode: string }>('/api/email/test', { method: 'POST', body: JSON.stringify(data) }),
  recipientSummary: (data: RecipientSelection) => request<RecipientSummary>('/api/email/recipients/summary', { method: 'POST', body: JSON.stringify(data) }),
  createCampaign: (data: CampaignInput) => request<{ id: number; status: string; recipients: number; skipped_invalid: number }>('/api/email/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  campaigns: () => request<Campaign[]>('/api/email/campaigns'),
  campaign: (id: number) => request<Campaign>(`/api/email/campaigns/${id}`),
  retryCampaign: (id: number) => request<{ retried: number }>(`/api/email/campaigns/${id}/retry`, { method: 'POST' }),
}

export async function certificatePdf(path: string, download = false) {
  const previewTab = download ? null : window.open('', '_blank')
  let response: Response
  try { response = await fetch(`${apiUrl}${path}`, { credentials: 'include' }) }
  catch { previewTab?.close(); throw new ApiError(0, 'Cannot connect to the API.') }
  if (!response.ok) {
    previewTab?.close()
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail || 'Could not load certificate PDF')
  }
  const url = URL.createObjectURL(await response.blob())
  if (download) {
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'certificate.pdf'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } else {
    if (previewTab) previewTab.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  }
}

export function participantParams(filters: ParticipantFilters, page?: number, pageSize?: number) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, value) })
  if (page !== undefined) params.set('page', String(page))
  if (pageSize !== undefined) params.set('page_size', String(pageSize))
  return params.toString()
}

export async function exportParticipants(filters: ParticipantFilters) {
  let response: Response
  try { response = await fetch(`${apiUrl}/api/participants/export?${participantParams(filters)}`, { credentials: 'include' }) }
  catch { throw new ApiError(0, 'Cannot connect to the API.') }
  if (!response.ok) throw new ApiError(response.status, 'Could not export participants')
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'tech-roulette-participants.csv'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
