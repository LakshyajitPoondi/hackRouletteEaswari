import type { AttendanceStatus, Participant } from '../../types/participant'

interface Props {
  participants: Participant[]
  selected: Set<number>
  onSelect: (id: number) => void
  onSelectAll: () => void
  onOpen: (id: number) => void
  onAttendance: (id: number, status: AttendanceStatus) => void
  busyId: number | null
}

export function ParticipantTable({ participants, selected, onSelect, onSelectAll, onOpen, onAttendance, busyId }: Props) {
  return <div className="participant-table-wrap"><table className="participants-table"><thead><tr><th><input type="checkbox" aria-label="Select all participants on this page" checked={participants.length > 0 && participants.every(p => selected.has(p.id))} onChange={onSelectAll} /></th><th>NAME / EMAIL</th><th>COLLEGE</th><th>DEPARTMENT</th><th>YEAR</th><th>TEAM</th><th>REGISTERED</th><th>ATTENDANCE</th><th>CERTIFICATE</th><th>STATUS</th></tr></thead><tbody>{participants.map(participant => <tr key={participant.id}><td><input type="checkbox" aria-label={`Select ${participant.full_name}`} checked={selected.has(participant.id)} onChange={() => onSelect(participant.id)} /></td><td><button className="participant-name" type="button" onClick={() => onOpen(participant.id)}>{participant.full_name}</button><small>{participant.email}</small></td><td>{participant.college || '—'}</td><td>{participant.department || '—'}</td><td>{participant.year || '—'}</td><td>{participant.team_name || '—'}</td><td>{new Date(participant.registration_timestamp).toLocaleDateString()}</td><td><span className={`attendance-badge ${participant.attendance_status.toLowerCase()}`}>{participant.attendance_status}</span><div className="row-attendance"><button type="button" disabled={busyId === participant.id} onClick={() => onAttendance(participant.id, 'PRESENT')} title="Mark present">✓</button><button type="button" disabled={busyId === participant.id} onClick={() => onAttendance(participant.id, 'ABSENT')} title="Mark absent">−</button></div></td><td>{participant.certificate_eligible ? <span className="status-pill active">ELIGIBLE</span> : '—'}</td><td>{participant.is_disqualified ? <span className="status-pill inactive">DISQUALIFIED</span> : <span className="status-pill active">ACTIVE</span>}</td></tr>)}</tbody></table></div>
}
