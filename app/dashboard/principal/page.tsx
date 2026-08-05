'use client'

import { useEffect, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  UserProfile,
  Activity,
  ACTIVITY_LABELS,
  TERM_LABELS,
  Term
} from '@/lib/types'
import LogoutButton from '@/app/components/LogoutButton'
import AdminUserActions from '@/app/components/AdminUserActions'
import Image from 'next/image'

const ACTIVITY_TARGETS: Record<string, number> = {
  classroom_observation: 5,
  mentoring_coaching: 5,
  lac_session: 1,
}

// Same normalization used in the head-teacher dashboard, so department
// grouping stays consistent everywhere (handles "AP" -> "Araling
// Panlipunan", "Values Education" -> "ESP", and strips grade suffixes).
const SUBJECT_ALIASES: Record<string, string> = {
  'ap': 'araling panlipunan',
  'values education': 'esp',
}

function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return ''
  const base = subject.replace(/\s*\d+\s*$/, '').trim().toLowerCase()
  return SUBJECT_ALIASES[base] || base
}

function getGradeLevel(subject: string | null | undefined): number {
  if (!subject) return 0
  const match = subject.match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : 0
}

export default function PrincipalDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [masterTeachers, setMasterTeachers] = useState<UserProfile[]>([])
  const [allActivities, setAllActivities] = useState<Activity[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTerm, setFilterTerm] = useState<Term>('term1')
  const [selectedMT, setSelectedMT] = useState<UserProfile | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!prof || (prof.role !== 'principal' && prof.role !== 'assistant_principal')) {
      router.push('/login')
      return
    }

    setProfile(prof)

    const { data: users } = await supabase
      .from('users')
      .select('*')

    setAllUsers(users || [])
    const mts = (users || []).filter(u => u.role === 'master_teacher')
    mts.sort((a, b) => {
      const deptA = normalizeSubject(a.subject_area)
      const deptB = normalizeSubject(b.subject_area)
      if (deptA !== deptB) return deptA.localeCompare(deptB)
      const gradeA = getGradeLevel(a.subject_area)
      const gradeB = getGradeLevel(b.subject_area)
      if (gradeA !== gradeB) return gradeA - gradeB
      return a.full_name.localeCompare(b.full_name)
    })
    setMasterTeachers(mts)

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .order('date_conducted', { ascending: false })

    setAllActivities(acts || [])
    setLoading(false)
  }

  function getMTActivities(mtId: string, term: Term) {
    return allActivities.filter(a => a.mt_id === mtId && a.term === term)
  }

  function getCount(mtId: string, type: string, term: Term) {
    return allActivities.filter(a =>
      a.mt_id === mtId && a.activity_type === type && a.term === term
    ).length
  }

  function getVerifiedCount(mtId: string, type: string, term: Term) {
    return allActivities.filter(a =>
      a.mt_id === mtId && a.activity_type === type && a.term === term && a.status === 'verified'
    ).length
  }

  function getDisputedCount(mtId: string, term: Term) {
    return allActivities.filter(a =>
      a.mt_id === mtId && a.term === term && a.status === 'disputed'
    ).length
  }

  function getOverallStatus(mtId: string, term: Term) {
    const total = getCount(mtId, 'classroom_observation', term)
      + getCount(mtId, 'mentoring_coaching', term)
      + getCount(mtId, 'lac_session', term)
    const pct = Math.round((total / 24) * 100)
    if (pct >= 100) return 'on-track'
    if (pct >= 50) return 'behind'
    return 'critical'
  }

  function getUserName(id: string) {
    return allUsers.find(u => u.id === id)?.full_name || '—'
  }

  function handlePrint(mt: UserProfile) {
    const acts = getMTActivities(mt.id, filterTerm)
    const termLabel = TERM_LABELS[filterTerm]
    const rows = acts.map(a => `
      <tr>
        <td>${new Date(a.date_conducted).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td>${ACTIVITY_LABELS[a.activity_type]}</td>
        <td>${getUserName(a.mentee_id)}</td>
        <td>${a.notes || '—'}</td>
        <td style="color:${a.status === 'verified' ? '#065f46' : a.status === 'disputed' ? '#991b1b' : '#92400e'}">
          ${a.status.charAt(0).toUpperCase() + a.status.slice(1)}
          ${a.status === 'disputed' && a.dispute_reason ? ` — ${a.dispute_reason}` : ''}
        </td>
      </tr>
    `).join('')

    const obsLogged = getCount(mt.id, 'classroom_observation', filterTerm)
    const mentLogged = getCount(mt.id, 'mentoring_coaching', filterTerm)
    const lacLogged = getCount(mt.id, 'lac_session', filterTerm)

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Activity Report — ${mt.full_name}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; padding: 2rem; color: #222; }
          h1 { font-size: 16px; margin-bottom: 4px; }
          h2 { font-size: 13px; font-weight: normal; color: #555; margin-bottom: 2rem; }
          .summary { display: flex; gap: 2rem; margin-bottom: 2rem; }
          .summary-item p { margin: 0; font-size: 12px; color: #777; }
          .summary-item span { font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; font-size: 12px; color: #555; }
          td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
          .footer { margin-top: 3rem; font-size: 11px; color: #aaa; }
          @media print { body { padding: 1rem; } }
        </style>
      </head>
      <body>
        <h1>Master Teacher Activity Report</h1>
        <h2>${mt.full_name} · ${mt.subject_area || 'N/A'} · ${termLabel} · SY 2026–2027</h2>
        <h2>Sta. Ana National High School — DepEd Davao City</h2>
        <div class="summary">
          <div class="summary-item"><p>Classroom Observations</p><span>${obsLogged} / 12</span></div>
          <div class="summary-item"><p>Mentoring &amp; Coaching</p><span>${mentLogged} / 8</span></div>
          <div class="summary-item"><p>LAC Sessions</p><span>${lacLogged} / 4</span></div>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Activity</th><th>Mentee</th><th>Notes</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${rows.length > 0 ? rows : '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:2rem">No activities logged for this term.</td></tr>'}
          </tbody>
        </table>
        <div class="footer">
          Generated on ${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} · MT Monitoring System · SANHS
        </div>
        <script>window.onload = () => window.print()</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  const statusStyle: Record<string, { bg: string; border: string; text: string; label: string; icon: string }> = {
    'on-track': { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', label: 'On Track', icon: '✅' },
    'behind':   { bg: '#fffbeb', border: '#fde68a', text: '#92400e', label: 'Behind',   icon: '⚠️' },
    'critical': { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'Needs Attention', icon: '🚨' },
  }

  if (loading) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTop: '3px solid #4d94ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: 'rgba(200,220,255,0.6)', fontSize: '13px' }}>Loading dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return (
    <main style={{ fontFamily: 'sans-serif', backgroundColor: '#f0f4ff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0.85rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image
            src="/school.webp"
            alt="School Logo"
            width={38}
            height={38}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }}
          />
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.7)', marginBottom: '1px' }}>
              Sta. Ana National High School
            </p>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              MT Monitoring System
              <span style={{
                marginLeft: '10px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'rgba(16,185,129,0.25)',
                color: '#6ee7b7',
                padding: '2px 10px',
                borderRadius: '20px',
                verticalAlign: 'middle'
              }}>{profile?.role === 'assistant_principal' ? 'Assistant Principal' : 'Principal'}</span>
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{profile?.full_name}</p>
            <p style={{ fontSize: '11px', color: 'rgba(180,210,255,0.65)' }}>
              {masterTeachers.length} Master Teacher{masterTeachers.length !== 1 ? 's' : ''} under supervision
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: '1040px', margin: '0 auto' }}>

        {/* School-wide summary banner */}
        {!selectedMT && (() => {
          const totalDisputed = masterTeachers.reduce((sum, mt) => sum + getDisputedCount(mt.id, filterTerm), 0)
          const onTrack = masterTeachers.filter(mt => getOverallStatus(mt.id, filterTerm) === 'on-track').length
          const critical = masterTeachers.filter(mt => getOverallStatus(mt.id, filterTerm) === 'critical').length
          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '14px',
              marginBottom: '24px'
            }}>
              {[
                { label: 'Master Teachers', value: masterTeachers.length, icon: '👩‍🏫', color: '#1a56db', accent: '#93c5fd' },
                { label: 'On Track', value: onTrack, icon: '✅', color: '#059669', accent: '#6ee7b7' },
                { label: 'Needs Attention', value: critical, icon: '🚨', color: '#dc2626', accent: '#fca5a5' },
                { label: 'Disputed Sessions', value: totalDisputed, icon: '⚠️', color: '#d97706', accent: '#fde68a' },
              ].map(card => (
                <div key={card.label} style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderLeft: `4px solid ${card.accent}`,
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{card.label}</p>
                    <p style={{ fontSize: '30px', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</p>
                  </div>
                  <span style={{ fontSize: '22px', opacity: 0.5 }}>{card.icon}</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Term filter + section title */}
        {!selectedMT && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                Master Teacher Overview
              </h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                {TERM_LABELS[filterTerm]} · SY 2026–2027
              </p>
            </div>
            <select
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value as Term)}
              style={{
                padding: '7px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
                backgroundColor: '#f9fafb',
                color: '#374151',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {Object.entries(TERM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* MT cards grid */}
        {!selectedMT && (
          <>
            {masterTeachers.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
              }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>👩‍🏫</p>
                <p style={{ fontSize: '14px', color: '#9ca3af' }}>No master teachers found in the system.</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px'
              }}>
                {masterTeachers.map((mt, idx) => {
                  const status = getOverallStatus(mt.id, filterTerm)
                  const ss = statusStyle[status]
                  const disputed = getDisputedCount(mt.id, filterTerm)
                  const totalLogged = Object.keys(ACTIVITY_TARGETS).reduce(
                    (sum, type) => sum + getCount(mt.id, type, filterTerm), 0
                  )
                  const totalTarget = 11
                  const pct = Math.min(Math.round((totalLogged / totalTarget) * 100), 100)

                  const prevDept = idx > 0 ? normalizeSubject(masterTeachers[idx - 1].subject_area) : null
                  const currentDept = normalizeSubject(mt.subject_area)
                  const isNewDept = currentDept !== prevDept

                  return (
                    <Fragment key={mt.id}>
                    {isNewDept && (
                      <div style={{
                        gridColumn: '1 / -1',
                        marginTop: idx === 0 ? 0 : '8px',
                        paddingBottom: '4px',
                        borderBottom: '2px solid #e5e7eb'
                      }}>
                        <h3 style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#1a56db',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {mt.subject_area ? mt.subject_area.replace(/\s*\d+\s*$/, '').trim() : 'No Department'}
                        </h3>
                      </div>
                    )}
                    <div key={mt.id} style={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>

                      {/* MT name + status badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                            {mt.full_name}
                          </p>
                          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {mt.subject_area || 'No subject area'}
                          </p>
                        </div>
                        <span style={{
                          backgroundColor: ss.bg,
                          border: `1px solid ${ss.border}`,
                          color: ss.text,
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}>
                          {ss.icon} {ss.label}
                        </span>
                      </div>

                      {/* Overall progress bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>Overall Progress</span>
                          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>{totalLogged} / {totalTarget} sessions</span>
                        </div>
                        <div style={{ height: '7px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: pct >= 100
                              ? 'linear-gradient(90deg, #059669, #34d399)'
                              : pct >= 50
                              ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                              : 'linear-gradient(90deg, #dc2626, #f87171)',
                            borderRadius: '99px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>{pct}% complete</p>
                      </div>

                      {/* Per-activity mini breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {Object.entries(ACTIVITY_TARGETS).map(([type, target]) => {
                          const logged = getCount(mt.id, type, filterTerm)
                          const verified = getVerifiedCount(mt.id, type, filterTerm)
                          const miniPct = Math.min(Math.round((logged / target) * 100), 100)
                          return (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#6b7280', width: '130px', flexShrink: 0 }}>
                                {ACTIVITY_LABELS[type as keyof typeof ACTIVITY_LABELS]}
                              </span>
                              <div style={{ flex: 1, height: '5px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${miniPct}%`,
                                  backgroundColor: miniPct >= 100 ? '#34d399' : miniPct >= 50 ? '#fbbf24' : '#f87171',
                                  borderRadius: '99px'
                                }} />
                              </div>
                              <span style={{ fontSize: '11px', color: '#374151', fontWeight: 600, width: '36px', textAlign: 'right' }}>
                                {logged}/{target}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Disputed warning */}
                      {disputed > 0 && (
                        <div style={{
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fca5a5',
                          borderRadius: '8px',
                          padding: '7px 12px',
                          fontSize: '12px',
                          color: '#991b1b',
                          fontWeight: 500
                        }}>
                          ⚠️ {disputed} disputed session{disputed > 1 ? 's' : ''} need{disputed === 1 ? 's' : ''} review
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => setSelectedMT(mt)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            background: 'linear-gradient(135deg, #1a56db, #6d28d9)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(26,86,219,0.3)'
                          }}
                        >
                          View Full Log
                        </button>
                        <button
                          onClick={() => handlePrint(mt)}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            backgroundColor: 'transparent',
                            color: '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🖨 Print Report
                        </button>
                      </div>

                      {/* Admin: email correction + password reset */}
                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px', marginTop: '2px' }}>
                        <AdminUserActions
                          targetUserId={mt.id}
                          currentEmail={mt.email}
                          onUpdated={loadData}
                        />
                      </div>
                    </div>
                    </Fragment>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Full log for selected MT */}
        {selectedMT && (
          <div>
            {/* Back + header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px'
            }}>
              <div>
                <button
                  onClick={() => setSelectedMT(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1a56db',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: '8px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ← Back to All MTs
                </button>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                  {selectedMT.full_name}
                </h2>
                <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {selectedMT.subject_area || 'N/A'} · {TERM_LABELS[filterTerm]}
                </p>
              </div>
              <button
                onClick={() => handlePrint(selectedMT)}
                style={{
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, #1a56db, #6d28d9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(26,86,219,0.35)'
                }}
              >
                🖨 Print Report
              </button>
            </div>

            {/* Summary cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px',
              marginBottom: '20px'
            }}>
              {Object.entries(ACTIVITY_TARGETS).map(([type, target]) => {
                const logged = getCount(selectedMT.id, type, filterTerm)
                const verified = getVerifiedCount(selectedMT.id, type, filterTerm)
                const pct = Math.min(Math.round((logged / target) * 100), 100)
                const color = pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'
                const accent = pct >= 100 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fca5a5'
                return (
                  <div key={type} style={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: '12px',
                    padding: '1.1rem 1.25rem',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                  }}>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 500 }}>
                      {ACTIVITY_LABELS[type as keyof typeof ACTIVITY_LABELS]}
                    </p>
                    <p style={{ fontSize: '26px', fontWeight: 700, color, marginBottom: '2px', lineHeight: 1 }}>
                      {logged} <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>/ {target}</span>
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>{verified} verified</p>
                    <div style={{ height: '5px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        backgroundColor: accent, borderRadius: '99px'
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detailed table */}
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                All Activities This Term
              </h3>
              {getMTActivities(selectedMT.id, filterTerm).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>No activities logged for this term.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      {['Date', 'Activity', 'Mentee', 'Notes', 'Status'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '9px 12px',
                          color: '#6b7280', fontWeight: 600,
                          fontSize: '11px', letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          borderBottom: '1px solid #f3f4f6'
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getMTActivities(selectedMT.id, filterTerm).map((act, i) => (
                      <tr key={act.id} style={{
                        borderBottom: '1px solid #f9fafb',
                        backgroundColor: i % 2 === 0 ? 'white' : '#fafafa'
                      }}>
                        <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {new Date(act.date_conducted).toLocaleDateString('en-PH', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#374151' }}>
                          {ACTIVITY_LABELS[act.activity_type]}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#374151' }}>
                          {getUserName(act.mentee_id)}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '200px' }}>
                          {act.notes || <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            backgroundColor:
                              act.status === 'verified' ? '#ecfdf5' :
                              act.status === 'disputed' ? '#fef2f2' : '#fffbeb',
                            color:
                              act.status === 'verified' ? '#065f46' :
                              act.status === 'disputed' ? '#991b1b' : '#92400e',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            border: `1px solid ${
                              act.status === 'verified' ? '#6ee7b7' :
                              act.status === 'disputed' ? '#fca5a5' : '#fde68a'
                            }`
                          }}>
                            {act.status.charAt(0).toUpperCase() + act.status.slice(1)}
                          </span>
                          {act.status === 'disputed' && act.dispute_reason && (
                            <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '3px' }}>
                              {act.dispute_reason}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
