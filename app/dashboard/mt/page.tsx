'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  UserProfile,
  Activity,
  ActivityType,
  Term,
  ACTIVITY_LABELS,
  TERM_LABELS
} from '@/lib/types'
import LogoutButton from '@/app/components/LogoutButton'
import Image from 'next/image'

const CURRENT_TERM: Term = 'term1'
const CURRENT_YEAR = '2026-2027'

const ACTIVITY_TARGETS: Record<string, number> = {
  classroom_observation: 5,
  mentoring_coaching: 5,
  lac_session: 1,
}

export default function MTDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [mentees, setMentees] = useState<UserProfile[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [filterTerm, setFilterTerm] = useState<Term>(CURRENT_TERM)

  const [form, setForm] = useState({
    mentee_id: '',
    activity_type: 'classroom_observation' as ActivityType,
    date_conducted: new Date().toISOString().split('T')[0],
    term: CURRENT_TERM as Term,
    notes: '',
  })

  // --- Edit / delete state ---
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [editForm, setEditForm] = useState({
    mentee_id: '',
    activity_type: 'classroom_observation' as ActivityType,
    date_conducted: '',
    term: CURRENT_TERM as Term,
    notes: '',
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

    if (!prof || prof.role !== 'master_teacher') {
      router.push('/login')
      return
    }

    setProfile(prof)

    const { data: regularMentees } = await supabase
      .from('users')
      .select('*')
      .eq('assigned_mt_id', user.id)

    const { data: mtMentees } = await supabase
      .from('users')
      .select('*')
      .eq('mentor_mt_id', user.id)

    const combinedMentees = [
      ...(regularMentees || []),
      ...(mtMentees || []),
    ]

    setMentees(combinedMentees)

    if (combinedMentees.length > 0) {
      setForm(f => ({ ...f, mentee_id: combinedMentees[0].id }))
    }

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('mt_id', user.id)
      .order('date_conducted', { ascending: false })

    setActivities(acts || [])
    setLoading(false)
  }

  async function handleSubmit() {
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.mentee_id) {
      setErrorMsg('Please select a mentee.')
      return
    }
    if (!form.date_conducted) {
      setErrorMsg('Please select a date.')
      return
    }

    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('activities').insert({
      mt_id: user.id,
      mentee_id: form.mentee_id,
      activity_type: form.activity_type,
      date_conducted: form.date_conducted,
      term: form.term,
      school_year: CURRENT_YEAR,
      notes: form.notes || null,
      status: 'pending',
    })

    if (error) {
      setErrorMsg('Failed to save activity. Please try again.')
      setSubmitting(false)
      return
    }

    setSuccessMsg('Activity logged successfully. Mentee will be notified to confirm.')
    setForm(f => ({
      ...f,
      notes: '',
      date_conducted: new Date().toISOString().split('T')[0],
    }))

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('mt_id', user.id)
      .order('date_conducted', { ascending: false })

    setActivities(acts || [])
    setSubmitting(false)
  }

  function openEditModal(act: Activity) {
    setEditError('')
    setEditingActivity(act)
    setEditForm({
      mentee_id: act.mentee_id,
      activity_type: act.activity_type,
      date_conducted: act.date_conducted,
      term: act.term,
      notes: act.notes || '',
    })
  }

  function closeEditModal() {
    setEditingActivity(null)
    setEditError('')
  }

  async function handleUpdateActivity() {
    if (!editingActivity) return
    setEditError('')

    if (!editForm.mentee_id) {
      setEditError('Please select a mentee.')
      return
    }
    if (!editForm.date_conducted) {
      setEditError('Please select a date.')
      return
    }

    setEditSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEditSubmitting(false); return }

    // Editing a log resets it to "pending" so the mentee has to
    // re-confirm the corrected details rather than silently keeping
    // a stale "verified"/"disputed" status.
    const { data: updated, error } = await supabase
      .from('activities')
      .update({
        mentee_id: editForm.mentee_id,
        activity_type: editForm.activity_type,
        date_conducted: editForm.date_conducted,
        term: editForm.term,
        notes: editForm.notes || null,
        status: 'pending',
        dispute_reason: null,
      })
      .eq('id', editingActivity.id)
      .eq('mt_id', user.id) // safety: only ever touch your own logs
      .select()
      .single()

    if (error || !updated) {
      setEditError('Failed to update activity. Please try again.')
      setEditSubmitting(false)
      return
    }

    setActivities(prev => prev.map(a => (a.id === updated.id ? updated : a)))
    setEditSubmitting(false)
    setEditingActivity(null)
    setSuccessMsg('Activity updated. Mentee will be notified to re-confirm.')
  }

  async function handleDeleteActivity(id: string) {
    setDeletingId(id)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeletingId(null); return }

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('mt_id', user.id) // safety: only ever touch your own logs

    if (error) {
      setErrorMsg('Failed to delete activity. Please try again.')
      setDeletingId(null)
      setConfirmDeleteId(null)
      return
    }

    setActivities(prev => prev.filter(a => a.id !== id))
    setSuccessMsg('Activity deleted. Mentee will be notified it was removed.')
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  function getCount(type: string, term: Term) {
    return activities.filter(a => a.activity_type === type && a.term === term).length
  }

  function getVerifiedCount(type: string, term: Term) {
    return activities.filter(a => a.activity_type === type && a.term === term && a.status === 'verified').length
  }

  const filteredActivities = activities.filter(a => a.term === filterTerm)

  const statusColor: Record<string, string> = {
    pending: '#f59e0b',
    verified: '#10b981',
    disputed: '#ef4444',
  }

  const statusBg: Record<string, string> = {
    pending: '#fffbeb',
    verified: '#ecfdf5',
    disputed: '#fef2f2',
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
          <p style={{ color: 'rgba(200,220,255,0.6)', fontSize: '13px' }}>Loading your dashboard...</p>
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
                background: 'rgba(26,86,219,0.4)',
                color: '#93c5fd',
                padding: '2px 10px',
                borderRadius: '20px',
                verticalAlign: 'middle'
              }}>Master Teacher</span>
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{profile?.full_name}</p>
            <p style={{ fontSize: '11px', color: 'rgba(180,210,255,0.65)' }}>
              {profile?.subject_area} · SY {CURRENT_YEAR}
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: '960px', margin: '0 auto' }}>

        {/* Progress cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          marginBottom: '24px'
        }}>
          {Object.entries(ACTIVITY_TARGETS).map(([type, target]) => {
            const logged = getCount(type, CURRENT_TERM)
            const verified = getVerifiedCount(type, CURRENT_TERM)
            const pct = Math.min(Math.round((logged / target) * 100), 100)
            const color = pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'
            const trackColor = pct >= 100 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fca5a5'
            const accentBorder = pct >= 100 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fca5a5'
            return (
              <div key={type} style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderLeft: `4px solid ${accentBorder}`,
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
              }}>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 500 }}>
                  {ACTIVITY_LABELS[type as ActivityType]}
                </p>
                <p style={{ fontSize: '26px', fontWeight: 700, color, marginBottom: '2px', lineHeight: 1 }}>
                  {logged}
                  <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}> / {target}</span>
                </p>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>
                  {verified} verified · {logged - verified} pending/disputed
                </p>
                {/* Progress bar */}
                <div style={{
                  height: '6px', backgroundColor: '#f3f4f6',
                  borderRadius: '99px', overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    backgroundColor: trackColor,
                    borderRadius: '99px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <p style={{ fontSize: '11px', color, marginTop: '4px', fontWeight: 600 }}>{pct}% complete</p>
              </div>
            )
          })}
        </div>

        {/* Log Activity form */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '18px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f3f4f6'
          }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #1a56db, #6d28d9)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px'
            }}>📝</div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Log an Activity</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Record a session with your mentee</p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px',
            marginBottom: '14px'
          }}>

            {/* Mentee */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
                MENTEE
              </label>
              {mentees.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#f59e0b', padding: '9px 0' }}>
                  No mentees assigned yet. Contact your administrator.
                </p>
              ) : (
                <select
                  value={form.mentee_id}
                  onChange={e => setForm(f => ({ ...f, mentee_id: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px',
                    border: '1px solid #e5e7eb', borderRadius: '8px',
                    fontSize: '13px', backgroundColor: '#f9fafb',
                    color: '#374151', outline: 'none', cursor: 'pointer'
                  }}
                >
                  {mentees.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Activity type */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
                ACTIVITY TYPE
              </label>
              <select
                value={form.activity_type}
                onChange={e => setForm(f => ({ ...f, activity_type: e.target.value as ActivityType }))}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #e5e7eb', borderRadius: '8px',
                  fontSize: '13px', backgroundColor: '#f9fafb',
                  color: '#374151', outline: 'none', cursor: 'pointer'
                }}
              >
                {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
                DATE CONDUCTED
              </label>
              <input
                type="date"
                value={form.date_conducted}
                onChange={e => setForm(f => ({ ...f, date_conducted: e.target.value }))}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #e5e7eb', borderRadius: '8px',
                  fontSize: '13px', backgroundColor: '#f9fafb',
                  color: '#374151', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Term */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
                TERM
              </label>
              <select
                value={form.term}
                onChange={e => setForm(f => ({ ...f, term: e.target.value as Term }))}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px solid #e5e7eb', borderRadius: '8px',
                  fontSize: '13px', backgroundColor: '#f9fafb',
                  color: '#374151', outline: 'none', cursor: 'pointer'
                }}
              >
                {Object.entries(TERM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Notes */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px', letterSpacing: '0.03em' }}>
              NOTES <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Describe what was done, topics covered, observations made..."
              style={{
                width: '100%', padding: '9px 12px',
                border: '1px solid #e5e7eb', borderRadius: '8px',
                fontSize: '13px', resize: 'vertical',
                boxSizing: 'border-box', backgroundColor: '#f9fafb',
                color: '#374151', outline: 'none'
              }}
            />
          </div>

          {/* Feedback messages */}
          {successMsg && (
            <div style={{
              backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '13px', color: '#065f46', marginBottom: '12px',
              display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500
            }}>
              <span>✅</span> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '13px', color: '#991b1b', marginBottom: '12px',
              display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500
            }}>
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || mentees.length === 0}
            style={{
              padding: '10px 28px',
              background: submitting || mentees.length === 0
                ? 'rgba(100,130,200,0.4)'
                : 'linear-gradient(135deg, #1a56db, #6d28d9)',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600,
              cursor: submitting || mentees.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 4px 12px rgba(26,86,219,0.35)',
              letterSpacing: '0.03em'
            }}
          >
            {submitting ? 'Saving...' : '+ Log Activity'}
          </button>
        </div>

        {/* Activity log table */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '16px',
            paddingBottom: '14px', borderBottom: '1px solid #f3f4f6'
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>Activity Log</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                {filteredActivities.length} session{filteredActivities.length !== 1 ? 's' : ''} this term
              </p>
            </div>
            <select
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value as Term)}
              style={{
                padding: '7px 12px', border: '1px solid #e5e7eb',
                borderRadius: '8px', fontSize: '13px',
                backgroundColor: '#f9fafb', color: '#374151',
                fontWeight: 500, cursor: 'pointer', outline: 'none'
              }}
            >
              {Object.entries(TERM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {filteredActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>No activities logged for this term yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['Date', 'Activity', 'Mentee', 'Notes', 'Status', 'Actions'].map(h => (
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
                {filteredActivities.map((act, i) => {
                  const mentee = mentees.find(m => m.id === act.mentee_id)
                  return (
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
                        {mentee?.full_name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '180px' }}>
                        {act.notes ? (
                          <span title={act.notes}>
                            {act.notes.length > 40 ? act.notes.slice(0, 40) + '...' : act.notes}
                          </span>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          backgroundColor: statusBg[act.status],
                          color: statusColor[act.status],
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: `1px solid ${statusColor[act.status]}33`
                        }}>
                          {act.status.charAt(0).toUpperCase() + act.status.slice(1)}
                          {act.status === 'disputed' && act.dispute_reason
                            ? ` — ${act.dispute_reason.slice(0, 30)}`
                            : ''}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {confirmDeleteId === act.id ? (
                          <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#991b1b' }}>Delete?</span>
                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              disabled={deletingId === act.id}
                              style={{
                                fontSize: '12px', fontWeight: 600, color: 'white',
                                backgroundColor: '#dc2626', border: 'none',
                                borderRadius: '6px', padding: '4px 10px',
                                cursor: deletingId === act.id ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {deletingId === act.id ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{
                                fontSize: '12px', fontWeight: 600, color: '#374151',
                                backgroundColor: '#f3f4f6', border: 'none',
                                borderRadius: '6px', padding: '4px 10px', cursor: 'pointer'
                              }}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', gap: '10px' }}>
                            <button
                              onClick={() => openEditModal(act)}
                              style={{
                                fontSize: '12px', fontWeight: 600, color: '#1a56db',
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(act.id)}
                              style={{
                                fontSize: '12px', fontWeight: 600, color: '#dc2626',
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Edit activity modal */}
      {editingActivity && (
        <div
          onClick={closeEditModal}
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(10,20,50,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', zIndex: 50
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '12px',
              padding: '1.5rem', width: '100%', maxWidth: '480px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Edit Activity Log</h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                Correcting this will reset its status to Pending so the mentee can re-confirm.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>MENTEE</label>
                <select
                  value={editForm.mentee_id}
                  onChange={e => setEditForm(f => ({ ...f, mentee_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f9fafb', color: '#374151', outline: 'none', cursor: 'pointer' }}
                >
                  {mentees.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>ACTIVITY TYPE</label>
                <select
                  value={editForm.activity_type}
                  onChange={e => setEditForm(f => ({ ...f, activity_type: e.target.value as ActivityType }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f9fafb', color: '#374151', outline: 'none', cursor: 'pointer' }}
                >
                  {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>DATE CONDUCTED</label>
                <input
                  type="date"
                  value={editForm.date_conducted}
                  onChange={e => setEditForm(f => ({ ...f, date_conducted: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f9fafb', color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>TERM</label>
                <select
                  value={editForm.term}
                  onChange={e => setEditForm(f => ({ ...f, term: e.target.value as Term }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f9fafb', color: '#374151', outline: 'none', cursor: 'pointer' }}
                >
                  {Object.entries(TERM_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
                NOTES <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', backgroundColor: '#f9fafb', color: '#374151', outline: 'none' }}
              />
            </div>

            {editError && (
              <div style={{
                backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
                padding: '10px 14px', fontSize: '13px', color: '#991b1b', marginBottom: '12px', fontWeight: 500
              }}>
                ⚠️ {editError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={closeEditModal}
                style={{
                  padding: '10px 20px', background: '#f3f4f6', color: '#374151',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateActivity}
                disabled={editSubmitting}
                style={{
                  padding: '10px 20px',
                  background: editSubmitting ? 'rgba(100,130,200,0.4)' : 'linear-gradient(135deg, #1a56db, #6d28d9)',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600,
                  cursor: editSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
