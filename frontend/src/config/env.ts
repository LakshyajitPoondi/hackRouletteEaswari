export const googleFormUrl = import.meta.env.VITE_GOOGLE_FORM_URL?.trim() || ''
// API paths already start with /api. An empty base uses the current origin.
export const apiUrl = (import.meta.env.VITE_API_URL?.trim() || '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')

const googleFormUrlPatterns = [
  /^https:\/\/docs\.google\.com\/forms\//,
  /^https:\/\/forms\.gle\/[A-Za-z0-9_-]+/,
]

export const registrationReady = googleFormUrlPatterns.some(pattern => pattern.test(googleFormUrl))
  && !googleFormUrl.includes('REPLACE_ME')
