export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'

export interface AdminUser {
  id: number
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DashboardData {
  is_placeholder: boolean
  metrics: {
    registrations: number
    present: number
    absent: number
    registered: number
    certificate_eligible: number
    teams: number
    certificates_sent: number
    failed_emails: number
    scheduled_campaigns: number
  }
}
