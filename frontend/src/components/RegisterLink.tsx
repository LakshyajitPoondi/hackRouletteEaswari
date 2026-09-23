import type { ReactNode } from 'react'
import { googleFormUrl, registrationReady } from '../config/env'

export function RegisterLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (!registrationReady) return <span className={`${className} registration-unavailable`} title="Registration unavailable">REGISTER</span>
  return <a className={className} href={googleFormUrl} target="_blank" rel="noopener noreferrer">{children}</a>
}
