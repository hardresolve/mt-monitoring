'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  UserProfile, Activity, GrowthNote,
  ACTIVITY_LABELS, TERM_LABELS, Term
} from '@/lib/types'
import LogoutButton from '@/app/components/LogoutButton'
import NotificationBell from '@/app/components/NotificationBell'

// Route: /dashboard/portfolio/[menteeId]
// Link to it from:
//  - MT dashboard: next to each mentee's name / activity rows
//  - Principal / head teacher dashboard: next to each mentee
//  - Mentee's own dashboard: link to their own id (self-view)
// Access is enforced client-side here; the real gate is Supabase RLS on
// `activities` — a viewer only ever sees rows they're already allowed to see.
export default function MenteePortfolioPage() {
  const params = useParams()
  const router = useRouter()
  const menteeId = params.menteeId as string

  const [viewerProfile, setViewerProfile] = useState<UserProfile | null>(null)
  const [mentee, setMentee] = useState<UserProfile | null>(null)
  const [mt, setMt] = useState<UserProfile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [growthNotes, setGrowthNotes] = useState<GrowthNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [filterTerm, setFilterTerm] = useState<Term | 'all'>('all')

  useEffect(() => { loadData() }, [menteeId])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: viewer } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!viewer) { router.push('/login'); return }
    setViewerProfile(viewer)

    const { data: menteeProf } = await supabase.from('users').select('*').eq('id', menteeId).single()
    setMentee(menteeProf)

    if (menteeProf?.assigned_mt_id) {
      const { data: mtProf } = await supabase.from('users').select('*').eq('id', menteeProf.assigned_mt_id).single()
      setMt(mtProf)
    }

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('date_conducted', { ascending: false })
    setActivities(acts || [])

    const { data: notes } = await supabase
      .from('mentee_growth_notes')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
    setGrowthNotes(notes || [])

    setLoading(false)
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    setSavingNote(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingNote(false); return }

    const { data, error } = await supabase
      .from('mentee_growth_notes')
      .insert({ mentee_id: menteeId, mt_id: user.id, note: newNote.trim() })
      .select()
      .single()

    if (!error && data) {
      setGrowthNotes(prev => [data, ...prev])
      setNewNote('')
    }
    setSavingNote(false)
  }

  const canAddNote = viewerProfile?.role === 'master_teacher' && mt?.id === viewerProfile.id

  const filteredActivities = filterTerm === 'all' ? activities : activities.filter(a => a.term === filterTerm)
  const verifiedCount = activities.filter(a => a.status === 'verified').length
  const pendingCount = activities.filter(a => a.status === 'pending').length
  const disputedCount = activities.filter(a => a.status === 'disputed').length

  const countsByType: Record<string, number> = {}
  activities.filter(a => a.status === 'verified').forEach(a => {
    countsByType[a.activity_type] = (countsByType[a.activity_type] || 0) + 1
  })

  function generateRPMSEvidence() {
    const verified = activities.filter(a => a.status === 'verified')
    const rows = verified.map(a => `
      <tr>
        <td>${new Date(a.date_conducted).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td>${ACTIVITY_LABELS[a.activity_type]}</td>
        <td>${TERM_LABELS[a.term]}</td>
        <td>${(a.notes || '—').replace(/</g, '&lt;')}</td>
      </tr>
    `).join('')

    const summaryRows = Object.entries(countsByType).map(([type, count]) => `
      <tr><td>${ACTIVITY_LABELS[type as keyof typeof ACTIVITY_LABELS] || type}</td><td>${count}</td></tr>
    `).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>RPMS Evidence Summary — ${mentee?.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; padding: 2rem; color: #222; }
          h1 { font-size: 17px; margin-bottom: 2px; }
          h2 { font-size: 13px; font-weight: normal; color: #555; margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
          th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
          .sig { margin-top: 3rem; display: flex; justify-content: space-between; }
          .sig div { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 11px; text-align: center; }
          @media print { body { padding: 1rem; } }
        </style>
      </head>
      <body>
        <h1>RPMS Evidence Summary</h1>
        <h2>${mentee?.full_name} · ${mentee?.subject_area || ''} · Sta. Ana National High School</h2>
        <p style="font-size:12px;color:#555;">Master Teacher: ${mt?.full_name || '—'} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <h3 style="font-size:13px;margin-top:1.5rem;">Confirmed Activity Summary</h3>
        <table><thead><tr><th>Activity Type</th><th>Confirmed Count</th></tr></thead><tbody>${summaryRows || '<tr><td colspan="2">No confirmed activities yet.</td></tr>'}</tbody></table>

        <h3 style="font-size:13px;">Confirmed Session Log</h3>
        <table>
          <thead><tr><th>Date</th><th>Activity</th><th>Term</th><th>Notes</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">No confirmed activities yet.</td></tr>'}</tbody>
        </table>

        <p style="font-size:11px;color:#777;">This summary includes only mentee-confirmed (verified) sessions and is suitable for attachment to RPMS portfolio evidence.</p>

        <div class="sig">
          <div>${mt?.full_name || 'Master Teacher'}<br/>Master Teacher</div>
          <div>${mentee?.full_name || 'Mentee'}<br/>Mentee / Ratee</div>
        </div>

        <script>window.onload = () => window.print()</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)' }}>
        <p style={{ color: 'rgba(200,220,255,0.6)', fontSize: '13px' }}>Loading portfolio...</p>
      </main>
    )
  }

  if (!mentee) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '13px', color: '#6b7280' }}>Mentee not found, or you don't have access to this portfolio.</p>
      </main>
    )
  }

  const statusColor: Record<string, string> = { pending: '#f59e0b', verified: '#10b981', disputed: '#ef4444' }
  const statusBg: Record<string, string> = { pending: '#fffbeb', verified: '#ecfdf5', disputed: '#fef2f2' }

  return (
    <main style={{ fontFamily: 'sans-serif', backgroundColor: '#f0f4ff', minHeight: '100vh' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)'
      }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.7)', marginBottom: '1px' }}>
            Mentee Progress Portfolio
          </p>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>{mentee.full_name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => router.back()} style={{ fontSize: '13px', color: 'rgba(200,220,255,0.85)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
          <NotificationBell />
          <LogoutButton />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: '900px', margin: '0 auto' }}>

        {/* Summary header */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>{mentee.subject_area || 'Subject not set'}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Master Teacher: {mt?.full_name || 'Unassigned'}</p>
            </div>
            <button
              onClick={generateRPMSEvidence}
              style={{
                padding: '9px 18px', background: 'linear-gradient(135deg, #1a56db, #6d28d9)', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,86,219,0.3)'
              }}
            >
              📄 Generate RPMS Evidence PDF
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ backgroundColor: '#ecfdf5', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#059669' }}>{verifiedCount}</p>
              <p style={{ fontSize: '11px', color: '#065f46' }}>Verified sessions</p>
            </div>
            <div style={{ backgroundColor: '#fffbeb', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#d97706' }}>{pendingCount}</p>
              <p style={{ fontSize: '11px', color: '#92400e' }}>Pending confirmation</p>
            </div>
            <div style={{ backgroundColor: '#fef2f2', borderRadius: '10px', padding: '12px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>{disputedCount}</p>
              <p style={{ fontSize: '11px', color: '#991b1b' }}>Disputed</p>
            </div>
          </div>
        </div>

        {/* Competency growth notes */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Competency Growth Notes</h2>

          {canAddNote && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                placeholder="Add an observation about this mentee's growth over time..."
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', outline: 'none' }}
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                style={{
                  padding: '9px 16px', background: '#1a56db', color: 'white', border: 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  opacity: savingNote || !newNote.trim() ? 0.6 : 1, alignSelf: 'flex-start'
                }}
              >
                {savingNote ? 'Saving...' : 'Add Note'}
              </button>
            </div>
          )}

          {growthNotes.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>No growth notes yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {growthNotes.map(n => (
                <div key={n.id} style={{ borderLeft: '3px solid #a78bfa', backgroundColor: '#faf9ff', padding: '8px 12px', borderRadius: '6px' }}>
                  <p style={{ fontSize: '12.5px', color: '#374151' }}>{n.note}</p>
                  <p style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: '4px' }}>
                    {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full session timeline */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>All Logged Sessions</h2>
            <select
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value as Term | 'all')}
              style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', backgroundColor: '#f9fafb', cursor: 'pointer' }}
            >
              <option value="all">All Terms</option>
              {Object.entries(TERM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {filteredActivities.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>No sessions logged.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredActivities.map(a => (
                <div key={a.id} style={{ border: '1px solid #f3f4f6', borderRadius: '10px', padding: '12px 14px', backgroundColor: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{ACTIVITY_LABELS[a.activity_type]}</p>
                    <span style={{
                      backgroundColor: statusBg[a.status], color: statusColor[a.status],
                      padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600
                    }}>
                      {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>
                    {new Date(a.date_conducted).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} · {TERM_LABELS[a.term]}
                  </p>
                  {a.notes && <p style={{ fontSize: '12px', color: '#4b5563' }}>{a.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
