export const googleFormUrl = import.meta.env.VITE_GOOGLE_FORM_URL?.trim() || ''
export const apiUrl = import.meta.env.VITE_API_URL?.trim() ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000')
export const devAdminBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_BYPASS === 'true'

const googleFormUrlPatterns = [
  /^https:\/\/docs\.google\.com\/forms\//,
  /^https:\/\/forms\.gle\/[A-Za-z0-9_-]+/,
]

export const registrationReady = googleFormUrlPatterns.some(pattern => pattern.test(googleFormUrl))
  && !googleFormUrl.includes('REPLACE_ME')
