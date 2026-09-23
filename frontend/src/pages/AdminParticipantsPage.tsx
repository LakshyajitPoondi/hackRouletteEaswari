import { useEffect, useState } from 'react'
import { ParticipantDetail } from '../components/admin/ParticipantDetail'
import { ParticipantTable } from '../components/admin/ParticipantTable'
import { useAuth } from '../hooks/useAuth'
import { api, exportParticipants } from '../services/api'
import type { AttendanceStatus, BulkAction, FilterOptions, Participant, ParticipantFilters, ParticipantPage } from '../types/participant'

const initialFilters: ParticipantFilters = { sort_by: 'registration_date', sort_dir: 'desc' }

export function AdminParticipantsPage() {
  const { user } = useAuth()
  const canManage = user?.role !== 'STAFF'
  const [filters, setFilters] = useState<ParticipantFilters>(initialFilters)
  const [searchDraft, setSearchDraft] = useState('')
  const [options, setOptions] = useState<FilterOptions>({ colleges: [], years: [] })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ParticipantPage | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Participant | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailReload, setDetailReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [busyBulk, setBusyBulk] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => { api.participantOptions().then(setOptions).catch(err => setError(err.message)) }, [reload])
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(previous => previous.search === searchDraft ? previous : { ...previous, search: searchDraft })
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchDraft])
  useEffect(() => {
    let active = true
    setLoading(true); setListError(''); setSelected(new Set())
    api.participants(filters, page, 25).then(data => { if (active) setResult(data) }).catch(err => { if (active) { setListError(err.message); setResult(null) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, reload])
  useEffect(() => {
    if (detailId === null) { setDetail(null); return }
    let active = true
    setDetail(null); setDetailError('')
    api.participant(detailId).then(data => { if (active) setDetail(data) }).catch(err => { if (active) setDetailError(err.message) })
    return () => { active = false }
  }, [detailId, detailReload])

  function setFilter<K extends keyof ParticipantFilters>(key: K, value: ParticipantFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value }))
    setPage(1)
  }
  function toggleSelect(id: number) {
    setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function selectAll() {
    const ids = result?.items.map(item => item.id) || []
    setSelected(previous => ids.every(id => previous.has(id)) ? new Set() : new Set(ids))
  }
  async function attendance(id: number, status: AttendanceStatus) {
    setBusyId(id); setError(''); setMessage('')
    try { const updated = await api.updateParticipant(id, { attendance_status: status }); if (detail?.id === id) setDetail(updated); setMessage(`${updated.full_name} marked ${status.toLowerCase()}.`); setReload(value => value + 1) }
    catch (err) { setError(err instanceof Error ? err.message : 'Attendance update failed') }
    finally { setBusyId(null) }
  }
  async function bulk(action: BulkAction) {
    if (!selected.size) return
    setBusyBulk(true); setError(''); setMessage('')
    try { const response = await api.bulkParticipants([...selected], action); setMessage(`${response.updated_count} participant${response.updated_count === 1 ? '' : 's'} updated.`); setSelected(new Set()); setReload(value => value + 1) }
    catch (err) { setError(err instanceof Error ? err.message : 'Bulk update failed') }
    finally { setBusyBulk(false) }
  }
  async function download() {
    setError(''); setMessage('')
    try { await exportParticipants(filters); setMessage('CSV export downloaded.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Export failed') }
  }
  function clearFilters() { setFilters(initialFilters); setSearchDraft(''); setPage(1) }
  const hasFilters = Object.entries(filters).some(([key, value]) => !['sort_by', 'sort_dir'].includes(key) && value)

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow">/ EVENT OPERATIONS</span><h1>PARTICIPANTS<span>.</span></h1><p>Search registrations, track check-in, and manage eligibility.</p></div><div className="admin-phase-badge"><strong>{result?.total ?? '—'}</strong><br />MATCHING RECORDS</div></div>
    {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-success" role="status">{message}</div>}
    <div className="participant-toolbar"><label className="participant-search">SEARCH NAME, EMAIL, TEAM, COLLEGE<input type="search" value={searchDraft} onChange={e => setSearchDraft(e.target.value)} placeholder="Search registrations…" /></label><div className="toolbar-actions">{canManage && <button type="button" className="button button-outline" onClick={download}>EXPORT CSV ↗</button>}</div></div>
    <div className="participant-filters">
      <label>ATTENDANCE<select value={filters.attendance || ''} onChange={e => setFilter('attendance', e.target.value as AttendanceStatus | '')}><option value="">ALL</option><option value="REGISTERED">REGISTERED</option><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option></select></label>
      <label>ELIGIBILITY<select value={filters.certificate_eligible || ''} onChange={e => setFilter('certificate_eligible', e.target.value as 'true' | 'false' | '')}><option value="">ALL</option><option value="true">ELIGIBLE</option><option value="false">NOT ELIGIBLE</option></select></label>
      <label>COLLEGE<select value={filters.college || ''} onChange={e => setFilter('college', e.target.value)}><option value="">ALL COLLEGES</option>{options.colleges.map(college => <option key={college} value={college}>{college}</option>)}</select></label>
      <label>YEAR<select value={filters.year || ''} onChange={e => setFilter('year', e.target.value)}><option value="">ALL YEARS</option>{options.years.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      <label>STATUS<select value={filters.is_disqualified || ''} onChange={e => setFilter('is_disqualified', e.target.value as 'true' | 'false' | '')}><option value="">ALL</option><option value="false">ACTIVE</option><option value="true">DISQUALIFIED</option></select></label>
      <label>SORT BY<select value={`${filters.sort_by}:${filters.sort_dir}`} onChange={e => { const [sort_by, sort_dir] = e.target.value.split(':') as [ParticipantFilters['sort_by'], ParticipantFilters['sort_dir']]; setFilters(previous => ({ ...previous, sort_by, sort_dir })); setPage(1) }}><option value="registration_date:desc">NEWEST FIRST</option><option value="registration_date:asc">OLDEST FIRST</option><option value="name:asc">NAME A–Z</option><option value="name:desc">NAME Z–A</option><option value="college:asc">COLLEGE A–Z</option><option value="team:asc">TEAM A–Z</option></select></label>
      <button type="button" className="clear-filters" onClick={clearFilters}>CLEAR FILTERS</button>
    </div>
    {selected.size > 0 && <div className="bulk-bar"><strong>{selected.size} SELECTED</strong><button type="button" disabled={busyBulk} onClick={() => bulk('MARK_PRESENT')}>✓ MARK PRESENT</button><button type="button" disabled={busyBulk} onClick={() => bulk('MARK_ABSENT')}>− MARK ABSENT</button>{canManage && <><button type="button" disabled={busyBulk} onClick={() => bulk('MARK_ELIGIBLE')}>✳ MARK ELIGIBLE</button><button type="button" disabled={busyBulk} onClick={() => bulk('MARK_INELIGIBLE')}>MARK INELIGIBLE</button></>}<button type="button" onClick={() => setSelected(new Set())}>CLEAR SELECTION</button></div>}
    <div className="participant-panel"><div className="participant-panel-heading"><span>GOOGLE SHEET REGISTRATIONS</span><span>{loading ? 'LOADING…' : `${result?.total ?? 0} RESULTS`}</span></div>{loading ? <div className="participant-empty">Loading participants…</div> : listError ? <div className="participant-empty"><strong>COULD NOT LOAD PARTICIPANTS.</strong><p>{listError}</p><button className="button button-outline" type="button" onClick={() => setReload(value => value + 1)}>TRY AGAIN →</button></div> : result?.items.length ? <ParticipantTable participants={result.items} selected={selected} onSelect={toggleSelect} onSelectAll={selectAll} onOpen={setDetailId} onAttendance={attendance} busyId={busyId} /> : <div className="participant-empty"><strong>{hasFilters ? 'NO MATCHING PARTICIPANTS.' : 'NO PARTICIPANTS HAVE REGISTERED YET.'}</strong><p>{hasFilters ? 'Try a different search or clear the filters.' : 'Google Form responses will appear from the configured Google Sheet.'}</p></div>}</div>
    {!!result?.total_pages && result.total_pages > 1 && <div className="participant-pagination"><span>PAGE {result.page} OF {result.total_pages} · {result.total} RECORDS</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>← PREVIOUS</button><button type="button" disabled={page >= result.total_pages} onClick={() => setPage(value => value + 1)}>NEXT →</button></div></div>}
    {detailId !== null && (detail ? <ParticipantDetail key={detail.id} participant={detail} canManage={canManage} onClose={() => setDetailId(null)} onSaved={updated => { setDetail(updated); setMessage('Participant updated.'); setReload(value => value + 1) }} /> : <div className="detail-overlay"><div className="detail-drawer detail-loading">{detailError ? <><strong>COULD NOT LOAD PARTICIPANT.</strong><p>{detailError}</p><button type="button" onClick={() => setDetailReload(value => value + 1)}>TRY AGAIN</button></> : 'Loading participant…'} <button type="button" onClick={() => setDetailId(null)}>CLOSE</button></div></div>)}
  </>
}
