export interface CertificateTemplate {
  id: number
  name: string
  file_type: string
  is_active: boolean
  name_x: number
  name_y: number
  name_font_size: number
  name_alignment: 'left' | 'center' | 'right'
  name_color: string
  college_x: number
  college_y: number
  college_font_size: number
  college_alignment: 'left' | 'center' | 'right'
  college_color: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface CertificateRow {
  participant_id: number
  participant_name: string
  team_name: string | null
  college_name: string | null
  eligible: boolean
  status: 'READY' | 'NO_TEMPLATE'
  template_name: string | null
}
